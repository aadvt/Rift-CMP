import {
  evaluateFirewall,
  redact,
  validateRedactionConfig,
  type FirewallResult,
  type FirewallSubject,
  type RedactableRequest,
  type RedactionApplication,
  type RedactionConfig,
} from "@rift-cmp/shared";
import type { EnforcementConfig } from "@rift-cmp/shared";
import {
  getApprovedPolicyVersion,
  getEffectiveConsent,
  hostsForVendor,
  prisma,
  recordEnforcementEvents,
  type EnforcementEventInput,
} from "database";
import { enforcementFrom } from "./consent-config";

/**
 * The server-side integration point for the consent firewall.
 *
 * ## Which requests this can actually reach
 *
 * This guards a request the caller is about to make from their own server,
 * through this function. That is the whole scope, and it is worth stating
 * plainly because "consent firewall" invites a much larger reading:
 *
 *  - It **does** cover an outbound call the application routes through
 *    `guardOutboundRequest`. There is no page to patch and nothing a browser
 *    script can undo, so the decision is not bypassable the way the client one
 *    is.
 *  - It **does not** intercept traffic from third-party infrastructure. If a
 *    vendor's own servers call another vendor, or a customer's warehouse
 *    forwards data on a schedule, nothing here sees it. Rift is not on that
 *    path and cannot claim to be.
 *  - It **does not** intercept the customer's other outbound calls. Code that
 *    calls `fetch` directly bypasses this by construction — this is a library,
 *    not a network proxy, and presenting it as one would be the "fake firewall
 *    that only logs a decision" the brief warns against.
 *
 * What makes it worth having anyway is that it is the one plane where a BLOCK
 * genuinely means the bytes did not leave, and where redaction can happen at all
 * — a browser patch can stop a request, but it cannot rewrite a payload a tag
 * assembled inside its own closure.
 *
 * ## No second evaluator
 *
 * The decision comes from `evaluateFirewall` in `@rift-cmp/shared`, which is the
 * same function, running the same rules, that the browser SDK runs. This module
 * supplies the inputs — the approved configuration, the visitor's recorded
 * decisions — and does not decide anything itself.
 */

export interface GuardInput {
  organisationId: string;
  siteId: string;
  /** The request the application intends to make. */
  request: RedactableRequest;
  /**
   * The visitor this request is on behalf of, where there is one.
   *
   * Omitting it is honest and has consequences: a consent gate with no principal
   * to read cannot be satisfied, and the firewall treats it as unsatisfied
   * rather than waving it through. A server job with no visitor should either
   * carry the principal id it is acting for, or expect gated vendors to block.
   */
  principalExternalId?: string;
  vendor?: string | null;
  purpose?: string | null;
  dataCategories?: readonly string[];
  jurisdictions?: readonly string[];
  /** Rules for this call. Validated before anything is applied. */
  redaction?: RedactionConfig;
  /** Skip persisting the decision. For a dry run from the evaluation API. */
  record?: boolean;
}

export interface GuardOutcome {
  decision: FirewallResult;
  /**
   * The request to send, already redacted — or null when it must not be sent.
   *
   * Null on BLOCK and REQUIRE_CONSENT, and also when redaction refused a payload
   * it could not fully walk. A payload we could not finish walking is one we
   * cannot claim to have redacted, and sending it unmodified while reporting
   * "REDACT" would be the worst outcome available.
   */
  send: RedactableRequest | null;
  /**
   * What redaction did, as structure only: rule ids and paths, never values.
   *
   * Safe to return to the caller and safe to log, which is the whole reason it
   * is shaped this way rather than as a diff.
   */
  redactionApplied: RedactionApplication[];
  /** Set when the caller's redaction rules were rejected. Nothing was sent. */
  configProblems: string[];
}

/** The approved configuration and the visitor's state, as one read. */
async function loadContext(input: GuardInput): Promise<{
  config: EnforcementConfig;
  policyVersion: string | null;
  granted: Set<string>;
  decided: Set<string>;
  principalKnown: boolean;
}> {
  const approved = await getApprovedPolicyVersion(
    prisma,
    input.organisationId,
    input.siteId,
  );

  // Derived with `enforcementFrom`, which is the same function the config route
  // hands to the browser. Rules are not stored: they are computed from the
  // approved recommendations, and computing them a second way here would be the
  // second evaluator this whole design exists to avoid.
  const config: EnforcementConfig = approved
    ? enforcementFrom(approved.recommendations, hostsForVendor)
    : // No approved configuration is not the same as an empty one. With no rules
      // every host is unmatched, which the firewall reports as REVIEW rather
      // than as an approval - so the absence stays visible.
      { mode: "observe", rules: [], unknown_host: "allow" };

  const granted = new Set<string>();
  const decided = new Set<string>();
  let principalKnown = false;

  if (input.principalExternalId) {
    const effective = await getEffectiveConsent(prisma, {
      siteId: input.siteId,
      principalExternalId: input.principalExternalId,
    });
    if (effective) {
      principalKnown = true;
      for (const state of effective.effective) {
        decided.add(state.purpose_code);
        if (state.status === "GRANTED") granted.add(state.purpose_code);
      }
    }
    // A principal id that names nobody leaves `principalKnown` false. That is
    // the correct reading: we were given an identity and found no decisions, so
    // a gate on this request cannot be shown to be satisfied.
  }

  return {
    config,
    policyVersion: approved ? String(approved.version) : null,
    granted,
    decided,
    principalKnown,
  };
}

