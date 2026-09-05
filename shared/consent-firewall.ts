/**
 * The consent firewall: one evaluator, used everywhere a decision is made.
 *
 * ## Why this file exists at all
 *
 * The browser SDK already decided allow-or-block from an approved policy, and
 * it did it well. What it could not do was answer the same question on the
 * server, for a request the browser never sees — and the obvious way to fix
 * that is to write a second evaluator that agrees with the first. It never
 * does. Two evaluators drift, and the drift shows up as a vendor classified one
 * way and enforced another, which nobody notices until a tag that should have
 * been gated was not.
 *
 * So the pure decision function that used to live in `sdk/src/enforce.ts` lives
 * here, unchanged in behaviour, and both planes call it. `decide()` is still
 * exported from the SDK, from this module, so nothing that imported it moved.
 *
 * ## Five outcomes, and the one number that actually happens
 *
 * The brief asks for `ALLOW | BLOCK | REDACT | REQUIRE_CONSENT | REVIEW`. Those
 * are five *classifications*, and only two things can happen to a request: it
 * goes or it does not. Collapsing the five into two loses the reason; reporting
 * five as though they were five different runtime behaviours would be worse,
 * because `REVIEW` would read as a control when it is an absence of one.
 *
 * Every decision therefore carries both:
 *
 *   `decision` — the classification, which is what an operator reads.
 *   `effect`   — `allow` or `block`, which is what the request does.
 *
 * `REQUIRE_CONSENT` has effect `block`: the gate exists and is unsatisfied.
 * `REVIEW` has effect `allow` under the default policy, and that combination is
 * the honest one — it says "nothing here was reviewed, and we are not blocking
 * it", rather than dressing an unmatched host up as a decision.
 *
 * ## Unknown is never silently ALLOW
 *
 * The fail-safe the brief asks for is already the shape of the existing config:
 * `unknown_host` is an operator choice between `allow` and `block`, defaulting
 * to `allow` because a consent tool that blocks fonts and payment providers is
 * one that gets removed. What was missing was that the default produced an
 * `allow` indistinguishable from a reviewed one. Here it produces `REVIEW` with
 * a stated severity, so an unmatched host is visible as an unmatched host — the
 * effect is unchanged, and the silence is gone.
 *
 * ## Deterministic, and no model anywhere near it
 *
 * Nothing in this file reads a network, a clock (beyond the caller's), or a
 * model. The same inputs produce the same decision on any machine, which is the
 * only reason an enforcement event is worth recording as evidence.
 */

import type { EnforcementConfig, EnforcementDecision, EnforcementRule } from "./consent-config";

// ─── Host matching ───────────────────────────────────────────────────────────

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

// ─── The core decision ───────────────────────────────────────────────────────

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

// ─── The firewall layer ──────────────────────────────────────────────────────

export type FirewallDecision =
  | "ALLOW"
  | "BLOCK"
  | "REDACT"
  | "REQUIRE_CONSENT"
  | "REVIEW";

/** What actually happens to the request. Only two things can. */
export type FirewallEffect = "allow" | "block";

export type FirewallSeverity = "critical" | "high" | "medium" | "low" | "info";

/** Where the decision was taken. The two planes are not equivalent; see below. */
export type EnforcementSource =
  /** In the visitor's browser, by the SDK. Best-effort; see docs/enforcement.md. */
  | "client"
  /** On a request path Rift controls end to end. Not bypassable from a page. */
  | "server";

/**
 * Everything the firewall is allowed to look at.
 *
 * Every field beyond `destination` is optional because the two call sites know
 * different amounts: a browser knows the URL and the visitor's decisions, a
 * server integration may know the vendor and purpose outright and have no
 * principal at all. Missing information narrows what the firewall can conclude;
 * it never widens it.
 */
export interface FirewallSubject {
  organisationId: string;
  siteId: string;
  /** The URL or host being requested. */
  destination: string;
  /** The page the request originates from, where one is known. */
  page?: string | null;
  /** Overrides host classification when the caller already knows the vendor. */
  vendor?: string | null;
  /** Detector or catalogue id, where one is known. */
  tracker?: string | null;
  /** Purpose code the caller asserts this request serves. */
  purpose?: string | null;
  /** Canonical data categories in the payload, where declared. */
  dataCategories?: readonly string[];
  /** Jurisdictions in force, as the resolver read them. */
  jurisdictions?: readonly string[];
  source: EnforcementSource;
}

/** The consent and policy state the decision is taken against. */
export interface FirewallContext {
  config: EnforcementConfig;
  /** Purpose codes currently GRANTED. */
  granted: ReadonlySet<string>;
  /** Purpose codes with any recorded decision. */
  decided: ReadonlySet<string>;
  /** The approved consent configuration version this was judged against. */
  policyVersion: string | null;
  /** Redaction rule ids that matched, supplied by the redaction layer. */
  redactions?: readonly string[];
  /** True when the caller has no principal at all — a server path, usually. */
  principalKnown?: boolean;
}

export interface FirewallEvidence {
  /** `policy` | `consent` | `catalogue` | `config` */
  source: string;
  detail: string;
}

