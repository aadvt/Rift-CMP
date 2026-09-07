import { Card, CardBody, CardHeader, Chip, EmptyState, Notice, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * Two consent experiences, side by side, without declaring a winner.
 *
 * ## The two misreadings this screen is built against
 *
 * **That a difference is a result.** Two arms always differ. Most differences
 * are noise, and a table that renders every one of them identically teaches an
 * operator to ship on the strength of forty visitors. So each row carries an
 * explicit reading — *observed difference* until a real test says otherwise —
 * and the significance panel names its method, its sample and its interval so
 * the claim can be argued with rather than taken.
 *
 * **That higher acceptance is a better outcome.** It is the number everybody
 * looks at first and the one most easily moved in the wrong direction: an arm
 * can lift acceptance by asking less clearly. So acceptance is never shown
 * alone. Completion rate sits beside it — how many people the banner got any
 * answer from, which is what a confusing variant actually damages — and the
 * posture block sits below, saying plainly that enforcement and tracker findings
 * are site-wide and not attributable to an arm.
 *
 * There is no winner badge, no green arm, and no "recommended" label. Choosing
 * what to ship is a judgement about the site; this screen's job is to make that
 * judgement possible, not to pre-empt it.
 */

const READING_LABEL: Record<W.WireSignificance['reading'], string> = {
  observed_difference: 'Observed difference',
  significant: 'Unlikely to be chance',
  not_significant: 'Within the range of chance',
};

const READING_TONE: Record<W.WireSignificance['reading'], ChipTone> = {
  // Deliberately not a success tone. "Unlikely to be chance" is a statement
  // about the sample, not an endorsement of the arm.
  observed_difference: 'neutral',
  significant: 'primary',
  not_significant: 'neutral',
};

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 1000) / 10}%`;
}

function signed(value: number | null): string {
  if (value === null) return '—';
  const points = Math.round(value * 1000) / 10;
  return `${points > 0 ? '+' : ''}${points}pp`;
}

function Row({
  label,
  variants,
  read,
  hint,
}: {
  label: string;
  variants: W.WireVariantMetrics[];
  read: (v: W.WireVariantMetrics) => string;
  hint?: string;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="border-b border-md-outline-variant/40 px-4 py-3 text-left text-[13.5px] font-medium text-md-on-surface"
      >
        {label}
        {hint ? (
          <span className="mt-0.5 block text-label-small font-normal text-md-on-surface-variant/75">
            {hint}
          </span>
        ) : null}
      </th>
      {variants.map((variant) => (
        <td
          key={variant.variant_key}
          className="border-b border-md-outline-variant/40 px-4 py-3 text-right text-[13.5px] tabular-nums text-md-on-surface"
        >
          {read(variant)}
        </td>
      ))}
    </tr>
  );
}

export function ExperimentComparison({
  comparison,
}: {
  comparison: W.WireExperimentComparison | null;
}) {
  if (!comparison) {
    return (
      <EmptyState
        icon="analytics"
        title="Comparison unavailable"
        body="Rift could not read this experiment's results. This is a connection problem, not an experiment with no effect."
      />
    );
  }

  const { variants, significance, posture, caveats } = comparison;
  const control = variants.find((v) => v.is_control) ?? null;
  const measured = variants.some((v) => v.impressions > 0 || v.deciders > 0);

  return (
    <div className="flex flex-col gap-5">
      {!measured ? (
        <Notice tone="neutral" title="Nothing recorded yet">
          Once the experiment is running and a visitor sees the banner, results appear here. An
          empty comparison is not a finding that the variants perform the same.
        </Notice>
      ) : null}

      <Card>
        <div className="border-b border-md-outline-variant p-5 md:px-6">
          <CardHeader
            title="Variant comparison"
            sub="Rates count people, not decisions. A visitor who accepted, withdrew and accepted again is one visitor who currently accepts."
          />
        </div>
        {/* Deliberately not `data-stack`. Every other table in this app
            becomes cards on a phone, because a row is one record and a card
            reads better than a sideways swipe. This one is transposed —
            metrics down, variants across — so the side-by-side comparison IS
            the content. Stacked into per-metric cards it would still work, but
            the thing somebody opened it to do, holding two numbers next to
            each other, would be gone. It scrolls instead, and at 640px that is
            one short swipe rather than the 900 the others needed. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th className="h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-left text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75">
                  Metric
                </th>
                {variants.map((variant) => (
                  <th
                    key={variant.variant_key}
                    className="h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-right text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75"
                  >
                    <span className="inline-flex items-center gap-2">
                      {variant.variant_name}
                      {variant.is_control ? <Chip tone="neutral">control</Chip> : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Allocation" variants={variants} read={(v) => `${v.allocation}%`} />
              <Row
                label="Impressions"
                hint="Times the banner was shown"
                variants={variants}
                read={(v) => v.impressions.toLocaleString()}
              />
              <Row
                label="Answered"
                hint="People who made any choice"
                variants={variants}
                read={(v) => v.deciders.toLocaleString()}
              />
              <Row
                label="Completion"
                hint="Of those shown the banner, how many answered it"
                variants={variants}
                read={(v) => percent(v.completion_rate)}
              />
              <Row label="Accepted all" variants={variants} read={(v) => percent(v.acceptance_rate)} />
              <Row label="Rejected all" variants={variants} read={(v) => percent(v.rejection_rate)} />
              <Row label="Chose some" variants={variants} read={(v) => percent(v.partial_rate)} />
              <Row label="Withdrew" variants={variants} read={(v) => percent(v.withdrawal_rate)} />
            </tbody>
          </table>
        </div>
      </Card>

      {control && Object.keys(significance).length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader
              title={`Against ${control.variant_name}`}
              sub="A method, a sample and an interval — so the claim can be checked rather than taken."
            />
            <div className="mt-5 flex flex-col gap-6">
              {Object.entries(significance).map(([variantKey, metrics]) => (
                <div key={variantKey}>
                  <p className="text-body-medium font-medium text-md-on-surface">
                    {variants.find((v) => v.variant_key === variantKey)?.variant_name ?? variantKey}
                  </p>
                  <ul className="mt-3 flex flex-col gap-3">
                    {Object.entries(metrics).map(([metric, result]) => (
                      <li
                        key={metric}
                        className="border-t border-md-outline-variant/40 pt-3 first:border-0 first:pt-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-body-small capitalize text-md-on-surface">
                            {metric}
                          </span>
                          <span className="text-body-small tabular-nums text-md-on-surface-variant">
                            {signed(result.difference)}
                          </span>
                          <Chip tone={READING_TONE[result.reading]}>
                            {READING_LABEL[result.reading]}
                          </Chip>
                        </div>

                        {result.method ? (
                          <p className="mt-1 text-label-medium text-md-on-surface-variant">
                            {result.method}, {Math.round((result.confidence_level ?? 0) * 100)}%
                            confidence · p = {result.p_value} · interval{' '}
                            {signed(result.interval?.lower ?? null)} to{' '}
                            {signed(result.interval?.upper ?? null)} · n ={' '}
                            {result.sample.control} vs {result.sample.variant}
                          </p>
                        ) : (
                          <p className="mt-1 text-label-medium text-md-on-surface-variant">
                            {/* Why no test ran. Declining is a statement an
                                operator can act on; a p-value from twelve
                                visitors is one that looks the same and is not. */}
                            {result.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader
            title="Site posture while this ran"
            sub="Shown so a lift in acceptance is not read on its own."
          />
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            {Object.entries(posture)
              .slice(0, 1)
              .map(([key, value]) => (
                <div key={key} className="flex flex-wrap gap-x-10 gap-y-4">
                  <div>
                    <div className="text-[22px] font-semibold tabular-nums text-md-on-surface">
                      {value.enforcement_blocked.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-md-on-surface-variant/80">
                      blocked or gated
                    </div>
                  </div>
                  <div>
                    <div className="text-[22px] font-semibold tabular-nums text-md-on-surface">
                      {value.enforcement_events.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-md-on-surface-variant/80">
                      enforcement decisions
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <Notice tone="neutral" title="These are site-wide, not per arm" className="mt-5">
            Scans and enforcement do not run per visitor, so a finding during an experiment belongs
            to the site rather than to the arm somebody happened to see. Splitting them by arm would
            invent an attribution the data cannot support.
          </Notice>
        </CardBody>
      </Card>

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader title="What this comparison does not show" sub="Read the numbers against this." />
          <ul className="mt-4 flex flex-col gap-2">
            {caveats.map((caveat) => (
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
