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

import type { EnforcementConfig, EnforcementDecision } from "@rift-cmp/shared";
import { decide, hostOf } from "@rift-cmp/shared";
import type { ConsentApi } from "./consent";

// The decision function and its host matching used to live here. They now live
// in `@rift-cmp/shared/consent-firewall`, unchanged, so the server can reach
// exactly the same evaluator - two implementations of "is this allowed" would
// drift, and the drift is invisible until a tag that should have been gated was
// not. They are re-exported here so every existing importer is unaffected.
export { decide, hostMatches, hostOf } from "@rift-cmp/shared";
export type { DecisionInput } from "@rift-cmp/shared";

export interface EnforcementOptions {
  /** Overrides the mode the server sent. For a test mode or a dry run. */
  mode?: EnforcementConfig["mode"];
  /** Called for every decision, allowed or blocked. */
  onDecision?: (decision: EnforcementDecision) => void;
  /** Ceiling on retained decisions, so a long session cannot grow unbounded. */
  maxDecisions?: number;
}

const DEFAULT_MAX_DECISIONS = 500;

/**
 * The attribute that makes each element fetch something.
 *
 * Keyed by tag name, because "the URL" is a different attribute per element and
 * checking `src` alone would miss every stylesheet and every `<object>`.
 */
const URL_ATTRIBUTE: Record<string, string> = {
  SCRIPT: "src",
  IFRAME: "src",
  IMG: "src",
  LINK: "href",
  EMBED: "src",
  OBJECT: "data",
  SOURCE: "src",
  VIDEO: "src",
  AUDIO: "src",
  TRACK: "src",
};

