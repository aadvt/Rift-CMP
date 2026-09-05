import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, cn, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * Shadow trackers and drift, with the evidence that produced each one.
 *
 * ## Severity is shown, but not shouted
 *
 * Only `critical` gets the error tone. Everything below it is neutral or warm,
 * because a list where every row is red is a list people stop reading — and
 * most findings here are tasks rather than faults. An unclassified host is
 * something nobody has looked at yet, which is not an emergency and should not
 * look like one.
 *
 * ## Evidence is always visible
 *
 * Every finding shows where it came from: which scan, which page, which runtime
 * report. A privacy finding somebody cannot verify is one they cannot act on,
 * and eventually one they learn to ignore.
 */

const SEVERITY_TONE: Record<string, ChipTone> = {
  critical: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'neutral',
  info: 'neutral',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

function Evidence({ evidence }: { evidence: W.WireFindingEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5 border-l-2 border-md-outline-variant pl-3">
      {evidence.map((e, i) => (
        <li key={i} className="text-body-small leading-relaxed text-md-on-surface-variant">
          <span className="mr-1.5 uppercase tracking-[0.06em] text-label-small text-md-on-surface-variant/70">
            {e.source}
          </span>
          {e.detail}
        </li>
      ))}
    </ul>
  );
}

export function ShadowTrackers({ findings }: { findings: W.WireShadowTracker[] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon="shieldCheck"
        title="Nothing unaccounted for"
        body="Everything Rift observed on this site is covered by your approved configuration."
      />
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardBody className="p-6">
        <CardHeader
          title={`${findings.length} thing${findings.length === 1 ? '' : 's'} running that your configuration does not cover`}
          sub="Worst first. Each one names what was seen and where."
        />
        <ul className="mt-5 flex flex-col gap-6">
          {findings.map((f) => (
            <li key={f.id} className="border-t border-md-outline-variant/50 pt-5 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={SEVERITY_TONE[f.severity] ?? 'neutral'}>
                  {SEVERITY_LABEL[f.severity] ?? f.severity}
                </Chip>
                <span className="text-body-medium font-medium text-md-on-surface">
                  {f.vendor ?? f.host}
                </span>
                {f.vendor && f.vendor !== f.host ? (
                  <span className="text-label-medium text-md-on-surface-variant">{f.host}</span>
                ) : null}
                {/* The scanner's own certainty, never upgraded by us. */}
                <Chip tone="neutral">{f.confidence} confidence</Chip>
                {f.crosses_border && f.destination_country ? (
                  <Chip tone="neutral">sends to {f.destination_country}</Chip>
                ) : null}
              </div>

              <p className="mt-2.5 text-body-small leading-relaxed text-md-on-surface">
                {f.recommended_action}
              </p>

              {f.pages.length > 0 ? (
                <p className="mt-2 text-label-medium text-md-on-surface-variant">
                  Seen on {f.pages.length} page{f.pages.length === 1 ? '' : 's'}: {f.pages.slice(0, 3).join(', ')}
                  {f.pages.length > 3 ? '…' : ''}
                </p>
              ) : null}

              <Evidence evidence={f.evidence} />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function DriftFindings({ findings }: { findings: W.WireDriftFinding[] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon="refresh"
        title="Nothing has drifted"
        body="The site matches what you approved. Differences appear here after the next scan finds one."
      />
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardBody className="p-6">
        <CardHeader
          title={`${findings.length} difference${findings.length === 1 ? '' : 's'} since your approved configuration`}
          sub="What changed, measured against what you decided."
        />
        <ul className="mt-5 flex flex-col gap-6">
          {findings.map((f) => (
            <li key={f.id} className="border-t border-md-outline-variant/50 pt-5 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={SEVERITY_TONE[f.severity] ?? 'neutral'}>
                  {SEVERITY_LABEL[f.severity] ?? f.severity}
                </Chip>
                <span className="text-body-medium font-medium text-md-on-surface">
                  {f.vendor ?? f.host ?? 'Configuration'}
                </span>
                {f.policy_version !== null ? (
                  <Chip tone="neutral">against v{f.policy_version}</Chip>
                ) : null}
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
                {f.previous_state ? (
                  <>
                    <dt className="text-label-medium text-md-on-surface-variant">Was</dt>
                    <dd className="text-body-small text-md-on-surface-variant">{f.previous_state}</dd>
                  </>
                ) : null}
                <dt className="text-label-medium text-md-on-surface-variant">Now</dt>
                <dd className="text-body-small text-md-on-surface">{f.current_state}</dd>
              </dl>

              <p className="mt-2.5 flex items-start gap-1.5 text-body-small leading-relaxed text-md-on-surface">
                <Icon name="arrowRight" size={14} className={cn('mt-1 shrink-0 text-md-primary')} />
                {f.recommended_action}
              </p>

              <Evidence evidence={f.evidence} />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
