/**
 * Browser enforcement.
 *
 * Applies an approved policy to what the page actually does: network requests,
 * injected scripts, pixels. It decides nothing legal — the rules arrive from
 * the server as host/purpose/action triples, and this file matches a host,
 * reads the visitor's recorded decision, and allows or blocks.
 *
 * ## The enforcement boundary, stated plainly
 *
 * The brief says not to claim browser enforcement blocks every possible data
 * transfer. It does not, and the gaps are structural rather than bugs to be
 * fixed later:
 *
 *  1. **Anything that ran before this did.** Enforcement patches `fetch`,
 *     `XMLHttpRequest`, `sendBeacon`, `Image.src` and script insertion. A tag
 *     that executed before `analytics.enforcement.start()` has already run, and
 *     a `<script src>` present in the served HTML is fetched by the parser
 *     before any JavaScript executes at all. **Nothing in a page can block
 *     that.** Only a Content-Security-Policy header, a tag manager, or not
 *     putting the tag in the HTML can.
 *  2. **Server-to-server transfers are invisible.** If the customer's own
 *     backend forwards data to a vendor, no browser code sees it.
 *  3. **A determined script can undo this.** The patches are ordinary
 *     JavaScript on a page the customer controls; another script can capture
 *     the originals first, or restore them from an iframe. This is a control
 *     against ordinary tags behaving ordinarily, not against a hostile one.
 *  4. **Beacons on unload may not be interceptable in time**, depending on how
 *     the browser tears the page down.
 *  5. **Blocking a request is not deleting data already sent.** A tag that
 *     fired once before a visitor withdrew consent has already transmitted.
 *
 * This is why the API re-derives consent from the log rather than trusting a
 * client-side flag: browser enforcement raises the cost of a leak and gives an
 * operator a real control, and the server boundary is what is actually load
 * bearing. Both are needed and neither is sufficient.
 *
 * ## Observe first
 *
 * The default mode is `observe`: decide exactly as `enforce` would, record what
 * *would* have been blocked, and block nothing. Turning enforcement on is the
 * most dangerous thing an operator can do to their own site — a mis-scoped rule
 * breaks a checkout and they find out from customers — so it is a deliberate
 * act taken after looking at the observed decisions.
 */

import type {
  EnforcementConfig,
  EnforcementDecision,
  EnforcementRule,
} from "@rift-cmp/shared";
import type { ConsentApi } from "./consent";

export interface EnforcementOptions {
  /** Overrides the mode the server sent. For a test mode or a dry run. */
  mode?: EnforcementConfig["mode"];
  /** Called for every decision, allowed or blocked. */
  onDecision?: (decision: EnforcementDecision) => void;
  /** Ceiling on retained decisions, so a long session cannot grow unbounded. */
  maxDecisions?: number;
}

const DEFAULT_MAX_DECISIONS = 500;

/** Suffix match, identical to the server's catalogue matching. */
export function hostMatches(host: string, pattern: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  const p = pattern.trim().toLowerCase().replace(/\.$/, "");
  if (!h || !p) return false;
  return h === p || h.endsWith(`.${p}`);
}

