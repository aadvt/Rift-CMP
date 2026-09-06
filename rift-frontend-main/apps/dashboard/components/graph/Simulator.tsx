'use client';
import * as React from 'react';
import { Card, CardBody, CardHeader, Chip, Notice, cn, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * The privacy impact simulator.
 *
 * ## Everything on this screen says it is hypothetical
 *
 * Not once at the top, but on the panel, on the score, and beside every number
 * that has a production twin. The single most dangerous thing this feature can
 * produce is a figure that looks like the Consent Quality Score and is not one —
 * so the real score and the simulated score are always rendered together, both
 * labelled, and the simulated one never appears alone.
 *
 * ## There is no apply button
 *
 * Deliberately. Changing a site goes through the ordinary configuration
 * workflow, with its own authorisation and its own approval. A shortcut from
 * here would be a policy bypass wearing a different name, however much
 * confirmation it asked for. The panel says so rather than leaving an operator
 * hunting for a control that does not exist.
 *
 * ## Findings carry their reasons
 *
 * Every row shows why it was produced. A simulation result an operator cannot
 * check is one they cannot defend, and this exists to support a decision
 * somebody will have to argue for.
 */

const SEVERITY_TONE: Record<string, ChipTone> = {
  critical: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'neutral',
  info: 'neutral',
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function Simulator({
  siteId,
  seedNode,
}: {
  siteId: string;
  seedNode?: { id: string; kind: string; label: string } | null;
}) {
  const [operation, setOperation] = React.useState('add_tracker');
  const [tracker, setTracker] = React.useState('');
  const [category, setCategory] = React.useState('analytics');
  const [jurisdiction, setJurisdiction] = React.useState('');
  const [action, setAction] = React.useState('block');
  const [mode, setMode] = React.useState('enforce');

  const [result, setResult] = React.useState<W.WireSimulation | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // A node selected in the graph seeds the scenario, so "what if I block this"
  // starts from the thing the operator was looking at rather than an empty form.
  React.useEffect(() => {
    if (!seedNode) return;
    if (seedNode.kind === 'tracker' || seedNode.kind === 'vendor' || seedNode.kind === 'destination') {
      setOperation('set_enforcement');
      setTracker(seedNode.label);
    } else if (seedNode.kind === 'jurisdiction') {
      setOperation('remove_jurisdiction');
      setJurisdiction(seedNode.label);
    } else if (seedNode.kind === 'site') {
      setOperation('set_enforcement_mode');
    }
  }, [seedNode]);

  async function run() {
    setRunning(true);
    setError(null);

    const change: Record<string, string> = { operation };
    if (['add_tracker', 'remove_tracker', 'reclassify_tracker', 'set_enforcement'].includes(operation)) {
      change.tracker = tracker;
    }
    if (operation === 'add_tracker') {
      // The display name is the tracker's own. A separate field would let an
      // operator name two different things and wonder which the result was about.
      change.vendor = tracker;
      change.category = category;
    }
    if (operation === 'reclassify_tracker') change.category = category;
    if (['add_jurisdiction', 'remove_jurisdiction'].includes(operation)) {
      change.jurisdiction = jurisdiction;
    }
    if (operation === 'set_enforcement') change.action = action;
    if (operation === 'set_enforcement_mode') change.mode = mode;

    try {
      const response = await fetch(`/api/rift/sites/${siteId}/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario_name: 'Scenario', changes: [change] }),
      });

      if (!response.ok) {
        setError('The scenario could not be evaluated. Nothing was changed.');
        setResult(null);
        return;
      }

      const body = (await response.json()) as { simulation: W.WireSimulation };
      setResult(body.simulation);
    } catch {
      setError('The scenario could not be evaluated. Nothing was changed.');
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="neutral" title="Nothing here changes your site">
        A simulation reads your current configuration and scan, applies the change to a copy, and
        re-runs the same engines production uses. It writes nothing. Applying a change goes through
        the ordinary configuration workflow, with its own approval — there is no path from this
        screen to production.
      </Notice>

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader
            title="Propose a change"
            sub="Only operations the policy engine can actually evaluate are offered."
          />

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label-medium text-md-on-surface-variant">Change</span>
              <select
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
                className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
              >
                <option value="add_tracker">Add a tracker</option>
                <option value="remove_tracker">Remove a tracker</option>
                <option value="reclassify_tracker">Reclassify a tracker</option>
                <option value="set_enforcement">Change what happens to a vendor</option>
                <option value="set_enforcement_mode">Change enforcement mode</option>
                <option value="add_jurisdiction">Declare a market</option>
                <option value="remove_jurisdiction">Drop a market</option>
              </select>
            </label>

            {['add_tracker', 'remove_tracker', 'reclassify_tracker', 'set_enforcement'].includes(
              operation,
            ) ? (
              <label className="flex flex-col gap-1">
                <span className="text-label-medium text-md-on-surface-variant">Tracker or vendor</span>
                <input
                  value={tracker}
                  onChange={(event) => setTracker(event.target.value)}
                  placeholder="Hotjar"
                  className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
                />
              </label>
            ) : null}

            {['add_tracker', 'reclassify_tracker'].includes(operation) ? (
              <label className="flex flex-col gap-1">
                <span className="text-label-medium text-md-on-surface-variant">
                  Category
                  <span className="ml-1 opacity-70">
                    — the engine derives the purpose and consent requirement from this
                  </span>
                </span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
                >
                  {['analytics', 'advertising', 'session_replay', 'tag_management', 'cdn', 'security'].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value.replace(/_/g, ' ')}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}

            {operation === 'set_enforcement' ? (
              <label className="flex flex-col gap-1">
                <span className="text-label-medium text-md-on-surface-variant">Action</span>
                <select
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
                >
                  <option value="allow">allow</option>
                  <option value="require_consent">require consent</option>
                  <option value="block">block</option>
                </select>
              </label>
            ) : null}

            {operation === 'set_enforcement_mode' ? (
              <label className="flex flex-col gap-1">
                <span className="text-label-medium text-md-on-surface-variant">Mode</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
                >
                  <option value="off">off</option>
                  <option value="observe">observe</option>
                  <option value="enforce">enforce</option>
                </select>
              </label>
            ) : null}

            {['add_jurisdiction', 'remove_jurisdiction'].includes(operation) ? (
              <label className="flex flex-col gap-1">
                <span className="text-label-medium text-md-on-surface-variant">Market</span>
                <input
                  value={jurisdiction}
                  onChange={(event) => setJurisdiction(event.target.value)}
                  placeholder="EU"
                  className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={run}
              disabled={running}
              className="mt-2 h-10 rounded-full bg-md-primary text-label-medium font-medium text-md-on-primary disabled:opacity-60"
            >
              {running ? 'Running…' : 'Run simulation'}
            </button>
          </div>

          {error ? (
            <p className="mt-3 text-body-small text-md-error">{error}</p>
          ) : null}
        </CardBody>
      </Card>

      {result ? <SimulationResult result={result} /> : null}
    </div>
  );
}

function SimulationResult({ result }: { result: W.WireSimulation }) {
  const scoreMoved = result.quality.simulated_score !== result.quality.current_score;

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-2xl border-dashed">
        <CardBody className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* Said here, and again beside the score, and again in the caveats. */}
            <Chip tone="warning">Hypothetical</Chip>
            <span className="text-body-medium text-md-on-surface">{result.scenario_name}</span>
            {result.base_policy_version ? (
              <Chip tone="neutral">against v{result.base_policy_version}</Chip>
            ) : (
              <Chip tone="warning">no approved configuration</Chip>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-[26px] font-semibold leading-none tabular-nums text-md-on-surface">
                {result.quality.current_score}
              </div>
              <div className="mt-1 text-[12.5px] text-md-on-surface-variant/80">
                current quality score
              </div>
            </div>
            <div>
              <div
                className={cn(
                  'text-[26px] font-semibold leading-none tabular-nums',
                  scoreMoved ? 'text-md-on-surface' : 'text-md-on-surface-variant',
                )}
              >
                {result.quality.simulated_score}
              </div>
              <div className="mt-1 text-[12.5px] text-md-on-surface-variant/80">
                {/* Never rendered alone, and never called "the score". */}
                simulated — not a production score
              </div>
            </div>
            <div>
              <div className="text-[26px] font-semibold leading-none tabular-nums text-md-on-surface">
                {signed(result.inventory.trackers)}
              </div>
              <div className="mt-1 text-[12.5px] text-md-on-surface-variant/80">trackers</div>
            </div>
            <div>
              <div className="text-[26px] font-semibold leading-none tabular-nums text-md-on-surface">
                {result.intelligence.shadow_before} → {result.intelligence.shadow_after}
              </div>
              <div className="mt-1 text-[12.5px] text-md-on-surface-variant/80">
                unaccounted for
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {result.unsupported.length > 0 ? (
        <Notice tone="warning" title="Some of this could not be evaluated">
          <ul className="mt-2 flex flex-col gap-1">
            {result.unsupported.map((entry, i) => (
              <li key={i} className="text-body-small">
                {entry.reason}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {result.findings.length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader title="What would change" sub="Each says why it was produced." />
            <ul className="mt-4 flex flex-col gap-4">
              {result.findings.map((finding, i) => (
                <li
                  key={i}
                  className="border-t border-md-outline-variant/50 pt-4 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={SEVERITY_TONE[finding.severity] ?? 'neutral'}>{finding.severity}</Chip>
                    <Chip tone="neutral">{finding.area}</Chip>
                    <span className="text-body-small text-md-on-surface">{finding.summary}</span>
                  </div>
                  <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
                    {finding.because}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader title="What this simulation does not tell you" />
          <ul className="mt-4 flex flex-col gap-2">
            {result.caveats.map((caveat) => (
              <li key={caveat} className="text-body-small leading-relaxed text-md-on-surface-variant">
                {caveat}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
