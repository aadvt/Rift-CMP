import { Card, CardBody, CardHeader, Chip, Notice } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { ExperimentComparison } from '@/components/experiments/Comparison';
import { getExperiment, getExperimentComparison } from '@/lib/api/endpoints';
import { LifecycleControls } from '@/components/experiments/LifecycleControls';

export const metadata = { title: 'Experiment' };
export const dynamic = 'force-dynamic';

/**
 * One experiment: what it varies, and what happened.
 *
 * The definition is shown above the results on purpose. A comparison read
 * without knowing which copy each arm carried is a pair of numbers with no
 * subject, and the first question anybody asks of a surprising result is what
 * the variant actually said.
 */
export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ experimentId: string }>;
}) {
  const { experimentId } = await params;
  const [experiment, comparison] = await Promise.all([
    getExperiment(experimentId),
    getExperimentComparison(experimentId),
  ]);

  return (
    <>
      <ScreenHeader
        title={experiment?.name ?? 'Experiment'}
        crumb={[
          { label: 'Experiments', href: '/dashboard/experiments' },
          { label: experiment?.name ?? 'Experiment' },
        ]}
        badge={
          experiment ? (
            <Chip tone={experiment.serving ? 'success' : 'neutral'} dot>
              {experiment.serving ? 'Assigning visitors' : experiment.status}
            </Chip>
          ) : undefined
        }
        actions={
          experiment ? (
            <LifecycleControls experimentId={experiment.experiment_id} status={experiment.status} />
          ) : undefined
        }
      />
      <Screen>
        <div className="flex flex-col gap-5">
          {experiment ? (
            <Card className="rounded-2xl">
              <CardBody className="p-6">
                <CardHeader
                  title="What each variant changes"
                  sub="Display copy only. A variant has no field in which to express a purpose, a rule, or an enforcement action."
                />
                <ul className="mt-5 flex flex-col gap-5">
                  {experiment.variants.map((variant) => (
                    <li
                      key={variant.variant_id}
                      className="border-t border-md-outline-variant/50 pt-5 first:border-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-medium font-medium text-md-on-surface">
                          {variant.name}
                        </span>
                        <Chip tone="neutral">{variant.allocation}%</Chip>
                        {variant.is_control ? <Chip tone="primary">control</Chip> : null}
                      </div>

                      {variant.text && Object.keys(variant.text).length > 0 ? (
                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
                          {Object.entries(variant.text)
                            .filter(([, value]) => value !== null)
                            .map(([field, value]) => (
                              <div key={field} className="contents">
                                <dt className="text-label-medium text-md-on-surface-variant">
                                  {field.replace(/_/g, ' ')}
                                </dt>
                                <dd className="text-body-small text-md-on-surface">
                                  &ldquo;{value}&rdquo;
                                </dd>
                              </div>
                            ))}
                        </dl>
                      ) : (
                        <p className="mt-2 text-body-small text-md-on-surface-variant">
                          Uses the site&rsquo;s own copy, unchanged.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Notice tone="neutral" title="Experiments optimise consent UX. They do not redefine consent requirements.">
            Both arms pass through the same policy evaluation and the same enforcement. Drift and
            shadow tracker detection are unaffected — an experiment cannot suppress a finding,
            because it cannot change anything a scan looks at.
          </Notice>

          <ExperimentComparison comparison={comparison} />
        </div>
      </Screen>
    </>
  );
}
