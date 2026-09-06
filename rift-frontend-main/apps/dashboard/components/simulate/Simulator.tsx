'use client';
import * as React from 'react';
import {
  Button, Card, CardBody, CardHeader, Chip, Field, Input, Notice, StatBlock, cn,
} from '@rift/ui';
import { simulateScenario } from '@/app/actions';
import type { ProposedChange, SimulationOperation, WireSimulation } from '@/lib/api/simulation';

/**
 * The privacy impact simulator.
 *
 * The platform has had this endpoint since Phase D and nothing has ever called
 * it. It answers "what would happen if" — a tracker removed, a market declared,
 * enforcement turned on — against the site's real graph, and returns the
 * inventory, consent, jurisdiction, enforcement, intelligence and quality
 * deltas that would follow.
 *
 * ## Nothing here applies anything
 *
 * There is no apply button and there is not going to be one. The platform's own
 * route says why: a shortcut from a simulator to production is a policy bypass
 * wearing a different name, however much confirmation it asks for. Changing a
 * site goes through the configuration workflow, which has its own approval.
 *
 * So the screen is built to be unmistakably hypothetical. The result is headed
 * as a scenario, the simulated quality score is never shown without the real
 * one beside it, and the platform's caveats are rendered in full rather than
 * summarised — including the one that says a simulation cannot know about a
 * tracker the last scan did not see.
 *
 * ## Unsupported changes are shown, not dropped
 *
 * The engine returns changes it could not evaluate along with the reason. A
 * simulator that quietly ignored part of a scenario would produce a confident
 * answer to a different question than the one asked, which is the worst failure
 * mode available to this feature.
 */
const OPERATIONS: ReadonlyArray<{
  operation: SimulationOperation;
  label: string;
  hint: string;
  /** Which field the operation actually reads, so the form asks for that. */
  field: 'tracker' | 'jurisdiction' | 'mode' | 'none';
  placeholder?: string;
}> = [
  {
    operation: 'remove_tracker',
    label: 'Remove a tracker',
    hint: 'Models the technology no longer being on the site.',
    field: 'tracker',
    placeholder: 'google-analytics, or a host',
  },
  {
    operation: 'add_jurisdiction',
    label: 'Declare a market',
    hint: 'Models declaring a market you sell into — never detecting where anybody is.',
    field: 'jurisdiction',
    placeholder: 'DE, IN, US-CA',
  },
  {
    operation: 'remove_jurisdiction',
    label: 'Drop a market',
    hint: 'Models no longer serving a market you currently declare.',
    field: 'jurisdiction',
    placeholder: 'DE, IN, US-CA',
  },
  {
    operation: 'set_enforcement_mode',
    label: 'Change enforcement mode',
    hint: 'off, observe or enforce. Changes what a block actually does.',
    field: 'mode',
    placeholder: 'enforce',
  },
];

const SEVERITY_TONE = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'neutral',
  info: 'neutral',
} as const;

