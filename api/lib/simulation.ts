import type {
  ImpactFinding,
  ProposedChange,
  SimulationResult,
} from "@rift-cmp/shared/simulation";
import { SIMULATION_CAVEATS } from "@rift-cmp/shared/simulation";
import type { VendorRecommendation } from "@rift-cmp/shared";
import type { ScannedTechnology } from "./consent-config";
// Through `autopilot`, not from the engine directly: the policy boundary is an
// allowlist of modules that annotate for a person, and a simulator needing only
// a type name has no claim on it.
import { generatePolicy, type Jurisdiction } from "./autopilot";
import { detectDrift, detectShadowTrackers } from "./intelligence";
import { computeConsentQuality } from "./consent-quality";
import type { SiteEvidence } from "./intelligence-inputs";

/**
 * The simulator.
 *
 * ## It cannot write, because it has nothing to write with
 *
 * This module imports no database client. Not "does not currently call one" —
 * it has no handle to one, and adding a write would mean adding an import that
 * a reviewer would see. The evidence arrives as a value from the caller, is
 * copied, is modified, and is fed back through the same deterministic engines
 * production uses. The result is a value.
 *
 * That is the whole immutability argument, and it is worth more than any number
 * of tests asserting that nothing changed: a test proves nothing changed on the
 * paths it exercised, and this proves there is no path.
 *
 * ## It reuses the real engines
 *
 * `generatePolicy` is the same function that produces a real recommendation.
 * `detectShadowTrackers`, `detectDrift` and `computeConsentQuality` are the same
 * ones the intelligence endpoints call. A simulation that used a simplified
 * model would disagree with production about the same facts while looking
 * exactly as authoritative, which is worse than not offering one.
 *
 * ## Unsupported changes are reported, not ignored
 *
 * An operation the architecture cannot evaluate comes back in `unsupported`
 * with a reason. Silently dropping it would produce a result that looks like an
 * answer to the question asked and is an answer to a different one.
 */

/** A copy of the evidence, safe to modify. Never the caller's object. */
interface Hypothetical {
  technologies: ScannedTechnology[];
  jurisdictions: string[];
  /** Approved actions overridden by the scenario, by vendor name. */
  actionOverrides: Map<string, string>;
  enforcementMode: "off" | "observe" | "enforce" | null;
}

function copyEvidence(evidence: SiteEvidence): Hypothetical {
  // The engine takes name, category and confidence - nothing more. Copying the
  // richer scan row would suggest the simulation reasons about destinations or
  // evidence, and it does not: the category is what drives the purpose and the
  // consent finding.
  return {
    technologies: (evidence.results?.technologies ?? []).map((tech) => ({
      name: tech.name,
      category: tech.category,
      confidence: (tech.confidence === "high" || tech.confidence === "medium"
        ? tech.confidence
        : "low") as ScannedTechnology["confidence"],
    })),
    jurisdictions: [...evidence.jurisdictions],
    actionOverrides: new Map(),
    enforcementMode: null,
  };
}

export interface SimulationInput {
  siteId: string;
  scenarioName: string;
  evidence: SiteEvidence;
  changes: readonly ProposedChange[];
  /** The site's real quality score and the inputs it was computed from. */
  currentQuality: { score: number; band: string; components: Array<{ id: string; label: string; earned: number }> };
  now?: Date;
}

/**
 * What the scenario produced, beside the report about it.
 *
 * The graph endpoint needs the hypothetical recommendation set and jurisdiction
 * list to draw the simulated picture. Recomputing them there would be a second
 * evaluation of the same scenario, and two evaluations are two chances to
 * disagree — so the one that produced the numbers hands them over.
 */
export interface SimulationDerived {
  recommendations: VendorRecommendation[];
  jurisdictions: string[];
  shadowTrackers: ReturnType<typeof detectShadowTrackers>;
  drift: ReturnType<typeof detectDrift>;
}

/**
 * Run a scenario.
 *
 * Synchronous and pure. Everything that touches a database happened before this
 * was called.
 */