/** Ceiling on the subtree walk during insertion. See `blocksInsertion`. */
const MAX_INSERTION_NODES = 500;

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
    this.patchFrame();
    this.patchSetAttribute();
    this.patchElementInsertion();
    this.patchCookie();
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
   * Stop a blocked frame from loading.
   *
   * Same shape as the image patch and for the same reason: an iframe is one of
   * the few elements that can carry a whole tag manager, and pointing one at a
   * blocked vendor is the ordinary way a tag gets reintroduced after somebody
   * removed the script.
   */
  private patchFrame(): void {
    if (typeof HTMLIFrameElement === "undefined") return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
    if (!descriptor?.set) return;
    const originalSet = descriptor.set;
    const self = this;

    Object.defineProperty(HTMLIFrameElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLIFrameElement, value: string) {
        try {
          if (self.shouldBlock(value)) return;
        } catch {
          // fall through
        }
        originalSet.call(this, value);
      },
    });

    this.restore.push(() => {
      Object.defineProperty(HTMLIFrameElement.prototype, "src", descriptor);
    });
  }

  /**
   * Close the `setAttribute` route.
   *
   * `img.src = url` goes through the property setter patched above.
   * `img.setAttribute("src", url)` does not - it writes the attribute directly,
   * and the element fetches just the same. Without this, every property-setter
   * patch in this file has a one-line bypass that an ordinary tag could already
   * be using without meaning anything by it.
   */
  private patchSetAttribute(): void {
    if (typeof Element === "undefined") return;
    const original = Element.prototype.setAttribute;
    const self = this;

    Element.prototype.setAttribute = function patchedSetAttribute(
      this: Element,
      name: string,
      value: string,
    ): void {
      try {
        const attribute = URL_ATTRIBUTE[this.tagName?.toUpperCase() ?? ""];
        if (attribute && name.toLowerCase() === attribute && self.shouldBlock(value)) {
          return;
        }
      } catch {
        // fall through
      }
      return original.call(this, name, value);
    };

    this.restore.push(() => {
      Element.prototype.setAttribute = original;
    });
  }

  /**
   * Stop a blocked resource from entering the document.
   *
   * Setting `src` on a detached element fetches nothing; insertion is what
   * does. This previously covered `<script src>` through `appendChild` and
   * `insertBefore` only, which left three ways round it costing one line each:
   * use `replaceChild`, use `append`/`prepend`, or put the script inside a
   * wrapper `<div>` and insert that. All of those entry points now run the same
   * check, and the check walks the subtree of whatever is being inserted.
   *
   * It also covers iframes, pixels, stylesheets and media rather than scripts
   * alone - a tracking pixel is an `<img>`, and a vendor blocked as a script is
   * not less blocked when it arrives as one.
   *
   * A script already present in the served HTML is fetched by the parser before
   * any of this exists. Nothing on the page can change that; see the boundary
   * note at the top of the file.
   */
  private patchElementInsertion(): void {
    if (typeof Node === "undefined") return;
    const self = this;

    const originalAppend = Node.prototype.appendChild;
    const originalInsert = Node.prototype.insertBefore;
    const originalReplace = Node.prototype.replaceChild;

    Node.prototype.appendChild = function patchedAppend<T extends Node>(this: Node, node: T): T {
      // Returning the node unappended keeps the caller's contract - it gets its
      // element back - while the element never enters the document and so never
      // fetches.
      if (self.blocksInsertion(node)) return node;
      return originalAppend.call(this, node) as T;
    };

    Node.prototype.insertBefore = function patchedInsert<T extends Node>(
      this: Node,
      node: T,
      child: Node | null,
    ): T {
      if (self.blocksInsertion(node)) return node;
      return originalInsert.call(this, node, child) as T;
    };

    Node.prototype.replaceChild = function patchedReplace<T extends Node>(
      this: Node,
      node: Node,
      child: T,
    ): T {
      // Refusing the replacement leaves the existing child in place, which is
      // the state the page was already in and therefore the safe one.
      if (self.blocksInsertion(node)) return child;
      return originalReplace.call(this, node, child) as T;
    };

    this.restore.push(() => {
      Node.prototype.appendChild = originalAppend;
      Node.prototype.insertBefore = originalInsert;
      Node.prototype.replaceChild = originalReplace;
    });

    // `append`, `prepend`, `after`, `before` and `replaceWith` take variadic
    // nodes and strings and do not route through `appendChild`.
    if (typeof Element !== "undefined") {
      for (const method of ["append", "prepend", "after", "before", "replaceWith"] as const) {
        const target = Element.prototype as unknown as Record<string, unknown>;
        const originalMethod = target[method] as
          | ((...nodes: Array<Node | string>) => void)
          | undefined;
        if (typeof originalMethod !== "function") continue;

        target[method] = function patchedVariadic(this: Element, ...nodes: Array<Node | string>) {
          const permitted = nodes.filter((n) => typeof n === "string" || !self.blocksInsertion(n));
          return originalMethod.apply(this, permitted);
        };

        this.restore.push(() => {
          target[method] = originalMethod;
        });
      }
    }
  }

  /**
   * Whether inserting this node would load something the policy blocks.
   *
   * Walks the subtree, because a blocked script inside an appended wrapper is
   * still a blocked script. The walk is bounded: an unbounded one turns a large
   * DOM insertion into a page freeze, which is a worse outcome than a missed
   * pixel.
   */
  private blocksInsertion(node: unknown): boolean {
    try {
      const element = node as Element | null;
      if (!element || typeof element !== "object") return false;

      const queue: Element[] = [element];
      let examined = 0;

      while (queue.length > 0 && examined < MAX_INSERTION_NODES) {
        const current = queue.shift() as Element;
        examined += 1;

        const tag = (current as { tagName?: string }).tagName?.toUpperCase();
        if (tag) {
          const attribute = URL_ATTRIBUTE[tag];
          if (attribute) {
            const url = (current as unknown as Record<string, unknown>)[attribute];
            if (typeof url === "string" && url && this.shouldBlock(url)) return true;
          }
        }

        const children = (current as { children?: ArrayLike<Element> }).children;
        if (children) {
          for (let i = 0; i < children.length; i += 1) queue.push(children[i] as Element);
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Refuse a cookie written for a blocked vendor's domain.
   *
   * The honest scope of this is narrow and worth stating. A cookie is only
   * attributable to a vendor when the write names a `domain=` that a rule
   * matches. The overwhelming majority of tracking cookies are first-party
   * cookies written by a third-party script onto the site's own domain, and
   * those are indistinguishable from the site's own session cookie - blocking
   * by name would be guesswork, and guessing wrong logs a customer out.
   *
   * So this catches the attributable case and does not pretend to catch the
   * rest. The rest is what `require_consent` on the script itself is for: a
   * vendor that never loads never writes anything.
   */
  private patchCookie(): void {
    if (typeof document === "undefined" || typeof Document === "undefined") return;

    // Where the accessor actually lives matters for putting it back. Browsers
    // define `cookie` on `Document.prototype`; patching there and restoring onto
    // `document` would leave an own property behind that shadows the prototype
    // forever, so `stop()` would not really be a stop.
    const onPrototype = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    const target: object = onPrototype ? Document.prototype : document;
    const descriptor = onPrototype ?? Object.getOwnPropertyDescriptor(document, "cookie");
    if (!descriptor?.set || !descriptor.get) return;

    const originalSet = descriptor.set;
    const originalGet = descriptor.get;
    const self = this;

    try {
      Object.defineProperty(target, "cookie", {
        configurable: true,
        get(this: Document): string {
          return originalGet.call(this) as string;
        },
        set(this: Document, value: string) {
          try {
            const domain = /;\s*domain\s*=\s*([^;]+)/i.exec(String(value))?.[1]?.trim();
            if (domain && self.shouldBlock(`https://${domain.replace(/^\./, "")}/`)) return;
          } catch {
            // fall through
          }
          originalSet.call(this, value);
        },
      });

      this.restore.push(() => {
        Object.defineProperty(target, "cookie", descriptor);
      });
    } catch {
      // Some environments make `document.cookie` non-configurable. Losing this
      // one control must not stop the rest of enforcement from starting.
    }
  }
}
