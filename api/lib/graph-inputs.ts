import { listExperiments, listEnforcementEvents, prisma } from "database";
import { gatherSiteEvidence } from "./intelligence-inputs";
import { buildSiteIntelligence } from "./intelligence";
import { buildConsentGraph, type GraphInput } from "./graph";
import type { ConsentGraph } from "@rift-cmp/shared/graph";

/**
 * Everything the graph reads, gathered once.
 *
 * Kept beside `intelligence-inputs.ts` and shaped the same way, for the same
 * reason: two callers need the same evidence, a route module may only export
 * HTTP methods, and duplicating the gathering is how two endpoints end up
 * quietly disagreeing about one site.
 *
 * The gathering is the only part that touches a database. `buildConsentGraph` is
 * a pure function over what comes back, which is what lets the simulator run the
 * identical function over a modified copy and get a comparable answer.
 */
export async function gatherGraph(
  organisationId: string,
  siteId: string,
  siteHost: string,
): Promise<{ graph: ConsentGraph; input: GraphInput }> {
  const evidence = await gatherSiteEvidence(organisationId, siteId);

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

  const [events, experiments] = await Promise.all([
    // Bounded: the graph shows recent enforcement, not the whole log. A site
    // with a million events would otherwise produce a million nodes.
    listEnforcementEvents(prisma, { organisationId, siteId, limit: 200 }),
    listExperiments(prisma, { organisationId, siteId, limit: 25 }),
  ]);

  const input: GraphInput = {
    siteId,
    siteHost,
    scanId: evidence.scanId,
    policyVersion: evidence.policyVersion,
    results: evidence.results,
    approved: evidence.approved,
    purposes: evidence.purposes,
    jurisdictions: evidence.jurisdictions,
    shadowTrackers: intelligence.shadow_trackers,
    drift: intelligence.drift,
    enforcement: events.map((event) => ({
      id: event.id,
      destinationHost: event.destination_host,
      vendor: event.vendor,
      purpose: event.purpose,
      decision: event.decision,
      effect: event.effect,
      observedOnly: event.observed_only,
      reason: event.reason,
      severity: event.severity,
      occurredAt: new Date(event.occurred_at),
      source: event.source,
    })),
    experiments: experiments.map((experiment) => ({
      experiment_id: experiment.experiment_id,
      name: experiment.name,
      status: experiment.status,
      serving: experiment.serving,
      policy_version_id: experiment.policy_version_id,
      variants: experiment.variants.map((v) => ({
        key: v.key,
        name: v.name,
        allocation: v.allocation,
        is_control: v.is_control,
      })),
    })),
  };

  return { graph: buildConsentGraph(input), input };
}