export function simulate(input: SimulationInput): SimulationResult {
  return simulateWithDerived(input).result;
}

/** As `simulate`, and also the arrays the hypothetical graph is drawn from. */
export function simulateWithDerived(
  input: SimulationInput,
): { result: SimulationResult; derived: SimulationDerived } {
  const now = input.now ?? new Date();
  const hypothetical = copyEvidence(input.evidence);
  const unsupported: SimulationResult["unsupported"] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const change of input.changes) {
    switch (change.operation) {
      case "add_tracker": {
        if (!change.tracker) {
          unsupported.push({ change, reason: "No tracker was named." });
          break;
        }
        // Modelled as a technology the scan would have found. The category is
        // what drives the engine's purpose and consent finding, so a scenario
        // without one is asking a question the engine cannot answer.
        if (!change.category) {
          unsupported.push({
            change,
            reason:
              "A category is needed. The engine derives a purpose and a consent requirement from what a technology is normally used for, and cannot do so for an unclassified one.",
          });
          break;
        }
        hypothetical.technologies.push({
          name: change.vendor ?? change.tracker,
          category: change.category,
          // A hypothetical tracker is not an observation, and the confidence
          // carried into the engine says so rather than borrowing the certainty
          // of something a crawler actually saw.
          confidence: "low",
        });
        added.push(change.vendor ?? change.tracker);
        break;
      }

      case "remove_tracker": {
        if (!change.tracker) {
          unsupported.push({ change, reason: "No tracker was named." });
          break;
        }
        const needle = change.tracker.toLowerCase();
        const before = hypothetical.technologies.length;
        hypothetical.technologies = hypothetical.technologies.filter(
          (tech) => tech.name.toLowerCase() !== needle,
        );
        if (hypothetical.technologies.length === before) {
          unsupported.push({
            change,
            reason: `Nothing matching "${change.tracker}" is in the latest scan, so there is nothing to remove.`,
          });
        } else {
          removed.push(change.tracker);
        }
        break;
      }

      case "reclassify_tracker": {
        if (!change.tracker || !change.category) {
          unsupported.push({ change, reason: "A tracker and a category are both needed." });
          break;
        }
        const needle = change.tracker.toLowerCase();
        let touched = false;
        hypothetical.technologies = hypothetical.technologies.map((tech) => {
          if (tech.name.toLowerCase() === needle) {
            touched = true;
            return { ...tech, category: change.category! };
          }
          return tech;
        });
        if (!touched) {
          unsupported.push({ change, reason: `Nothing matching "${change.tracker}" is in the latest scan.` });
        }
        break;
      }

      case "add_jurisdiction": {
        if (!change.jurisdiction) {
          unsupported.push({ change, reason: "No jurisdiction was named." });
          break;
        }
        if (!hypothetical.jurisdictions.includes(change.jurisdiction)) {
          hypothetical.jurisdictions.push(change.jurisdiction);
        }
        break;
      }

      case "remove_jurisdiction": {
        if (!change.jurisdiction) {
          unsupported.push({ change, reason: "No jurisdiction was named." });
          break;
        }
        hypothetical.jurisdictions = hypothetical.jurisdictions.filter(
          (j) => j !== change.jurisdiction,
        );
        break;
      }

      case "set_enforcement": {
        if (!change.tracker || !change.action) {
          unsupported.push({ change, reason: "A vendor and an action are both needed." });
          break;
        }
        if (!["allow", "require_consent", "block"].includes(change.action)) {
          unsupported.push({
            change,
            reason: `"${change.action}" is not an action the configuration can hold. Expected allow, require_consent or block.`,
          });
          break;
        }
        hypothetical.actionOverrides.set(change.tracker.toLowerCase(), change.action);
        break;
      }

      case "set_enforcement_mode": {
        if (!change.mode || !["off", "observe", "enforce"].includes(change.mode)) {
          unsupported.push({ change, reason: "Expected a mode of off, observe or enforce." });
          break;
        }
        hypothetical.enforcementMode = change.mode as Hypothetical["enforcementMode"];
        break;
      }

      default: {
        unsupported.push({
          change,
          reason: "That operation is not something the current architecture can evaluate.",
        });
      }
    }
  }

  // ── Re-run the real engine over the hypothetical inventory ──
  //
  // Same function, same rules. The only difference between this and production
  // is the inventory it was handed.
  const declaredPurposes = input.evidence.purposes.map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description,
    isActive: p.is_active,
  }));

  const simulatedPolicy = generatePolicy({
    siteId: input.siteId,
    scanId: input.evidence.scanId,
    technologies: hypothetical.technologies,
    declaredPurposes,
    overrides: [],
    locationSignals: [],
    assertedJurisdictions: hypothetical.jurisdictions as Jurisdiction[],
    asOf: now,
  });

  // Scenario overrides are applied on top of the engine's output rather than
  // fed into it: an operator choosing "block this" is overriding a
  // recommendation, which is exactly what the real override mechanism does.
  const simulatedRecommendations: VendorRecommendation[] = simulatedPolicy.recommendations.map(
    (rec) => {
      const override =
        hypothetical.actionOverrides.get(rec.vendor_name.toLowerCase()) ??
        hypothetical.actionOverrides.get(rec.detector_id.toLowerCase());
      return override
        ? { ...rec, recommended_action: override as VendorRecommendation["recommended_action"], overridden: true }
        : rec;
    },
  );

  const baseline = input.evidence.approved;

  // ── Intelligence, over the hypothetical set ──
  const intelligenceInput = {
    siteId: input.siteId,
    scanId: input.evidence.scanId,
    baselineScanId: input.evidence.baselineScanId,
    results: input.evidence.results,
    baseline: input.evidence.baseline,
    approved: simulatedRecommendations,
    policyVersion: input.evidence.policyVersion,
    runtime: input.evidence.runtime,
  };

  const shadowAfter = detectShadowTrackers(intelligenceInput);
  const driftAfter = detectDrift(intelligenceInput);

  const shadowBefore = detectShadowTrackers({ ...intelligenceInput, approved: [...baseline] });
  const driftBefore = detectDrift({ ...intelligenceInput, approved: [...baseline] });

  // ── Quality, over the hypothetical set ──
  const activePurposes = input.evidence.purposes.filter((p) => p.is_active);
  const declaredCodes = new Set(activePurposes.map((p) => p.code));
  const undeclared = new Set(
    simulatedRecommendations
      .map((r) => r.suggested_purpose)
      .filter((code): code is string => Boolean(code) && !declaredCodes.has(code as string)),
  );

  const simulatedQuality = computeConsentQuality({
    siteId: input.siteId,
    declaredPurposes: activePurposes.length,
    undeclaredPurposes: undeclared.size,
    approved: simulatedRecommendations,
    proposed: simulatedRecommendations,
    hasApprovedPolicy: input.evidence.policyVersion !== null,
    enforcementMode: hypothetical.enforcementMode ?? "observe",
    enforcementRules: simulatedRecommendations.filter(
      (r) => r.recommended_action === "require_consent" || r.recommended_action === "block",
    ).length,
    lastCompletedScanAt: input.evidence.lastCompletedScanAt,
    shadowTrackers: shadowAfter,
    drift: driftAfter,
    jurisdictions: hypothetical.jurisdictions,
    decisions: input.evidence.decisions,
    decisionsWithProof: input.evidence.decisionsWithProof,
  });

  // ── Deltas ──
  const beforeVendors = new Set(baseline.map((r) => r.vendor_name));
  const afterVendors = new Set(simulatedRecommendations.map((r) => r.vendor_name));

  const beforeActions = new Map(baseline.map((r) => [r.vendor_name, r.recommended_action]));
  const gatingBefore = baseline.filter(
    (r) => r.recommended_action === "block" || r.recommended_action === "require_consent",
  ).length;
  const gatingAfter = simulatedRecommendations.filter(
    (r) => r.recommended_action === "block" || r.recommended_action === "require_consent",
  ).length;

  const requirements = simulatedRecommendations
    .filter((rec) => beforeActions.get(rec.vendor_name) !== rec.recommended_action)
    .map((rec) => ({
      vendor: rec.vendor_name,
      from: beforeActions.get(rec.vendor_name) ?? null,
      to: rec.recommended_action,
      reason: rec.reason,
    }));

  const purposesAffected = [
    ...new Set(
      simulatedRecommendations
        .filter((rec) => !beforeVendors.has(rec.vendor_name) || requirements.some((r) => r.vendor === rec.vendor_name))
        .map((rec) => rec.suggested_purpose)
        .filter((code): code is string => Boolean(code)),
    ),
  ];

  const knownShadow = new Set(shadowBefore.map((f) => f.id));
  const newShadow = shadowAfter.filter((f) => !knownShadow.has(f.id));

  const findings = buildFindings({
    added,
    removed,
    requirements,
    purposesAffected,
    jurisdictionsBefore: input.evidence.jurisdictions,
    jurisdictionsAfter: hypothetical.jurisdictions,
    shadowBefore: shadowBefore.length,
    shadowAfter: shadowAfter.length,
    driftBefore: driftBefore.length,
    driftAfter: driftAfter.length,
    qualityBefore: input.currentQuality.score,
    qualityAfter: simulatedQuality.score,
    gatingBefore,
    gatingAfter,
    newShadow,
  });

  const result: SimulationResult = {
    hypothetical: true,
    scenario_name: input.scenarioName,
    site_id: input.siteId,
    base_policy_version:
      input.evidence.policyVersion === null ? null : String(input.evidence.policyVersion),
    base_scan_id: input.evidence.scanId,
    generated_at: now.toISOString(),
    changes: [...input.changes],

    inventory: {
      trackers: hypothetical.technologies.length - (input.evidence.results?.technologies.length ?? 0),
      vendors: afterVendors.size - beforeVendors.size,
      // Destinations move with technologies here: the scan is the only source of
      // a destination, and a hypothetical tracker contributes exactly one.
      destinations: added.length - removed.length,
      added,
      removed,
    },
    consent: { purposes_affected: purposesAffected, requirements },
    jurisdiction: {
      before: [...input.evidence.jurisdictions],
      after: [...hypothetical.jurisdictions],
      added: hypothetical.jurisdictions.filter((j) => !input.evidence.jurisdictions.includes(j)),
      removed: input.evidence.jurisdictions.filter((j) => !hypothetical.jurisdictions.includes(j)),
      regimes: simulatedPolicy.regimes ?? [],
    },
    enforcement: {
      current: input.evidence.policyVersion === null ? "not configured" : "observe",
      simulated: hypothetical.enforcementMode ?? (input.evidence.policyVersion === null ? "not configured" : "observe"),
      rules_before: gatingBefore,
      rules_after: gatingAfter,
    },
    intelligence: {
      shadow_before: shadowBefore.length,
      shadow_after: shadowAfter.length,
      drift_before: driftBefore.length,
      drift_after: driftAfter.length,
      new_shadow: newShadow.map((f) => ({
        host: f.host,
        vendor: f.vendor,
        severity: f.severity,
        reason: f.reason,
      })),
    },
    quality: {
      current_score: input.currentQuality.score,
      current_band: input.currentQuality.band,
      simulated_score: simulatedQuality.score,
      simulated_band: simulatedQuality.band,
      components: simulatedQuality.components.map((component) => {
        const before = input.currentQuality.components.find((c) => c.id === component.id);
        return {
          id: component.id,
          label: component.label,
          before: Math.round((before?.earned ?? 0) * 10) / 10,
          after: Math.round(component.earned * 10) / 10,
        };
      }),
    },
    findings,
    unsupported,
    caveats: [...SIMULATION_CAVEATS],
    legal_advice: false,
  };

  return {
    result,
    derived: {
      recommendations: simulatedRecommendations,
      jurisdictions: [...hypothetical.jurisdictions],
      shadowTrackers: shadowAfter,
      drift: driftAfter,
    },
  };
}

