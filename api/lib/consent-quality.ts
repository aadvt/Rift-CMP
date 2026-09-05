import type {
  ConsentQualityScore,
  QualityComponent,
  QualityComponentId,
  VendorRecommendation,
} from "@rift-cmp/shared";
import { QUALITY_WEIGHTS, bandFor } from "@rift-cmp/shared";
import type { DriftFinding, ShadowTracker } from "@rift-cmp/shared";

/**
 * A posture score, computed from evidence and arguable line by line.
 *
 * Pure over gathered inputs, so every component can be tested on a literal and
 * the reason a score moved is visible in the arguments rather than buried in a
 * query.
 *
 * ## Absent input is not a failing grade
 *
 * A site nobody has scanned has no tracker resolution to measure. Scoring that
 * zero would say "you have unresolved trackers" when the truth is "nobody has
 * looked", which sends an operator to fix the wrong thing. Those components are
 * marked `applicable: false`, excluded from the denominator, and listed — so a
 * high score on a thin deployment cannot hide behind the components it skipped.
 *
 * ## Acceptance rate is deliberately absent
 *
 * A site with no banner accepts 100% of the time. Rewarding that would make the
 * score go up as the consent experience got worse.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Beyond this a scan is too old to describe the site as it is now. */
const SCAN_STALE_DAYS = 30;

export interface QualityInput {
  siteId: string;
  /** Purposes the organisation has declared. */
  declaredPurposes: number;
  /** Purposes referenced by the generated policy that nobody has declared. */
  undeclaredPurposes: number;
  /** Recommendations in the approved version, or empty when none is approved. */
  approved: VendorRecommendation[];
  /** Recommendations the engine currently proposes, approved or not. */
  proposed: VendorRecommendation[];
  hasApprovedPolicy: boolean;
  /** `off` | `observe` | `enforce`, from the runtime configuration. */
  enforcementMode: string | null;
  /** Hosts the runtime is configured to act on. */
  enforcementRules: number;
  lastCompletedScanAt: Date | null;
  shadowTrackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Jurisdictions the approved policy was generated under. */
  jurisdictions: string[];
  /** Consent decisions in the recent window, and how many carry a proof hash. */
  decisions: number;
  decisionsWithProof: number;
  now?: Date;
}

interface Draft {
  id: QualityComponentId;
  label: string;
  ratio: number | null;
  applicable: boolean;
  detail: string;
  remedy: string | null;
}

/** Severity weighting: one critical finding should hurt more than four trivial ones. */
function severityCost(findings: Array<{ severity: string }>): number {
  const cost = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as Record<string, number>;
  return findings.reduce((sum, f) => sum + (cost[f.severity] ?? 1), 0);
}

