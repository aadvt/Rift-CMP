'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Notice } from '@rift/ui';
import { changeExperimentStatus } from '@/app/actions';

type Status = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

/**
 * Starting, pausing, completing and archiving an experiment.
 *
 * Until this existed the experiments feature was inert: experiments could be
 * listed and analysed, and never started. The platform has had the endpoint and
 * the lifecycle table the whole time, with no caller.
 *
 * ## The moves offered mirror the platform's table
 *
 * `TRANSITIONS` is a copy of the one in `shared/experiment.ts`, and copying it
 * is deliberate. The dashboard is a separate workspace root and importing
 * across it would mean bundling the shared package into the browser for one
 * constant. The platform remains the authority — every move is validated there
 * against where the experiment actually is, and an illegal one is refused with
 * a sentence naming what is allowed instead. This copy only decides which
 * buttons to draw.
 *
 * That is why a refusal is surfaced verbatim rather than replaced. "Cannot
 * start a completed experiment" tells somebody what to do next; "something went
 * wrong" sends them to look for a fault that is not there.
 *
 * ## Starting asks first
 *
 * Every other move is recoverable — a paused experiment can resume, a completed
 * one can be archived. Starting is the one that begins showing real visitors a
 * different consent banner, so it confirms. The rest do not, because a
 * confirmation on a reversible action trains people to click through the one
 * that matters.
 */
const TRANSITIONS: Record<Status, readonly Status[]> = {
  DRAFT: ['RUNNING', 'ARCHIVED'],
  SCHEDULED: ['RUNNING', 'DRAFT', 'ARCHIVED'],
  RUNNING: ['PAUSED', 'COMPLETED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

const LABEL: Record<Status, string> = {
  DRAFT: 'Return to draft',
  SCHEDULED: 'Schedule',
  RUNNING: 'Start',
  PAUSED: 'Pause',
  COMPLETED: 'Complete',
  ARCHIVED: 'Archive',
};

/** Resuming is still `RUNNING`, but calling it "Start" from a pause is wrong. */
function labelFor(from: Status, to: Status): string {
  if (to === 'RUNNING' && from === 'PAUSED') return 'Resume';
  return LABEL[to];
}

const STYLE: Partial<Record<Status, 'filled' | 'tonal' | 'outlined' | 'text'>> = {
  RUNNING: 'filled',
  PAUSED: 'tonal',
  COMPLETED: 'tonal',
  ARCHIVED: 'text',
  DRAFT: 'text',
  SCHEDULED: 'tonal',
};

export function LifecycleControls({
  experimentId,
  status,
}: {
  experimentId: string;
  status: Status;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirming, setConfirming] = React.useState<Status | null>(null);

  const moves = TRANSITIONS[status] ?? [];

  function apply(next: Status) {
    setConfirming(null);
    start(async () => {
      const result = await changeExperimentStatus(experimentId, next);
      if (!result.ok) {
        toast.error('That move was refused', { description: result.message });
        // Refresh anyway: a refusal usually means this tab is looking at a
        // stale status, and re-reading is what makes the buttons correct again.
        router.refresh();
        return;
      }
      toast.success(`Experiment ${next.toLowerCase()}`);
      router.refresh();
    });
  }

  if (moves.length === 0) {
    return (
      <p className="text-label-medium text-md-on-surface-variant">
        Archived. Nothing further can be changed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {moves.map((next) => (
          <Button
            key={next}
            variant={STYLE[next] ?? 'tonal'}
            size="sm"
            disabled={pending}
            onClick={() => (next === 'RUNNING' && status !== 'PAUSED' ? setConfirming(next) : apply(next))}
          >
            {labelFor(status, next)}
          </Button>
        ))}
      </div>

      {confirming === 'RUNNING' ? (
        <Notice
          tone="warning"
          icon="alert"
          title="This starts showing real visitors a different banner"
          actions={
            <>
              <Button size="sm" variant="filled" disabled={pending} onClick={() => apply('RUNNING')}>
                {pending ? 'Starting…' : 'Start the experiment'}
              </Button>
              <Button size="sm" variant="text" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
            </>
          }
        >
          Visitors will be assigned to a variant from the moment this starts. Rift re-checks the
          configuration first and refuses if the site&rsquo;s approved policy has changed since this
          experiment was drafted.
        </Notice>
      ) : null}
    </div>
  );
}
