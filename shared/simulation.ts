/**
 * Privacy impact simulation: asking "what if" without changing anything.
 *
 * ## Immutability is structural, not procedural
 *
 * A simulation has no write path. Not "a write path that is carefully avoided" —
 * none. The engine is a pure function over an evidence set that was read once,
 * and there is no scenario table, no draft policy row, no persisted result. The
 * only way to change production remains the ordinary configuration workflow,
 * with its own authorisation and its own human approval.
 *
 * That choice costs something real: scenarios cannot be saved, shared by link,
 * or reopened tomorrow. It is worth it. A simulator that writes anywhere is a
 * simulator somebody will eventually point at production, and the guarantee that
 * matters most here — *running this changed nothing* — becomes a property of
 * code review rather than of the architecture.
 *
 * ## It reuses the real engines
 *
 * `generatePolicy`, `detectShadowTrackers`, `detectDrift` and
 * `computeConsentQuality` are the same functions production runs, called on a
 * modified copy of the same inputs. There is no second policy evaluator, and no
 * simplified model of one. A simulation that disagreed with production about the
 * same facts would be worse than no simulation, because its output looks exactly
 * as authoritative.
 *
 * ## Everything it returns is marked
 *
 * Every result carries `hypothetical: true`, every score is named a *simulated*
 * score, and the response says in words that it describes a possibility rather
 * than a measurement. A number that looks like the quality score but is not one
 * is the single most dangerous thing this feature can produce.
 */

// ─── Proposed changes ────────────────────────────────────────────────────────

/**
 * The operations the current architecture can actually evaluate.
 *
 * Shorter than the obvious list, deliberately. `change_data_category` is absent,
 * for instance: data categories are attached by the policy engine from the
 * regimes in play, not chosen per vendor, so an operator "changing" one would be
 * overriding a derivation rather than configuring anything — and the simulator
 * would then be modelling a system that does not exist.
 */
export type SimulationOperation =
  /** Add a technology to the scanned inventory, as if a scan had found it. */
  | "add_tracker"
  /** Remove one, as if it had been taken off the site. */
  | "remove_tracker"
  /** Change what the engine is told a technology is, which changes its purpose. */
  | "reclassify_tracker"
  /** Add or remove a declared market, which changes which regimes apply. */
  | "add_jurisdiction"
  | "remove_jurisdiction"
  /** Override the approved action for a vendor: allow, require_consent, block. */
  | "set_enforcement"
  /** Turn site-wide enforcement on or off, which changes what a block means. */
  | "set_enforcement_mode";

export interface ProposedChange {
  operation: SimulationOperation;
  /** Detector id or host, for tracker operations. */
  tracker?: string;
  /** Display name for an added tracker. */
  vendor?: string;
  /** Scanner category — `analytics`, `advertising`, `session_replay`, … */
  category?: string;
  /** Page the tracker would be added to, where the operator has one in mind. */
  page?: string;
  /** Jurisdiction code, for jurisdiction operations. */
  jurisdiction?: string;
  /** `allow` | `require_consent` | `block`, for `set_enforcement`. */
  action?: string;
  /** `off` | `observe` | `enforce`, for `set_enforcement_mode`. */
  mode?: string;
}

