import type {
  AutopilotIntelligence,
  DriftFinding,
  EnrichedRecommendation,
  ShadowTracker,
  VendorRecommendation,
} from "@rift-cmp/shared";
import type { AiAssistance } from "./ai/assist";

/**
 * The existing recommendations, ordered by what the evidence says is urgent.
 *
 * This is not a second recommendation engine. `generatePolicy` still decides
 * what each vendor's recommendation is; this decides which of them a person
 * should look at first, and attaches the findings and commentary that explain
 * why. The deterministic recommendation travels through untouched.
 *
 * ## Priority comes from evidence, not from the model
 *
 * A model may reorder within the noise, but the ranking is computed from
 * severity, page count and whether anything is unresolved — facts that hold
 * whether or not a provider is configured. Letting a model set the order would
 * mean the list changed when the API key did, which is not a property anyone
 * wants in a privacy tool.
 */

const SEVERITY_SCORE: Record<string, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
  info: 0,
};

export function buildAutopilotIntelligence(input: {
  siteId: string;
  recommendations: VendorRecommendation[];
  shadowTrackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Pages each vendor was seen on, keyed by detector id or host. */
  pagesByVendor?: Map<string, string[]>;
  assistance: AiAssistance | null;
  aiConfigured: boolean;
  now?: Date;
}): AutopilotIntelligence {
  const notes = new Map((input.assistance?.vendors ?? []).map((v) => [v.detector_id, v]));

  const enriched: EnrichedRecommendation[] = input.recommendations.map((rec) => {
    const shadow = input.shadowTrackers.filter(
      (s) => s.id === rec.detector_id || s.vendor === rec.vendor_name,
    );
    const drift = input.drift.filter(
      (d) => d.vendor === rec.vendor_name || d.host === rec.vendor_name,
    );
    const pages = input.pagesByVendor?.get(rec.detector_id) ?? [];

    let priority = 0;
    const reasons: string[] = [];

    for (const finding of shadow) {
      priority += SEVERITY_SCORE[finding.severity] ?? 0;
    }
    for (const finding of drift) {
      priority += (SEVERITY_SCORE[finding.severity] ?? 0) / 2;
    }

    if (shadow.some((s) => s.reason === "blocked_but_observed")) {
      reasons.push("Configured to be blocked and still observed running.");
    }
    if (shadow.some((s) => s.reason === "not_configured")) {
      reasons.push("Observed on the site and absent from the approved configuration.");
    }
    if (drift.some((d) => d.kind === "tracker_added")) {
      reasons.push("Appeared since the previous scan.");
    }
    if (rec.recommended_action === "review") {
      priority += 25;
      reasons.push("The engine would not decide this one; it needs a person.");
    }
    if (rec.confidence === "low") {
      priority += 15;
      reasons.push("Classified with low confidence.");
    }
    if (pages.length > 1) {
      // Breadth matters: one vendor on fourteen pages is a bigger decision than
      // the same vendor on one.
      priority += Math.min(20, pages.length);
      reasons.push(`Observed on ${pages.length} pages.`);
    }

    const note = notes.get(rec.detector_id);

    return {
      recommendation: rec,
      priority,
      priority_reason:
        reasons[0] ?? "No findings against this one. Included so the list is complete.",
      shadow_trackers: shadow,
      drift,
      observed_on_pages: pages,
      ai: note
        ? {
            provider: input.assistance?.provider ?? "unknown",
            model: input.assistance?.model ?? "unknown",
            advisory: true,
            suggested_category: note.suggested_category,
            reasoning: note.reasoning,
            confidence: note.confidence,
            ambiguous: note.ambiguous,
          }
        : null,
    };
  });

  enriched.sort(
    (a, b) =>
      b.priority - a.priority ||
      String((a.recommendation as VendorRecommendation).vendor_name).localeCompare(
        String((b.recommendation as VendorRecommendation).vendor_name),
      ),
  );

  return {
    site_id: input.siteId,
    generated_at: (input.now ?? new Date()).toISOString(),
    recommendations: enriched,
    ai_summary: input.assistance?.explanation
      ? {
          provider: input.assistance.provider,
          model: input.assistance.model,
          advisory: true,
          ...input.assistance.explanation,
        }
      : null,
    ai_configured: input.aiConfigured,
    requires_approval: true,
    legal_advice: false,
  };
}
