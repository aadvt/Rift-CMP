import Link from 'next/link';
import type { Route } from 'next';
import { Card, CardHeader, Chip, EmptyState, Notice, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * Every experiment on this organisation's sites.
 *
 * ## Status and "serving" are different things
 *
 * An experiment can be `RUNNING` and not serving anybody — scheduled to start
 * next week, or already past its end date. Showing only the status would tell an
 * operator their experiment is live when no visitor is being assigned to
 * anything, which is the exact question they open this page to answer.
 *
 * So the badge is the status, and a separate marker says whether arms are being
 * handed out right now. They agree most of the time, and the times they do not
 * are the times somebody needs to know.
 */

const STATUS_TONE: Record<W.WireExperiment['status'], ChipTone> = {
  DRAFT: 'neutral',
  SCHEDULED: 'primary',
  RUNNING: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

const STATUS_LABEL: Record<W.WireExperiment['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

function window(experiment: W.WireExperiment): string {
  const from = experiment.starts_at
    ? new Date(experiment.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const to = experiment.ends_at
    ? new Date(experiment.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  if (!from && !to) return 'No end date';
  if (from && to) return `${from} – ${to}`;
  return from ? `From ${from}` : `Until ${to}`;
}

export function ExperimentList({ experiments }: { experiments: W.WireExperiment[] | null }) {
  if (!experiments) {
    return (
      <EmptyState
        icon="analytics"
        title="Experiments unavailable"
        body="Rift could not read your experiments. This is a connection problem, not an empty list."
      />
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <EmptyState
          icon="analytics"
          title="No experiments yet"
          body="An experiment varies how a consent choice is worded and measures what changes. It cannot vary what the choice means."
        />
        <Notice tone="neutral" title="Experiments optimise consent UX. They do not redefine consent requirements.">
          A variant can change the banner&rsquo;s title, body and button labels. It cannot add or
          remove a purpose, alter a policy, or change what enforcement does — there is no field in
          which it could express one.
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="border-b border-md-outline-variant p-5 md:px-6">
          <CardHeader
            title="Consent experiments"
            sub="Each varies banner copy only. Status is what an operator set; serving is whether visitors are being assigned right now."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                {['Experiment', 'Status', 'Variants', 'Allocation', 'Window', 'Serving'].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-[2] h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-left text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {experiments.map((experiment) => (
                <tr key={experiment.experiment_id} className="transition-colors hover:bg-md-primary/8">
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px]">
                    <Link
                      href={`/dashboard/experiments/${experiment.experiment_id}` as Route}
                      className="text-[13.5px] font-medium text-md-primary hover:underline"
                    >
                      {experiment.name}
                    </Link>
                    {experiment.description ? (
                      <span className="mt-0.5 block max-w-[380px] truncate text-[12.5px] text-md-on-surface-variant/75">
                        {experiment.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px]">
                    <Chip tone={STATUS_TONE[experiment.status]}>
                      {STATUS_LABEL[experiment.status]}
                    </Chip>
                  </td>
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">
                    {experiment.variants.length}
                  </td>
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px] font-mono text-xs text-md-on-surface-variant">
                    {experiment.variants.map((v) => `${v.allocation}`).join(' / ')}
                  </td>
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">
                    {window(experiment)}
                  </td>
                  <td className="border-b border-md-outline-variant/40 px-4 py-[13px]">
                    {/* Not the same as the status. A RUNNING experiment outside
                        its window assigns nobody, and an operator reading only
                        the badge would believe otherwise. */}
                    {experiment.serving ? (
                      <Chip tone="success" dot>
                        Assigning
                      </Chip>
                    ) : (
                      <Chip tone="neutral">Not assigning</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