export interface SimulationRequest {
  scenario_name: string;
  changes: ProposedChange[];
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface InventoryDelta {
  trackers: number;
  vendors: number;
  destinations: number;
  /** Names, so a reader can see what moved rather than only how much. */
  added: string[];
  removed: string[];
}

export interface ConsentDelta {
  /** Purposes newly implicated, by code. */
  purposes_affected: string[];
  /** The engine's own finding for each affected vendor. Never flattened. */
  requirements: Array<{
    vendor: string;
    from: string | null;
    to: string;
    reason: string;
  }>;
}

export interface JurisdictionDelta {
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
  /**
   * Regimes the engine says apply after the change.
   *
   * Only ones the resolver actually supports. A regime the matrix does not hold
   * is absent rather than listed as unaffected.
   */
  regimes: string[];
}

export interface EnforcementDelta {
  /** What the approved configuration says now. */
  current: string;
  /** What it would say. */
  simulated: string;
  rules_before: number;
  rules_after: number;
}

export interface IntelligenceDelta {
  shadow_before: number;
  shadow_after: number;
  drift_before: number;
  drift_after: number;
  /** New findings the change would produce, summarised. */
  new_shadow: Array<{ host: string; vendor: string | null; severity: string; reason: string }>;
}

export interface QualityDelta {
  /** The real, current score. Named so it cannot be confused with the next one. */
  current_score: number;
  current_band: string;
  /** Hypothetical. Not a production score and must never be presented as one. */
  simulated_score: number;
  simulated_band: string;
  /** Which components moved, and by how much. */
  components: Array<{ id: string; label: string; before: number; after: number }>;
}

/** One finding, with the rule or evidence that produced it. */
export interface ImpactFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  area: "inventory" | "consent" | "jurisdiction" | "enforcement" | "intelligence" | "quality";
  summary: string;
  /**
   * Why this was produced.
   *
   * Required. A simulation result with no stated reason is a number an operator
   * cannot check, argue with, or act on — and this whole surface exists to
   * support a decision somebody will have to defend.
   */
  because: string;
}

export interface SimulationResult {
  /** Always true. Present on the wire so no consumer can lose it. */
  hypothetical: true;
  scenario_name: string;
  site_id: string;
  /** The real configuration the scenario was computed against. */
  base_policy_version: string | null;
  base_scan_id: string | null;
  generated_at: string;
  changes: ProposedChange[];

  inventory: InventoryDelta;
  consent: ConsentDelta;
  jurisdiction: JurisdictionDelta;
  enforcement: EnforcementDelta;
  intelligence: IntelligenceDelta;
  quality: QualityDelta;
  findings: ImpactFinding[];

  /** Changes that could not be evaluated, and why. Never silently dropped. */
  unsupported: Array<{ change: ProposedChange; reason: string }>;

  caveats: string[];
  legal_advice: false;
}

export interface SimulationResponse {
  simulation: SimulationResult;
}

/** Live and simulated graphs, side by side. Never merged. */
export interface ScenarioComparisonResponse {
  live: unknown;
  simulated: unknown;
  simulation: SimulationResult;
}

export const SIMULATION_CAVEATS = [
  "This is hypothetical. Nothing here has been applied, and running it changed nothing about your site, your configuration, your consent records or your proofs.",
  "The simulated quality score is not a production score. It describes what the score would be if the change were made and nothing else changed.",
  "A simulation starts from the last completed scan. It cannot know about a tracker that scan did not see.",
  "Jurisdiction findings come from the markets you declared, never from where anybody is. Adding a jurisdiction here models declaring a market, not detecting one.",
  "Applying any of this goes through the ordinary configuration workflow, with its own approval. There is no path from this screen to production.",
];

/** What a graph node can ask, so the UI does not invent operations. */
export const NODE_SIMULATIONS: Record<
  string,
  Array<{ operation: SimulationOperation; label: string; description: string }>
> = {
  tracker: [
    {
      operation: "remove_tracker",
      label: "What if this were removed?",
      description: "Models the technology no longer being on the site.",
    },
    {
      operation: "set_enforcement",
      label: "What if this were blocked?",
      description: "Models the approved action becoming block.",
    },
  ],
  vendor: [
    {
      operation: "remove_tracker",
      label: "What if this vendor were removed?",
      description: "Models every technology matched to this vendor coming off the site.",
    },
    {
      operation: "set_enforcement",
      label: "What if consent were required?",
      description: "Models the approved action becoming require_consent.",
    },
  ],
  destination: [
    {
      operation: "set_enforcement",
      label: "What if this destination were blocked?",
      description: "Models the vendor sending here being blocked outright.",
    },
  ],
  jurisdiction: [
    {
      operation: "remove_jurisdiction",
      label: "What if this market were dropped?",
      description: "Models the regimes attached to it no longer applying.",
    },
  ],
  site: [
    {
      operation: "set_enforcement_mode",
      label: "What if enforcement were switched on?",
      description: "Models moving from observe to enforce.",
    },
    {
      operation: "add_jurisdiction",
      label: "What if a market were added?",
      description: "Models declaring a new market and the regimes it brings.",
    },
  ],
};