/** The host of a URL, or null when it is not one we can reason about. */
export function hostOf(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base ?? globalThis.location?.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface DecisionInput {
  resource: string;
  host: string | null;
  rules: readonly EnforcementRule[];
  unknownHost: EnforcementConfig["unknown_host"];
  /** Purpose codes currently GRANTED for this visitor. */
  granted: ReadonlySet<string>;
  /** Purpose codes with any recorded decision, granted or not. */
  decided: ReadonlySet<string>;
}

/**
 * The decision, as a pure function.
 *
 * Exported and tested directly, because "would this have been blocked" is the
 * question an operator asks of the test mode and the one a regression test has
 * to be able to ask without a browser.
 */
export function decide(
  input: DecisionInput,
): Omit<EnforcementDecision, "observed_only" | "at"> {
  const { host } = input;

  if (host === null) {
    return {
      resource: input.resource,
      vendor: null,
      purpose: null,
      user_state: "n/a",
      policy: null,
      decision: "allow",
      reason: "Not an http(s) URL, so no rule can apply to it.",
    };
  }

  // First match wins, and rules arrive sorted by host so the choice is stable.
  const rule = input.rules.find((r) => hostMatches(host, r.host)) ?? null;

  if (!rule) {
    const block = input.unknownHost === "block";
    return {
      resource: input.resource,
      vendor: null,
      purpose: null,
      user_state: "n/a",
      policy: null,
      decision: block ? "block" : "allow",
      reason: block
        ? "No rule matches this host and the policy sets unknown hosts to block."
        : "No rule matches this host. The policy allows unmatched hosts, so this is not evidence it was reviewed.",
    };
  }

  if (rule.action === "allow") {
    return {
      resource: input.resource,
      vendor: rule.vendor,
      purpose: rule.purpose,
      user_state: "n/a",
      policy: rule,
      decision: "allow",
      reason: `The approved policy allows ${rule.vendor} without a consent gate.`,
    };
  }

  if (rule.action === "block") {
    return {
      resource: input.resource,
      vendor: rule.vendor,
      purpose: rule.purpose,
      user_state: "n/a",
      policy: rule,
      decision: "block",
      reason: `The approved policy blocks ${rule.vendor} outright.`,
    };
  }

  // require_consent
  if (!rule.purpose) {
    // A consent gate with no purpose cannot be satisfied by any decision, so
    // allowing it would make the rule meaningless while looking like a control.
    return {
      resource: input.resource,
      vendor: rule.vendor,
      purpose: null,
      user_state: "undecided",
      policy: rule,
      decision: "block",
      reason: `${rule.vendor} requires consent but the policy names no purpose, so no decision can satisfy it.`,
    };
  }

  const granted = input.granted.has(rule.purpose);
  const decided = input.decided.has(rule.purpose);
  const state = granted ? "granted" : decided ? "denied_or_withdrawn" : "undecided";

  return {
    resource: input.resource,
    vendor: rule.vendor,
    purpose: rule.purpose,
    user_state: state,
    policy: rule,
    decision: granted ? "allow" : "block",
    reason: granted
      ? `"${rule.purpose}" is granted, so ${rule.vendor} is allowed.`
      : decided
        ? `"${rule.purpose}" is not granted, so ${rule.vendor} is blocked.`
        : `"${rule.purpose}" has no recorded decision. Silence is not consent, so ${rule.vendor} is blocked.`,
  };
}

/**
 * Applies a policy to the live page.
 *
 * Every patch is recorded so `stop()` restores the originals exactly, and a
 * failure inside a patch falls through to the real function: a bug in
 * enforcement must never be able to take a customer's site down.
 */
export class EnforcementClient {
  private config: EnforcementConfig | null = null;
  private decisions: EnforcementDecision[] = [];
  private restore: Array<() => void> = [];
  private running = false;

  constructor(
    private readonly consent: ConsentApi,
    private readonly options: EnforcementOptions = {},
  ) {}

  /** Begin enforcing. Returns false when there is nothing to enforce. */
  start(config: EnforcementConfig | null): boolean {
    if (this.running) return false;
    if (!config || config.mode === "off" || config.rules.length === 0) return false;
    if (typeof window === "undefined") return false;

    this.config = { ...config, mode: this.options.mode ?? config.mode };
    this.running = true;

    this.patchFetch();
    this.patchXhr();
    this.patchBeacon();
    this.patchImage();
    this.patchScriptInsertion();
    return true;
  }

  stop(): void {
    for (const undo of this.restore.splice(0).reverse()) {
      try {
        undo();
      } catch {
        // A failed restore must not prevent the others.
      }
    }
    this.running = false;
    this.config = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** The mode actually in force. */
  get mode(): EnforcementConfig["mode"] {
    return this.config?.mode ?? "off";
  }

  /**
   * The test-mode table: tracker, purpose, user state, policy, decision, reason.
   *
   * Every decision taken since `start()`, allowed and blocked alike. Showing
   * only the blocks would answer "what did you stop" and not the question an
   * operator actually has, which is "what did you let through, and why".
   */
  explain(): EnforcementDecision[] {
    return [...this.decisions];
  }

  /** Decide about a resource without touching the page. For a dry run. */
  preview(resource: string): EnforcementDecision {
    return this.evaluate(resource, false);
  }

  clear(): void {
    this.decisions = [];
  }

  // ── Deciding ───────────────────────────────────────────────────────────────

  private evaluate(resource: string, record: boolean): EnforcementDecision {
    const config = this.config;
    const state = this.consent.getCachedState();
    const granted = new Set(
      state.filter((s) => s.status === "GRANTED").map((s) => s.purpose_code),
    );
    const decided = new Set(state.map((s) => s.purpose_code));

    const base = decide({
      resource,
      host: hostOf(resource),
      rules: config?.rules ?? [],
      unknownHost: config?.unknown_host ?? "allow",
      granted,
      decided,
    });

    const decision: EnforcementDecision = {
      ...base,
      observed_only: config?.mode !== "enforce",
      at: new Date().toISOString(),
    };

    if (record) {
      const max = this.options.maxDecisions ?? DEFAULT_MAX_DECISIONS;
      this.decisions.push(decision);
      if (this.decisions.length > max) this.decisions.shift();
      try {
        this.options.onDecision?.(decision);
      } catch {
        // A caller's listener must not break the page either.
      }
    }

    return decision;
  }

  /** True when the resource should actually be stopped. */
  private shouldBlock(resource: string): boolean {
    try {
      const decision = this.evaluate(resource, true);
      return decision.decision === "block" && this.config?.mode === "enforce";
    } catch {
      // Never let an enforcement failure break a page.
      return false;
    }
  }

  // ── Patches ────────────────────────────────────────────────────────────────

  private patchFetch(): void {
    if (typeof window.fetch !== "function") return;
    const original = window.fetch;
    const self = this;

    window.fetch = function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>) {
      try {
        const input = args[0];
        const raw =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request)?.url;
        if (raw && self.shouldBlock(raw)) {
          // A rejected promise, not a silent empty response: a tag that thinks
          // it succeeded may retry or report bad data, and a caller that sees a
          // network error behaves the way it would offline - a case every
          // reasonable tag already handles.
          return Promise.reject(
            new Error("[rift-cmp] blocked by consent policy"),
          );
        }
      } catch {
        // fall through to the real fetch
      }
      return original.apply(this as never, args);
    };

    this.restore.push(() => {
      window.fetch = original;
    });
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest !== "function") return;
    const original = XMLHttpRequest.prototype.open;
    const self = this;

    XMLHttpRequest.prototype.open = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      try {
        if (self.shouldBlock(typeof url === "string" ? url : url.href)) {
          // Point it at a URL that cannot resolve rather than throwing from
          // open(): a synchronous throw here breaks callers that do not expect
          // one, while a failed request is a state they already handle.
          return (original as (...a: unknown[]) => void).apply(this, [
            method,
            "about:blank#rift-blocked",
            ...rest,
          ]);
        }
      } catch {
        // fall through
      }
      return (original as (...a: unknown[]) => void).apply(this, [method, url, ...rest]);
    } as XMLHttpRequest["open"];

    this.restore.push(() => {
      XMLHttpRequest.prototype.open = original;
    });
  }

  private patchBeacon(): void {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return;
    }
    const original = navigator.sendBeacon.bind(navigator);
    const self = this;

    navigator.sendBeacon = function patchedBeacon(url: string | URL, data?: BodyInit | null) {
      try {
        if (self.shouldBlock(typeof url === "string" ? url : url.href)) return false;
      } catch {
        // fall through
      }
      return original(url, data);
    };

    this.restore.push(() => {
      navigator.sendBeacon = original;
    });
  }

  private patchImage(): void {
    if (typeof HTMLImageElement === "undefined") return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set) return;
    const originalSet = descriptor.set;
    const self = this;

    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        try {
          if (self.shouldBlock(value)) return;
        } catch {
          // fall through
        }
        originalSet.call(this, value);
      },
    });

    this.restore.push(() => {
      Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
    });
  }

  /**
   * Stop a blocked `<script src>` from being inserted.
   *
   * Patches `appendChild` and `insertBefore` on `Node.prototype` rather than
   * `HTMLScriptElement.src`, because setting `src` on a detached element does
   * not fetch anything — insertion is what does. A script already in the served
   * HTML is fetched by the parser before any of this exists; see the boundary
   * note at the top of the file.
   */
  private patchScriptInsertion(): void {
    if (typeof Node === "undefined") return;
    const self = this;
    const originalAppend = Node.prototype.appendChild;
    const originalInsert = Node.prototype.insertBefore;

    const blocked = (node: unknown): boolean => {
      try {
        const element = node as { tagName?: string; src?: string };
        if (!element?.tagName || element.tagName.toUpperCase() !== "SCRIPT") return false;
        if (!element.src) return false;
        return self.shouldBlock(element.src);
      } catch {
        return false;
      }
    };

    Node.prototype.appendChild = function patchedAppend<T extends Node>(
      this: Node,
      node: T,
    ): T {
      // Returning the node unappended keeps the caller's contract - it gets its
      // element back - while the element never enters the document and so never
      // fetches.
      if (blocked(node)) return node;
      return originalAppend.call(this, node) as T;
    };

    Node.prototype.insertBefore = function patchedInsert<T extends Node>(
      this: Node,
      node: T,
      child: Node | null,
    ): T {
      if (blocked(node)) return node;
      return originalInsert.call(this, node, child) as T;
    };

    this.restore.push(() => {
      Node.prototype.appendChild = originalAppend;
      Node.prototype.insertBefore = originalInsert;
    });
  }
}
