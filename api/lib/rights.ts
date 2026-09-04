/**
 * Which privacy controls apply, and on what authority.
 *
 * Phase 10A's hardest instruction is *do not pretend one universal rights
 * workflow exists across every jurisdiction*, and the matrix agrees with it
 * emphatically. The regimes do not offer the same rights:
 *
 *   GDPR    access, rectification, erasure, restriction, portability, objection
 *   CCPA    know, deletion, opt out of sale, opt out of sharing, non-discrimination
 *   DPDP    access, correction, erasure, **grievance redressal**
 *   LGPD    confirmation, access, correction, deletion, portability - and
 *           `REQ-BR-LGPD-016` says outright that it creates no CCPA-style
 *           universal sale opt-out
 *
 * So the available controls are derived per request from the jurisdictions in
 * play, and the derivation is keyed on **canonical topic**, never on a regime.
 * No regime name appears in this file, for the same reason none appears in
 * `policy/disposition.ts`: "a rights obligation means offer a rights mechanism"
 * is not a fact about the GDPR, and a per-regime branch here would put the
 * platform back in the business of deciding which rights exist.
 *
 * ## What the matrix can and cannot tell us
 *
 * It can tell us a regime *has* a rights obligation, and cite the requirement.
 * It cannot tell us which specific rights, because the requirement records that
 * in prose - `REQ-GDPR-007` names six of them in a sentence - and no structured
 * field enumerates them.
 *
 * Parsing that sentence would be inventing structure the research does not
 * have, and hard-coding "GDPR grants portability" would move legal content into
 * code where no lawyer will read it. So this reports a control as `indicated`
 * when an obligation of the right *family* was found, `unknown` when the matrix
 * says nothing, and carries the requirement text alongside so a person can
 * read what was actually cited. That distinction is the honest one, and it is
 * why nothing here says a right definitely exists.
 *
 * Research artifact, not legal advice. See docs/privacy-rights.md.
 */

import {
  evaluate,
  resolveJurisdictions,
  WEBSITE_OPERATOR_ROLES,
  type DetectedLocation,
  type Jurisdiction,
} from "@rift-cmp/policy";

/**
 * The controls a person might be offered.
 *
 * A fixed catalogue of *mechanisms*, not of rights. Each is something an
 * operator can build a workflow for; whether a given regime confers it is what
 * the engine is asked.
 */
export const RIGHTS_CONTROLS = [
  "review",
  "withdraw",
  "access",
  "correction",
  "deletion",
  "export",
  "objection",
  "restriction",
  "opt_out_sale",
  "opt_out_sharing",
  "complaint",
  "appeal",
  "non_discrimination",
] as const;

export type RightsControl = (typeof RIGHTS_CONTROLS)[number];

/**
 * Canonical topic → the controls an obligation on that topic indicates.
 *
 * The whole regime-independence of this module lives in this table. It is
 * about topics, and topics belong to the vocabulary rather than to any law.
 */
const TOPIC_INDICATES: Partial<Record<string, readonly RightsControl[]>> = {
  // A rights obligation indicates the request family. Which of them a specific
  // regime confers is in the requirement's prose, which is carried through as
  // evidence rather than parsed.
  rights: ["access", "correction", "deletion", "export", "objection", "restriction", "appeal"],
  withdrawal: ["withdraw"],
  sale_and_sharing: ["opt_out_sale", "opt_out_sharing"],
  opt_out_signals: ["opt_out_sale", "opt_out_sharing"],
  non_discrimination: ["non_discrimination"],
  // Grievance and complaint mechanisms appear under accountability and
  // enforcement in the matrix rather than under rights.
  accountability: ["complaint"],
  enforcement: ["complaint"],
};

export type Availability =
  /** A requirement of this family was found for the jurisdictions in play. */
  | "indicated"
  /** Always offered, regardless of regime. */
  | "always"
  /** The matrix says nothing. Not a finding that the control does not apply. */
  | "unknown";

export interface ControlAvailability {
  control: RightsControl;
  availability: Availability;
  /** Requirement ids that indicated it. Empty for `unknown` and `always`. */
  rule_references: string[];
  /** Regimes those requirements belong to. */
  regimes: string[];
  /** The requirement text, so a person can read what was actually cited. */
  evidence: Array<{ requirement_id: string; regime: string; text: string }>;
  /** Plain-language note. Never a legal characterisation. */
  note: string;
}