export interface FirewallResult {
  decision: FirewallDecision;
  /** What happens to the request. `REVIEW` and `ALLOW` both allow. */
  effect: FirewallEffect;
  destination: string;
  host: string | null;
  vendor: string | null;
  purpose: string | null;
  /** The visitor's state for the gating purpose, or `n/a`. */
  userState: string;
  /** The rule that matched, verbatim, or null where none did. */
  matchedRule: EnforcementRule | null;
  policyVersion: string | null;
  reason: string;
  severity: FirewallSeverity;
  evidence: FirewallEvidence[];
  /** Redaction rule ids applied. Ids only — never a value. */
  redactions: string[];
  source: EnforcementSource;
  /**
   * True when the deciding policy is in `observe` mode, so the effect was
   * recorded rather than applied. An observed BLOCK did not block anything.
   */
  observedOnly: boolean;
  /** This is an enforcement decision. It is not a legal conclusion. */
  legalAdvice: false;
}

/**
 * Evaluate one request.
 *
 * The core allow/block comes from `decide()` — the same function the browser
 * runs — and this adds the classification, the severity and the evidence. It
 * never reverses the core: if `decide()` said block, the effect is block.
 */
export function evaluateFirewall(
  subject: FirewallSubject,
  context: FirewallContext,
): FirewallResult {
  // No base URL. A destination that is not an absolute http(s) URL has no host,
  // and resolving it against a placeholder would turn a malformed string into a
  // real hostname - which could then match a rule that was never about it.
  const host = hostOf(subject.destination);
  const base = decide({
    resource: subject.destination,
    host,
    rules: context.config.rules,
    unknownHost: context.config.unknown_host,
    granted: context.granted,
    decided: context.decided,
  });

  const evidence: FirewallEvidence[] = [];
  const redactions = [...(context.redactions ?? [])];
  const observedOnly = context.config.mode !== "enforce";

  if (base.policy) {
    evidence.push({
      source: "policy",
      detail: `Matched the approved rule for ${base.policy.host} (${base.policy.action}).`,
    });
  } else {
    evidence.push({
      source: "policy",
      detail: `No approved rule matches ${host ?? subject.destination}.`,
    });
  }

  if (base.purpose) {
    evidence.push({
      source: "consent",
      detail: context.principalKnown === false
        ? `The gating purpose is "${base.purpose}", and this request has no principal to read a decision from.`
        : `The visitor's state for "${base.purpose}" is ${base.user_state}.`,
    });
  }

  if (context.policyVersion) {
    evidence.push({
      source: "config",
      detail: `Judged against approved configuration ${context.policyVersion}.`,
    });
  } else {
    evidence.push({
      source: "config",
      detail: "No approved configuration; the rules in force are not an approved set.",
    });
  }

  const common = {
    effect: base.decision as FirewallEffect,
    destination: subject.destination,
    host,
    vendor: subject.vendor ?? base.vendor,
    purpose: subject.purpose ?? base.purpose,
    userState: base.user_state,
    matchedRule: base.policy,
    policyVersion: context.policyVersion,
    evidence,
    redactions,
    source: subject.source,
    observedOnly,
    legalAdvice: false as const,
  };

  // Not an http(s) destination. No rule can reach it, and saying REVIEW would
  // put a `data:` URI in an operator's queue forever.
  if (host === null) {
    return {
      ...common,
      decision: "ALLOW",
      reason: base.reason,
      severity: "info",
    };
  }

  // A server path with a principal it cannot read is not the same as a visitor
  // who declined. It is a gate that cannot be evaluated, and the fail-safe is
  // to treat the gate as unsatisfied rather than to wave it through.
  const unreadablePrincipal =
    context.principalKnown === false && base.policy?.action === "require_consent";

  if (base.policy?.action === "require_consent") {
    if (base.decision === "allow" && !unreadablePrincipal) {
      return {
        ...common,
        decision: redactions.length > 0 ? "REDACT" : "ALLOW",
        reason:
          redactions.length > 0
            ? `${base.reason} Configured fields are removed before it is sent.`
            : base.reason,
        severity: "info",
      };
    }
    return {
      ...common,
      effect: "block",
      decision: "REQUIRE_CONSENT",
      reason: unreadablePrincipal
        ? `${base.policy.vendor} requires consent for "${base.policy.purpose}" and this request carries no principal whose decision could be read. Treated as unsatisfied.`
        : base.reason,
      severity: base.user_state === "denied_or_withdrawn" ? "high" : "medium",
    };
  }

  if (base.decision === "block") {
    return {
      ...common,
      decision: "BLOCK",
      reason: base.reason,
      severity: "high",
    };
  }

  // Allowed, and no rule matched: the honest classification is that nobody has
  // looked at this host, not that it was approved.
  if (!base.policy) {
    return {
      ...common,
      decision: "REVIEW",
      reason: base.reason,
      // Not a fault. It is a task, and a queue where every row is red is one
      // people stop reading.
      severity: "low",
    };
  }

  return {
    ...common,
    decision: redactions.length > 0 ? "REDACT" : "ALLOW",
    reason:
      redactions.length > 0
        ? `${base.reason} Configured fields are removed before it is sent.`
        : base.reason,
    severity: "info",
  };
}
