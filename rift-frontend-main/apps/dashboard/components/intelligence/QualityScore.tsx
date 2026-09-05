import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, Notice, cn } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * The posture score, shown so it can be argued with.
 *
 * ## Deliberately not a traffic light
 *
 * The obvious design is a big green or red number. It is avoided here because
 * green reads as "compliant" and red reads as "you are breaking the law", and
 * this score says neither — it describes whether the operational scaffolding is
 * in place, which is a different question and one the platform can actually
 * answer.
 *
 * So the number is neutral, the bands are words rather than colours, and the
 * only colour is on individual components where it means "this specific thing
 * is complete" rather than "you are safe". The disclaimer sits beside the score
 * rather than in a footnote nobody reads.
 *
 * ## Components that were set aside are shown, not hidden
 *
 * A high score over five components is not the same as a high score over nine.
 * Hiding the excluded ones would let a thin deployment look like a healthy one,
 * so they are listed with the reason they could not be measured.
 */

const BAND_LABEL: Record<W.WireQuality['band'], string> = {
  strong: 'Well configured',
  fair: 'Some gaps',
  weak: 'Needs attention',
};

export function QualityScore({ quality }: { quality: W.WireQuality | null }) {
  if (!quality) {
    return (
      <EmptyState
        icon="shieldCheck"
        title="Quality score unavailable"
        body="Rift could not read the configuration for this site. This is a connection problem, not a score of zero."
      />
    );
  }

  const applicable = quality.components.filter((c) => c.applicable);
  const setAside = quality.components.filter((c) => !c.applicable);

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-2xl">
        <CardBody className="flex flex-wrap items-start justify-between gap-8 p-7">
          <div>
            <div className="flex items-baseline gap-2">
              {/* Neutral on purpose: a green number here would read as a
                  compliance verdict, which this is not. */}
              <span className="text-display-small font-normal leading-none tabular-nums text-md-on-surface">
                {quality.score}
              </span>
              <span className="text-title-medium text-md-on-surface-variant">/ 100</span>
            </div>
            <p className="mt-2 text-body-medium text-md-on-surface">{BAND_LABEL[quality.band]}</p>
            <p className="mt-1 text-label-medium text-md-on-surface-variant">
              Scored over {quality.weight_considered} of 100 points that applied to this site.
            </p>
          </div>

          <Notice tone="neutral" title="This is not a compliance certification" className="max-w-[420px]">
            It describes how well this site is set up to handle consent — whether a configuration is
            approved, whether the scan behind it is recent, whether anything enforces it. Whether you
            comply with a law depends on facts about your business that Rift does not hold.
          </Notice>
        </CardBody>
      </Card>

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader
            title="What the score is made of"
            sub="Each component says what was measured and what would raise it."
          />
          <ul className="mt-5 flex flex-col gap-5">
            {applicable.map((c) => {
              const share = c.weight === 0 ? 0 : c.earned / c.weight;
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-medium text-md-on-surface">{c.label}</span>
                    <span className="shrink-0 text-label-medium tabular-nums text-md-on-surface-variant">
                      {Math.round(c.earned * 10) / 10} / {c.weight}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-md-surface-variant">
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        // Colour here means "this component is complete", never
                        // "you are safe".
                        share >= 0.999
                          ? 'bg-md-success'
                          : share >= 0.5
                            ? 'bg-md-primary'
                            : 'bg-md-outline',
                      )}
                      style={{ width: `${Math.max(2, share * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
                    {c.detail}
                  </p>
                  {c.remedy ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-body-small leading-relaxed text-md-on-surface">
                      <Icon name="arrowRight" size={14} className="mt-1 shrink-0 text-md-primary" />
                      {c.remedy}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {setAside.length > 0 ? (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader
              title="Not scored"
              sub="Nothing to measure yet. Excluded from the total rather than counted as failures."
            />
            <ul className="mt-4 flex flex-col gap-3">
              {setAside.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <Chip tone="neutral">Not scored</Chip>
                  <div className="min-w-0">
                    <span className="text-body-medium text-md-on-surface">{c.label}</span>
                    <p className="mt-0.5 text-body-small leading-relaxed text-md-on-surface-variant">
                      {c.detail}
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