export interface RightsAvailability {
  jurisdictions: string[];
  regimes: string[];
  controls: ControlAvailability[];
  /**
   * Everything the engine would not decide. Carried because a control reported
   * `unknown` beside twelve open questions means something different from one
   * reported `unknown` against a settled matrix.
   */
  open_questions: Array<{ reason: string; detail: string }>;
  legal_advice: false;
}

/**
 * Controls offered no matter what the matrix says.
 *
 * `review` and `withdraw` are here because the platform's own design already
 * guarantees them: consent is an append-only log a principal can read back, and
 * `POST /api/v1/consent` has always accepted a withdrawal. Reporting them as
 * `unknown` because no requirement was cited would understate what the product
 * actually does - these are not claims about law, they are claims about Rift.
 */
const ALWAYS: readonly RightsControl[] = ["review", "withdraw"];

export function availableRights(input: {
  locationSignals: readonly DetectedLocation[];
  assertedJurisdictions?: readonly Jurisdiction[];
  asOf: Date;
}): RightsAvailability {
  const resolution = resolveJurisdictions({
    signals: input.locationSignals,
    assertedJurisdictions: input.assertedJurisdictions,
  });

  const decision = evaluate({
    jurisdictions: resolution.jurisdictions,
    actors: WEBSITE_OPERATOR_ROLES,
    asOf: input.asOf,
  });

  // Gather, per control, every requirement whose topic indicates it.
  const byControl = new Map<
    RightsControl,
    { ids: Set<string>; regimes: Set<string>; evidence: ControlAvailability["evidence"] }
  >();

  for (const citation of decision.considered) {
    // A record stating an absence - "this regime creates no such right" - is
    // evidence *against* offering the control, and shares a topic with the
    // records that grant it. Reading it as an indication would offer a
    // Brazilian visitor a sale opt-out the LGPD does not confer.
    if (!citation.applies) continue;
    const indicated = citation.topic ? TOPIC_INDICATES[citation.topic] : undefined;
    if (!indicated) continue;
    for (const control of indicated) {
      const entry =
        byControl.get(control) ??
        { ids: new Set<string>(), regimes: new Set<string>(), evidence: [] };
      if (!entry.ids.has(citation.ruleId)) {
        entry.ids.add(citation.ruleId);
        entry.regimes.add(citation.regime);
        entry.evidence.push({
          requirement_id: citation.ruleId,
          regime: citation.regime,
          text: citation.text,
        });
      }
      byControl.set(control, entry);
    }
  }

  const controls: ControlAvailability[] = RIGHTS_CONTROLS.map((control) => {
    if (ALWAYS.includes(control)) {
      return {
        control,
        availability: "always" as const,
        rule_references: [],
        regimes: [],
        evidence: [],
        note:
          control === "review"
            ? "The consent log is append-only and readable back, so a principal can always review their decisions."
            : "A decision can always be withdrawn. Withdrawal appends a new record; it never rewrites the old one.",
      };
    }

    const found = byControl.get(control);
    if (!found || found.ids.size === 0) {
      return {
        control,
        availability: "unknown" as const,
        rule_references: [],
        regimes: [],
        evidence: [],
        note:
          resolution.jurisdictions.length === 0
            ? "No jurisdiction was given, so nothing was evaluated. This is not a finding that the control does not apply."
            : "No requirement in the matrix indicates this control for the jurisdictions given. The matrix is incomplete, so this is 'not carried', never 'not required'.",
      };
    }

    return {
      control,
      availability: "indicated" as const,
      rule_references: [...found.ids].sort(),
      regimes: [...found.regimes].sort(),
      // Bounded: the point is that a person can read why, not that they read
      // everything.
      evidence: found.evidence.slice(0, 4),
      note:
        "A requirement of this family applies for the jurisdictions given. Which specific rights it confers is in the requirement text, which the matrix records as prose and does not enumerate - so this indicates a control to offer, not a right proven to exist.",
    };
  });

  return {
    jurisdictions: [...resolution.jurisdictions],
    regimes: [...decision.regimes],
    controls,
    open_questions: decision.openQuestions.map((q) => ({
      reason: q.reason,
      detail: q.detail,
    })),
    legal_advice: false,
  };
}

/** The controls a request may be submitted for. `unknown` ones are accepted. */
export function isSubmittableControl(value: string): value is RightsControl {
  return (RIGHTS_CONTROLS as readonly string[]).includes(value);
}

export type { DetectedLocation, Jurisdiction };