/**
 * Turn the deltas into findings that say why.
 *
 * Every finding carries `because`. A simulation result an operator cannot check
 * is one they cannot defend, and this surface exists to support a decision
 * somebody will have to argue for.
 */
function buildFindings(d: {
  added: string[];
  removed: string[];
  requirements: Array<{ vendor: string; from: string | null; to: string; reason: string }>;
  purposesAffected: string[];
  jurisdictionsBefore: readonly string[];
  jurisdictionsAfter: readonly string[];
  shadowBefore: number;
  shadowAfter: number;
  driftBefore: number;
  driftAfter: number;
  qualityBefore: number;
  qualityAfter: number;
  gatingBefore: number;
  gatingAfter: number;
  newShadow: Array<{ host: string; vendor: string | null; severity: string }>;
}): ImpactFinding[] {
  const findings: ImpactFinding[] = [];

  for (const name of d.added) {
    findings.push({
      severity: "medium",
      area: "inventory",
      summary: `${name} would be added to the inventory.`,
      because: "The scenario adds it, and the engine re-ran with it present.",
    });
  }

  for (const name of d.removed) {
    findings.push({
      severity: "info",
      area: "inventory",
      summary: `${name} would leave the inventory.`,
      because: "The scenario removes it from the scanned technologies.",
    });
  }

  for (const requirement of d.requirements) {
    findings.push({
      severity: requirement.to === "block" ? "high" : "medium",
      area: "consent",
      summary: `${requirement.vendor}: ${requirement.from ?? "not configured"} → ${requirement.to}.`,
      because: requirement.reason,
    });
  }

  const addedJurisdictions = d.jurisdictionsAfter.filter((j) => !d.jurisdictionsBefore.includes(j));
  if (addedJurisdictions.length > 0) {
    findings.push({
      severity: "medium",
      area: "jurisdiction",
      summary: `Declaring ${addedJurisdictions.join(", ")} brings its regimes into play.`,
      because:
        "The policy engine resolves obligations from the markets an operator declares. Adding one adds every regime the resolver maps to it.",
    });
  }

  if (d.newShadow.length > 0) {
    findings.push({
      severity: "high",
      area: "intelligence",
      summary: `${d.newShadow.length} technolog${d.newShadow.length === 1 ? "y" : "ies"} would be unaccounted for.`,
      because:
        "The change puts something on the site that the approved configuration does not cover, which is what a shadow tracker finding is.",
    });
  } else if (d.shadowAfter < d.shadowBefore) {
    findings.push({
      severity: "info",
      area: "intelligence",
      summary: `${d.shadowBefore - d.shadowAfter} fewer unaccounted-for technologies.`,
      because: "The change brings something under the approved configuration, or removes it.",
    });
  }

  if (d.driftAfter !== d.driftBefore) {
    findings.push({
      severity: d.driftAfter > d.driftBefore ? "medium" : "info",
      area: "intelligence",
      summary: `Drift findings ${d.driftAfter > d.driftBefore ? "rise" : "fall"} from ${d.driftBefore} to ${d.driftAfter}.`,
      because: "Drift is measured against the approved configuration, which this scenario changes.",
    });
  }

  if (d.qualityAfter !== d.qualityBefore) {
    findings.push({
      severity: d.qualityAfter < d.qualityBefore ? "medium" : "info",
      area: "quality",
      summary: `Simulated quality ${d.qualityBefore} → ${d.qualityAfter}.`,
      because:
        "Recomputed with the same scoring model over the hypothetical configuration. This is not a production score.",
    });
  }

  if (d.gatingAfter !== d.gatingBefore) {
    findings.push({
      severity: "info",
      area: "enforcement",
      summary: `Gating rules ${d.gatingBefore} → ${d.gatingAfter}.`,
      because: "Counted from approved actions of block or require_consent after the change.",
    });
  }

  return findings;
}
