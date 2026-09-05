import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, Notice, cn } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * Consent decisions, and the questions this platform will not answer.
 *
 * ## Three states, never two
 *
 * A dashboard usually has data or no data. This one has three:
 *
 *   **measured, and it was zero** — a real finding. Nobody accepted anything.
 *   **nothing recorded yet** — the field exists and is empty.
 *   **not measurable** — the platform cannot answer, by design.
 *
 * Rendering the third as "0" is the failure this file is written to avoid. A
 * zero next to "Country" would read as "no visitors from anywhere", when the
 * truth is that Rift never asks where anyone is. The API says which dimensions
 * those are and why; this shows the reason rather than paraphrasing it, so the
 * screen and the contract cannot drift apart.
 */

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 1000) / 10}%`;
}

/** A rate with nothing behind it is null, and null is not zero. */
function Rate({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div>
      <div
        className={cn(
          'text-headline-medium font-normal leading-none tabular-nums',
          value === null ? 'text-md-on-surface-variant/50' : 'text-md-on-surface',
        )}
      >
        {percent(value)}
      </div>
      <div className="mt-2 text-label-medium text-md-on-surface-variant">{label}</div>
      {value === null && hint ? (
        <div className="mt-1 text-label-small text-md-on-surface-variant/70">{hint}</div>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  sub,
  rows,
}: {
  title: string;
  sub: string;
  rows: W.WireConsentBreakdownRow[];
}) {
  return (
    <Card className="rounded-2xl">
      <CardBody className="p-6">
        <CardHeader title={title} sub={sub} />
        {rows.length === 0 ? (
          <p className="mt-4 text-body-small text-md-on-surface-variant">
            No decisions recorded for this breakdown yet.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.key ?? '__not_recorded__'} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'text-body-medium',
                      // A row for a field nobody populated is real data and is
                      // shown, but it is not the same kind of thing as a value.
                      row.key === null
                        ? 'italic text-md-on-surface-variant'
                        : 'text-md-on-surface',
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="shrink-0 text-label-medium tabular-nums text-md-on-surface-variant">
                    {percent(row.acceptance_rate)} of {row.total}
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-md-surface-variant">
                  <span
                    className="bg-md-success"
                    style={{ width: `${(row.granted / Math.max(1, row.total)) * 100}%` }}
                  />
                  <span
                    className="bg-md-outline"
                    style={{ width: `${(row.denied / Math.max(1, row.total)) * 100}%` }}
                  />
                  <span
                    className="bg-md-warning"
                    style={{ width: `${(row.withdrawn / Math.max(1, row.total)) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function ConsentAnalytics({ data }: { data: W.WireConsentAnalytics | null }) {
  if (!data) {
    return (
      <EmptyState
        icon="consent"
        title="Consent analytics are unavailable"
        body="Rift could not read consent decisions for this selection. This is a connection problem, not a finding about your visitors."
      />
    );
  }

  const { totals, rates } = data;

  if (totals.decisions === 0) {
    return (
      <EmptyState
        icon="consent"
        title="No consent decisions recorded yet"
        body="Once the snippet is installed and a visitor answers the banner, their decision appears here. This is genuinely empty, not unavailable."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-2xl">
        <CardBody className="flex flex-wrap items-center gap-x-10 gap-y-6 p-7">
          <div>
            <div className="text-headline-medium font-normal leading-none tabular-nums text-md-on-surface">
              {totals.decisions.toLocaleString()}
            </div>
            <div className="mt-2 text-label-medium text-md-on-surface-variant">
              decisions from {totals.principals.toLocaleString()} visitor(s)
            </div>
          </div>
          <Rate label="Accepted everything" value={rates.acceptance_rate} />
          <Rate label="Refused everything" value={rates.rejection_rate} />
          <Rate label="Chose some, refused others" value={rates.partial_rate} />
          <Rate label="Withdrew something" value={rates.withdrawal_rate} />
        </CardBody>
      </Card>

      <Notice tone="neutral" title="Rates count people, not decisions">
        Somebody who accepts, withdraws and accepts again is one visitor who currently accepts —
        the totals above count all three.
      </Notice>

      {data.trend.length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader title="Over time" sub="Decisions per day, in UTC." />
            <div className="mt-6 flex h-32 items-end gap-1">
              {data.trend.map((point) => {
                const total = point.granted + point.denied + point.withdrawn;
                const max = Math.max(
                  ...data.trend.map((p) => p.granted + p.denied + p.withdrawn),
                  1,
                );
                return (
                  <div
                    key={point.day}
                    className="flex min-w-0 flex-1 flex-col justify-end gap-px"
                    title={`${point.day}: ${point.granted} granted, ${point.denied} denied, ${point.withdrawn} withdrawn`}
                  >
                    <span
                      className="rounded-t-sm bg-md-success"
                      style={{ height: `${(point.granted / max) * 100}%` }}
                    />
                    <span className="bg-md-outline" style={{ height: `${(point.denied / max) * 100}%` }} />
                    <span
                      className="rounded-b-sm bg-md-warning"
                      style={{ height: `${(point.withdrawn / max) * 100}%` }}
                    />
                    <span className="sr-only">
                      {point.day}: {total} decisions
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Breakdown title="By purpose" sub="What visitors agreed to, and what they did not." rows={data.by_purpose} />
        <Breakdown
          title="By jurisdiction"
          sub="From the markets you declared, never from anybody's location."
          rows={data.by_jurisdiction}
        />
        <Breakdown
          title="By policy version"
          sub="How each approved configuration performed."
          rows={data.by_policy_version}
        />
        <Breakdown title="By mechanism" sub="Banner, preference centre, or API." rows={data.by_mechanism} />
        <Breakdown title="By vendor" sub="Where the decision named one." rows={data.by_vendor} />
        <Breakdown title="By website" sub="Across the sites in this organisation." rows={data.by_site} />
      </div>

      {data.unavailable_dimensions.length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader
              title="Not measurable"
              sub="Questions Rift will not answer, and why. These are not zeroes."
            />
            <ul className="mt-5 flex flex-col gap-4">
              {data.unavailable_dimensions.map((d) => (
                <li key={d.dimension} className="flex gap-3">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0 text-md-on-surface-variant" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body-medium capitalize text-md-on-surface">
                        {d.dimension.replace(/_/g, ' ')}
                      </span>
                      <Chip tone="neutral">Not measurable</Chip>
                    </div>
                    <p className="mt-1 text-body-small leading-relaxed text-md-on-surface-variant">
                      {d.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