export function Simulator({ siteId, host }: { siteId: string; host: string }) {
  const [name, setName] = React.useState('Untitled scenario');
  const [changes, setChanges] = React.useState<ProposedChange[]>([]);
  const [draftOp, setDraftOp] = React.useState<SimulationOperation>('remove_tracker');
  const [draftValue, setDraftValue] = React.useState('');
  const [result, setResult] = React.useState<WireSimulation | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const spec = OPERATIONS.find((o) => o.operation === draftOp)!;

  function addChange() {
    const value = draftValue.trim();
    if (spec.field !== 'none' && !value) return;

    const change: ProposedChange = { operation: draftOp };
    if (spec.field === 'tracker') change.tracker = value;
    if (spec.field === 'jurisdiction') change.jurisdiction = value.toUpperCase();
    if (spec.field === 'mode') change.mode = value.toLowerCase();

    setChanges((c) => [...c, change]);
    setDraftValue('');
  }

  function run() {
    if (changes.length === 0) return;
    setError(null);
    start(async () => {
      const outcome = await simulateScenario(siteId, name.trim() || 'Untitled scenario', changes);
      if (!outcome.ok) {
        setError(outcome.message);
        setResult(null);
        return;
      }
      setResult(outcome.simulation);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="neutral" icon="info" title="Nothing on this screen changes your site">
        A scenario is computed against {host}&rsquo;s real configuration and thrown away. There is no
        apply button here on purpose — changing a site goes through the configuration workflow, which
        has its own approval.
      </Notice>

      <Card className="rounded-2xl">
        <CardBody className="p-7">
          <CardHeader
            title="Build a scenario"
            sub="Up to 25 changes. The engine evaluates them together, not one at a time."
          />

          <div className="mt-6 max-w-[420px]">
            <Field label="Scenario name" htmlFor="scenario-name">
              <Input
                id="scenario-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dropping Google Analytics"
              />
            </Field>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
              Add a change
            </div>
            <div className="flex flex-wrap gap-2">
              {OPERATIONS.map((o) => (
                <button
                  key={o.operation}
                  type="button"
                  onClick={() => { setDraftOp(o.operation); setDraftValue(''); }}
                  className={cn(
                    'inline-flex h-10 items-center rounded-full px-5 text-label-medium font-medium',
                    'transition-all duration-[--md-duration-fast] ease-md active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
                    o.operation === draftOp
                      ? 'bg-md-secondary-container text-md-on-secondary-container'
                      : 'bg-md-surface-variant text-md-on-surface-variant hover:bg-md-primary/10',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-body-small leading-relaxed text-md-on-surface-variant">{spec.hint}</p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <Field label={spec.field === 'jurisdiction' ? 'Market code' : spec.field === 'mode' ? 'Mode' : 'Tracker'} htmlFor="change-value">
                  <Input
                    id="change-value"
                    value={draftValue}
                    placeholder={spec.placeholder}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChange(); } }}
                  />
                </Field>
              </div>
              <Button variant="tonal" icon="plus" onClick={addChange} className="mb-0.5">
                Add change
              </Button>
            </div>
          </div>

          {changes.length > 0 ? (
            <div className="mt-6">
              <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                This scenario ({changes.length})
              </div>
              <ul className="flex flex-col gap-2">
                {changes.map((c, i) => (
                  <li
                    key={`${c.operation}-${i}`}
                    className="flex items-center justify-between gap-4 rounded-xl bg-md-surface-container px-5 py-3"
                  >
                    <span className="text-body-medium text-md-on-surface">
                      <span className="font-medium">
                        {OPERATIONS.find((o) => o.operation === c.operation)?.label ?? c.operation}
                      </span>
                      {c.tracker || c.jurisdiction || c.mode ? (
                        <span className="ml-2 font-mono text-label-medium text-md-on-surface-variant">
                          {c.tracker ?? c.jurisdiction ?? c.mode}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => setChanges((all) => all.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              variant="filled"
              disabled={pending || changes.length === 0}
              onClick={run}
              iconAfter="arrowRight"
            >
              {pending ? 'Running…' : 'Run scenario'}
            </Button>
            {changes.length > 0 ? (
              <Button variant="text" disabled={pending} onClick={() => { setChanges([]); setResult(null); }}>
                Clear
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Notice tone="error" icon="alert" title="The scenario could not be run">
          {error}
        </Notice>
      ) : null}

      {result ? <Result simulation={result} /> : null}
    </div>
  );
}

function Result({ simulation: s }: { simulation: WireSimulation }) {
  return (
    <div className="flex flex-col gap-5" data-print-region>
      <Card className="rounded-2xl">
        <CardBody className="p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="tertiary" glyph="wave">Hypothetical</Chip>
            <span className="text-title-large font-medium text-md-on-surface">{s.scenario_name}</span>
          </div>
          <p className="mt-2 text-label-medium text-md-on-surface-variant">
            Computed against scan{' '}
            <span className="font-mono">{s.base_scan_id ?? 'none'}</span>
            {s.base_policy_version ? <> and policy version <span className="font-mono">{s.base_policy_version}</span></> : null}
            {' · '}
            {new Date(s.generated_at).toLocaleString()}
          </p>

          {/* The real score and the simulated one, always together. A
              hypothetical score shown alone is the single most misreadable
              number this feature can produce. */}
          <div className="mt-7 grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatBlock label="Quality now" value={s.quality.current_score} meta={s.quality.current_band} />
            <StatBlock
              label="If applied"
              value={s.quality.simulated_score}
              meta={`${s.quality.simulated_band} · hypothetical`}
            />
            <StatBlock
              label="Trackers"
              value={s.inventory.trackers}
              meta={`${s.inventory.added.length} added · ${s.inventory.removed.length} removed`}
            />
            <StatBlock
              label="Enforcement rules"
              value={s.enforcement.rules_after}
              meta={`was ${s.enforcement.rules_before}`}
            />
          </div>
        </CardBody>
      </Card>

      {s.findings.length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-7">
            <CardHeader title="What would follow" sub="Every finding carries the reason it was produced." />
            <ul className="mt-5 flex flex-col gap-3">
              {s.findings.map((f, i) => (
                <li key={i} className="rounded-xl bg-md-surface-container p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Chip tone={SEVERITY_TONE[f.severity]}>{f.severity}</Chip>
                    <Chip tone="neutral">{f.area}</Chip>
                  </div>
                  <p className="mt-3 text-body-medium text-md-on-surface">{f.summary}</p>
                  <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
                    {f.because}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardBody className="p-7">
            <CardHeader title="Jurisdictions" sub="What the engine says applies afterwards." />
            <dl className="mt-5 flex flex-col gap-3 text-body-medium">
              <Row label="Before" value={s.jurisdiction.before.join(', ') || '—'} />
              <Row label="After" value={s.jurisdiction.after.join(', ') || '—'} />
              <Row label="Regimes" value={s.jurisdiction.regimes.join(', ') || '—'} />
            </dl>
          </CardBody>
        </Card>

        <Card className="rounded-2xl">
          <CardBody className="p-7">
            <CardHeader title="Consent" sub="Purposes the change would implicate." />
            {s.consent.requirements.length === 0 ? (
              <p className="mt-5 text-body-medium text-md-on-surface-variant">
                No consent requirement would change.
              </p>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {s.consent.requirements.map((r, i) => (
                  <li key={i} className="text-body-medium">
                    <span className="font-medium text-md-on-surface">{r.vendor}</span>
                    <span className="text-md-on-surface-variant">
                      {' '}— {r.from ?? 'none'} → {r.to}
                    </span>
                    <p className="mt-1 text-body-small text-md-on-surface-variant">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {s.unsupported.length > 0 ? (
        <Notice tone="warning" icon="alert" title={`${s.unsupported.length} change could not be evaluated`}>
          <ul className="flex flex-col gap-2">
            {s.unsupported.map((u, i) => (
              <li key={i}>
                <span className="font-mono text-label-medium">{u.change.operation}</span> — {u.reason}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {/* Rendered in full rather than summarised. Each one names a specific way
          this result can be misread, and a shortened version would drop the
          one that mattered to whoever is reading. */}
      <Card tone="low" className="rounded-2xl">
        <CardBody className="p-7">
          <CardHeader title="What this does not tell you" />
          <ul className="mt-4 flex flex-col gap-2.5">
            {s.caveats.map((c) => (
              <li key={c} className="text-body-small leading-relaxed text-md-on-surface-variant">
                {c}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-md-on-surface-variant">{label}</dt>
      <dd className="text-right font-mono text-label-medium text-md-on-surface">{value}</dd>
    </div>
  );
}