/**
 * Evaluate one outbound request and return what may actually be sent.
 *
 * Never dispatches the request. The caller does that, with what comes back —
 * which keeps this testable without a network, and keeps the decision separable
 * from the transport in a way an operator can audit.
 */
export async function guardOutboundRequest(input: GuardInput): Promise<GuardOutcome> {
  const problems = input.redaction ? validateRedactionConfig(input.redaction) : [];
  if (problems.length > 0) {
    // A rule set that does not validate is not applied, and the request does not
    // go. The alternative - sending it unredacted because the config was wrong -
    // is a silent failure in the one direction that matters.
    const context = await loadContext(input);
    const decision = evaluateFirewall(subjectFrom(input), {
      config: context.config,
      granted: context.granted,
      decided: context.decided,
      policyVersion: context.policyVersion,
      principalKnown: context.principalKnown,
    });

    return {
      decision: {
        ...decision,
        effect: "block",
        decision: "BLOCK",
        reason: "Redaction rules were rejected, so nothing was sent.",
      },
      send: null,
      redactionApplied: [],
      configProblems: problems.map((p) => `${p.ruleId ?? "rule"}: ${p.message}`),
    };
  }

  const context = await loadContext(input);

  const redaction = input.redaction
    ? redact(input.request, input.redaction)
    : null;

  const decision = evaluateFirewall(subjectFrom(input), {
    config: context.config,
    granted: context.granted,
    decided: context.decided,
    policyVersion: context.policyVersion,
    principalKnown: context.principalKnown,
    ...(redaction ? { redactions: [...new Set(redaction.applied.map((a) => a.ruleId))] } : {}),
  });

  let send: RedactableRequest | null = null;
  if (decision.effect === "allow") {
    if (redaction?.refused) {
      // Could not finish walking it, so cannot claim to have redacted it.
      send = null;
    } else if (redaction) {
      send = { url: redaction.url, body: redaction.body, headers: redaction.headers };
    } else {
      send = input.request;
    }
  }

  if (input.record !== false) {
    await persist(input, decision, redaction?.applied ?? []);
  }

  return {
    decision:
      redaction?.refused && decision.effect === "allow"
        ? {
            ...decision,
            decision: "BLOCK",
            effect: "block",
            reason: `${redaction.refusedReason} Nothing was sent, because a payload that could not be fully walked cannot be reported as redacted.`,
          }
        : decision,
    send,
    redactionApplied: redaction?.applied ?? [],
    configProblems: [],
  };
}

function subjectFrom(input: GuardInput): FirewallSubject {
  return {
    organisationId: input.organisationId,
    siteId: input.siteId,
    destination: input.request.url,
    source: "server",
    ...(input.vendor === undefined ? {} : { vendor: input.vendor }),
    ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    ...(input.dataCategories ? { dataCategories: input.dataCategories } : {}),
    ...(input.jurisdictions ? { jurisdictions: input.jurisdictions } : {}),
  };
}

/** Turn a decision into a log row, dropping everything that identifies anyone. */
export function toEnforcementEvent(
  organisationId: string,
  siteId: string,
  decision: FirewallResult,
  redactions: ReadonlyArray<{ ruleId: string; location: string; path: string }>,
): EnforcementEventInput {
  return {
    organisationId,
    siteId,
    source: decision.source,
    // Host, never the URL. The URL carries a query string and the query string
    // carries the values redaction exists to remove.
    destinationHost: decision.host,
    vendor: decision.vendor,
    purpose: decision.purpose,
    decision: decision.decision,
    effect: decision.effect,
    observedOnly: decision.observedOnly,
    policyVersion: decision.policyVersion,
    matchedRule: decision.matchedRule
      ? { host: decision.matchedRule.host, action: decision.matchedRule.action }
      : null,
    reason: decision.reason,
    severity: decision.severity,
    redactions:
      redactions.length > 0
        ? redactions.map((r) => ({ rule: r.ruleId, location: r.location, path: r.path }))
        : null,
  };
}

async function persist(
  input: GuardInput,
  decision: FirewallResult,
  redactions: ReadonlyArray<{ ruleId: string; location: string; path: string }>,
): Promise<void> {
  try {
    await recordEnforcementEvents(prisma, [
      toEnforcementEvent(input.organisationId, input.siteId, decision, redactions),
    ]);
  } catch {
    // A failure to write the audit row must not fail the request the operator
    // asked us to guard. The decision has already been taken and applied; losing
    // the log line is the lesser harm, and a lost line is visible as a gap.
  }
}
