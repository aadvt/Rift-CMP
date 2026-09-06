import type { NextRequest } from "next/server";
import { z } from "zod";
import type { ScenarioComparisonResponse, SimulationResponse } from "@rift-cmp/shared/simulation";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation";
import { gatherSiteEvidence } from "@/lib/intelligence-inputs";
import { buildSiteIntelligence } from "@/lib/intelligence";
import { computeConsentQuality } from "@/lib/consent-quality";
import { simulateWithDerived } from "@/lib/simulation";
import { buildConsentGraph } from "@/lib/graph";
import { gatherGraph } from "@/lib/graph-inputs";

/**
 * Run a scenario. Change nothing.
 *
 * **Management plane only.**
 *
 * `POST` because a scenario is a body rather than a query string, and not
 * because anything is created. Nothing is: this route reads, computes and
 * returns. There is no scenario table, no draft policy row, no persisted result,
 * and no write of any kind on this path.
 *
 * That is deliberate and it costs something real — scenarios cannot be saved,
 * shared by link, or reopened tomorrow. The trade is worth it. A simulator that
 * writes anywhere is one somebody eventually points at production, and the
 * guarantee that matters here (*running this changed nothing*) becomes a
 * property of review rather than of the architecture.
 *
 * ## Applying
 *
 * There is no apply action, here or in the UI. Changing a site goes through the
 * ordinary configuration workflow with its own authorisation and its own human
 * approval. A shortcut from this screen would be a policy bypass wearing a
 * different name, however much confirmation it asked for.
 */
const changeSchema = z.object({
  operation: z.enum([
    "add_tracker",
    "remove_tracker",
    "reclassify_tracker",
    "add_jurisdiction",
    "remove_jurisdiction",
    "set_enforcement",
    "set_enforcement_mode",
  ]),
  tracker: z.string().max(256).optional(),
  vendor: z.string().max(256).optional(),
  category: z.string().max(128).optional(),
  page: z.string().max(2048).optional(),
  jurisdiction: z.string().max(32).optional(),
  action: z.string().max(32).optional(),
  mode: z.string().max(16).optional(),
});

const bodySchema = z.object({
  scenario_name: z.string().min(1).max(200),
  // A scenario is a handful of changes somebody is reasoning about. A hundred
  // is not a scenario, it is a migration, and it belongs in the configuration
  // workflow rather than here.
  changes: z.array(changeSchema).max(25),
  /** Return the hypothetical graph beside the live one. */
  include_graph: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const evidence = await gatherSiteEvidence(auth.caller.organisationId, siteId);

  // The site's real score, computed exactly as the quality endpoint computes it,
  // so the "current" half of the comparison is the number the operator already
  // sees elsewhere rather than a second opinion about it.
  const intelligence = buildSiteIntelligence({
    siteId,
    scanId: evidence.scanId,
    baselineScanId: evidence.baselineScanId,
    results: evidence.results,
    baseline: evidence.baseline,
    approved: evidence.approved,
    policyVersion: evidence.policyVersion,
    runtime: evidence.runtime,
  });

  const active = evidence.purposes.filter((p) => p.is_active);
  const declaredCodes = new Set(active.map((p) => p.code));
  const undeclared = new Set(
    evidence.approved
      .map((r) => r.suggested_purpose)
      .filter((code): code is string => Boolean(code) && !declaredCodes.has(code as string)),
  );

  const currentQuality = computeConsentQuality({
    siteId,
    declaredPurposes: active.length,
    undeclaredPurposes: undeclared.size,
    approved: evidence.approved,
    proposed: evidence.approved,
    hasApprovedPolicy: evidence.policyVersion !== null,
    enforcementMode: website.analyticsConsentPurpose ? "enforce" : "observe",
    enforcementRules: evidence.approved.filter(
      (r) => r.recommended_action === "require_consent" || r.recommended_action === "block",
    ).length,
    lastCompletedScanAt: evidence.lastCompletedScanAt,
    shadowTrackers: intelligence.shadow_trackers,
    drift: intelligence.drift,
    jurisdictions: evidence.jurisdictions,
    decisions: evidence.decisions,
    decisionsWithProof: evidence.decisionsWithProof,
  });

  const { result: simulation, derived } = simulateWithDerived({
    siteId,
    scenarioName: input.scenario_name,
    evidence,
    changes: input.changes,
    currentQuality: {
      score: currentQuality.score,
      band: currentQuality.band,
      components: currentQuality.components.map((c) => ({
        id: c.id,
        label: c.label,
        earned: c.earned,
      })),
    },
  });

  if (!input.include_graph) {
    const body: SimulationResponse = { simulation };
    return Response.json(body, { status: 200 });
  }

  // Live and simulated, side by side and never merged. Mixing hypothetical
  // nodes into the production graph is the one presentation this feature must
  // not offer.
  const { graph: live, input: graphInput } = await gatherGraph(
    auth.caller.organisationId,
    siteId,
    website.domain,
  );

  // Drawn from the arrays the scenario actually produced, not recomputed here.
  // A second evaluation would be a second chance to disagree with the numbers
  // sitting next to it.
  const simulated = buildConsentGraph({
    ...graphInput,
    approved: derived.recommendations,
    jurisdictions: derived.jurisdictions,
    shadowTrackers: derived.shadowTrackers,
    drift: derived.drift,
  });

  const body: ScenarioComparisonResponse = { live, simulated, simulation };
  return Response.json(body, { status: 200 });
}