function components(input: QualityInput): Draft[] {
  const now = input.now ?? new Date();
  const proposed = input.proposed.length;

  // ── Is there a decision at all, and does it cover what was found? ──────────
  const covered = input.approved.length;
  const consentCoverage: Draft = input.hasApprovedPolicy
    ? {
        id: "consent_coverage",
        label: "Consent coverage",
        ratio: proposed === 0 ? 1 : Math.min(1, covered / proposed),
        applicable: true,
        detail: `${covered} of ${proposed || covered} observed technologies are covered by an approved configuration.`,
        remedy:
          covered >= proposed
            ? null
            : "Accept the current configuration so the technologies found since your last approval are covered.",
      }
    : {
        id: "consent_coverage",
        label: "Consent coverage",
        ratio: 0,
        applicable: true,
        detail: "No configuration has been approved for this site.",
        remedy: "Review and accept the generated configuration.",
      };

  // ── Can the configuration actually be applied? ────────────────────────────
  const policyCompleteness: Draft = {
    id: "policy_completeness",
    label: "Policy completeness",
    ratio:
      input.declaredPurposes === 0
        ? 0
        : input.undeclaredPurposes === 0
          ? 1
          : Math.max(0, 1 - input.undeclaredPurposes / (input.declaredPurposes + input.undeclaredPurposes)),
    applicable: true,
    detail:
      input.declaredPurposes === 0
        ? "No purposes are declared, so the banner has nothing to ask about."
        : `${input.undeclaredPurposes} purpose(s) referenced by the configuration are not declared.`,
    remedy:
      input.declaredPurposes > 0 && input.undeclaredPurposes === 0
        ? null
        : "Declare the missing purposes on Configure. Only you know which of your purposes covers which vendor.",
  };

  // ── Does anything actually act on the decision? ───────────────────────────
  const mode = input.enforcementMode ?? "off";
  const enforcement: Draft = {
    id: "enforcement_coverage",
    label: "Enforcement coverage",
    // `observe` earns partial marks on purpose: it is the correct first step,
    // and scoring it as zero would push operators to switch straight to
    // enforce, which is the one change most likely to break a checkout.
    ratio: mode === "enforce" ? (input.enforcementRules > 0 ? 1 : 0.5) : mode === "observe" ? 0.5 : 0,
    applicable: true,
    detail:
      mode === "off"
        ? "The runtime is not enforcing or observing."
        : `Enforcement is ${mode} across ${input.enforcementRules} host rule(s).`,
    remedy:
      mode === "enforce" && input.enforcementRules > 0
        ? null
        : mode === "observe"
          ? "Observe mode reports what would be blocked without blocking. Once the report looks right, switch to enforce."
          : "Turn on observe mode to see what would be blocked, before enforcing anything.",
  };

  // ── How much of what was found has been decided about? ────────────────────
  const unresolved = input.proposed.filter(
    (r) => !r.overridden && (r.recommended_action === "review" || r.confidence === "low"),
  ).length;
  const trackerResolution: Draft =
    proposed === 0
      ? {
          id: "tracker_resolution",
          label: "Tracker resolution",
          ratio: null,
          applicable: false,
          detail: "No technologies have been found yet, so there is nothing to resolve.",
          remedy: null,
        }
      : {
          id: "tracker_resolution",
          label: "Tracker resolution",
          ratio: Math.max(0, 1 - unresolved / proposed),
          applicable: true,
          detail: `${unresolved} of ${proposed} technologies are still waiting on a decision.`,
          remedy: unresolved === 0 ? null : "Classify the remaining technologies, or leave them unresolved deliberately.",
        };

  // ── Is anything running that nobody accounted for? ────────────────────────
  const shadowCost = severityCost(input.shadowTrackers);
  const shadow: Draft = {
    id: "shadow_trackers",
    label: "Shadow trackers",
    // A ceiling of twelve severity points is a full deduction. Past that the
    // component is already zero and further findings change nothing — the score
    // has said what it can and the list is where the detail lives.
    ratio: Math.max(0, 1 - shadowCost / 12),
    applicable: true,
    detail:
      input.shadowTrackers.length === 0
        ? "Nothing observed that the configuration does not account for."
        : `${input.shadowTrackers.length} technology/ies observed that the configuration does not account for.`,
    remedy: input.shadowTrackers.length === 0 ? null : "Work through the shadow tracker list, worst first.",
  };

  // ── Is what we know about the site still true? ────────────────────────────
  const scan: Draft = input.lastCompletedScanAt
    ? (() => {
        const days = (now.getTime() - input.lastCompletedScanAt.getTime()) / DAY_MS;
        return {
          id: "scanner_freshness" as const,
          label: "Scanner freshness",
          ratio: Math.max(0, Math.min(1, 1 - days / SCAN_STALE_DAYS)),
          applicable: true,
          detail: `Last completed scan was ${Math.floor(days)} day(s) ago.`,
          remedy: days < 7 ? null : "Run a scan. Findings older than a month describe a site that may have moved on.",
        };
      })()
    : {
        id: "scanner_freshness",
        label: "Scanner freshness",
        ratio: 0,
        applicable: true,
        detail: "This site has never been scanned.",
        remedy: "Run a scan so the rest of this score has something to describe.",
      };

  // ── Has the site moved away from what was approved? ───────────────────────
  const driftCost = severityCost(input.drift);
  const drift: Draft = {
    id: "drift_risk",
    label: "Drift risk",
    ratio: Math.max(0, 1 - driftCost / 10),
    applicable: true,
    detail:
      input.drift.length === 0
        ? "No differences between the site and the approved configuration."
        : `${input.drift.length} difference(s) between the site and what was approved.`,
    remedy: input.drift.length === 0 ? null : "Review the changes and re-approve the configuration if they are expected.",
  };

  const jurisdiction: Draft = {
    id: "jurisdiction_coverage",
    label: "Jurisdiction coverage",
    ratio: input.jurisdictions.length > 0 ? 1 : 0,
    applicable: true,
    detail:
      input.jurisdictions.length > 0
        ? `Configuration generated under ${input.jurisdictions.join(", ")}.`
        : "No markets declared, so no regulations were resolved.",
    remedy:
      input.jurisdictions.length > 0
        ? null
        : "Declare the markets you serve. Without them the engine resolves nothing and leaves every question open.",
  };

  // ── Can a decision be proved later? ───────────────────────────────────────
  const proof: Draft =
    input.decisions === 0
      ? {
          id: "proof_completeness",
          label: "Proof completeness",
          ratio: null,
          applicable: false,
          detail: "No consent decisions recorded yet, so there is nothing to prove.",
          remedy: null,
        }
      : {
          id: "proof_completeness",
          label: "Proof completeness",
          ratio: input.decisionsWithProof / input.decisions,
          applicable: true,
          detail: `${input.decisionsWithProof} of ${input.decisions} decisions carry a receipt.`,
          remedy:
            input.decisionsWithProof >= input.decisions
              ? null
              : "Decisions recorded before receipts existed cannot be backfilled — a receipt for evidence nobody captured would be worthless. New decisions carry one.",
        };

  return [
    consentCoverage,
    policyCompleteness,
    enforcement,
    trackerResolution,
    shadow,
    scan,
    drift,
    jurisdiction,
    proof,
  ];
}

export function computeConsentQuality(input: QualityInput): ConsentQualityScore {
  const drafts = components(input);

  const scored: QualityComponent[] = drafts.map((d) => {
    const weight = QUALITY_WEIGHTS[d.id];
    return {
      id: d.id,
      label: d.label,
      ratio: d.ratio,
      weight,
      earned: d.applicable && d.ratio !== null ? Math.round(d.ratio * weight * 100) / 100 : 0,
      applicable: d.applicable,
      detail: d.detail,
      remedy: d.remedy,
    };
  });

  const applicable = scored.filter((c) => c.applicable);
  const weightConsidered = applicable.reduce((sum, c) => sum + c.weight, 0);
  const earned = applicable.reduce((sum, c) => sum + c.earned, 0);

  // Out of what applied, not out of a hundred that included components with no
  // input. A site with nothing to measure would otherwise score zero and read
  // as failing when the truth is that it has not started.
  const score = weightConsidered === 0 ? 0 : Math.round((earned / weightConsidered) * 100);

  return {
    site_id: input.siteId,
    score,
    band: bandFor(score),
    components: scored,
    not_applicable: scored.filter((c) => !c.applicable).map((c) => c.id),
    weight_considered: weightConsidered,
    computed_at: (input.now ?? new Date()).toISOString(),
    legal_advice: false,
  };
}
