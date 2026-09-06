/**
 * The wire shape of a privacy simulation.
 *
 * Mirrored from `shared/simulation.ts` rather than imported. The dashboard is a
 * separate npm workspace root, and reaching across it would mean bundling the
 * shared package — and its transitive dependencies — into a browser build for a
 * handful of interfaces. Every other wire type in this app is declared the same
 * way, in `backend.ts`, for the same reason.
 *
 * These live in their own file because the simulator is the one feature whose
 * response is large enough to bury the rest of `backend.ts` if it went there.
 */

export type SimulationOperation =
  | 'add_tracker'
  | 'remove_tracker'
  | 'reclassify_tracker'
  | 'add_jurisdiction'
  | 'remove_jurisdiction'
  | 'set_enforcement'
  | 'set_enforcement_mode';

export interface ProposedChange {
  operation: SimulationOperation;
  tracker?: string;
  vendor?: string;
  category?: string;
  page?: string;
  jurisdiction?: string;
  action?: string;
  mode?: string;
}

export interface WireSimulation {
  /** Always true, and carried on the wire so no consumer can lose it. */
  hypothetical: true;
  scenario_name: string;
  site_id: string;
  base_policy_version: string | null;
  base_scan_id: string | null;
  generated_at: string;
  changes: ProposedChange[];

  inventory: {
    trackers: number;
    vendors: number;
    destinations: number;
    added: string[];
    removed: string[];
  };

  consent: {
    purposes_affected: string[];
    requirements: Array<{ vendor: string; from: string | null; to: string; reason: string }>;
  };

  jurisdiction: {
    before: string[];
    after: string[];
    added: string[];
    removed: string[];
    regimes: string[];
  };

  enforcement: {
    current: string;
    simulated: string;
    rules_before: number;
    rules_after: number;
  };

  intelligence: {
    shadow_before: number;
    shadow_after: number;
    drift_before: number;
    drift_after: number;
    new_shadow: Array<{ host: string; vendor: string | null; severity: string; reason: string }>;
  };

  quality: {
    current_score: number;
    current_band: string;
    /** Hypothetical. Never to be rendered as though it were the real score. */
    simulated_score: number;
    simulated_band: string;
    components: Array<{ id: string; label: string; before: number; after: number }>;
  };

  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    area: 'inventory' | 'consent' | 'jurisdiction' | 'enforcement' | 'intelligence' | 'quality';
    summary: string;
    /** Why the finding was produced. The platform requires it; so does the UI. */
    because: string;
  }>;

  /** Changes the engine could not evaluate, and why. Never silently dropped. */
  unsupported: Array<{ change: ProposedChange; reason: string }>;

  caveats: string[];
  legal_advice: false;
}

export interface WireSimulationResponse {
  simulation: WireSimulation;
}
