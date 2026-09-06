'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Card, CardBody, Chip, EmptyState, Field, Input, Notice, cn } from '@rift/ui';
import { setRightsRequestStatus } from '@/app/actions';
import type { RightsRequest } from '@/lib/api/endpoints';

/**
 * The rights request queue.
 *
 * People can already submit access, deletion and objection requests through the
 * public plane — `POST /rights/requests` has been live since the rights work
 * landed. Until this screen existed those requests arrived in the database and
 * nowhere else, which is the worst possible place for a statutory clock to be
 * running.
 *
 * ## Why the deadline is not computed
 *
 * `due_at` is operator-declared and stays that way. Statutory response windows
 * differ by regime, and computing one would mean asserting which regime governs
 * a particular request — a legal conclusion this product refuses to reach on
 * somebody's behalf. What the screen does instead is show the declared deadline
 * when there is one, and say plainly when there is not.
 *
 * ## Why completing asks for a note
 *
 * Marking a request complete is the operator claiming they did the work in
 * their own systems. Rift cannot see into those systems and cannot verify it.
 * The note is therefore the only record of what actually happened, and it is
 * the thing a regulator would ask to see — so it is required for `completed`
 * and `refused`, and optional for the rest.
 */
const STATUS_TONE = {
  received: 'warning',
  in_progress: 'primary',
  completed: 'success',
  refused: 'neutral',
  withdrawn: 'neutral',
} as const;

const STATUS_LABEL = {
  received: 'Received',
  in_progress: 'In progress',
  completed: 'Completed',
  refused: 'Refused',
  withdrawn: 'Withdrawn',
} as const;

type Status = RightsRequest['status'];

/** Statuses that are an account of a decision, so they need one. */
const NEEDS_NOTE: readonly Status[] = ['completed', 'refused'];

const MOVES: Record<Status, readonly Status[]> = {
  received: ['in_progress', 'completed', 'refused'],
  in_progress: ['completed', 'refused'],
  completed: [],
  refused: [],
  withdrawn: [],
};

export function RightsQueue({ requests }: { requests: RightsRequest[] }) {
  const open = requests.filter((r) => r.status === 'received' || r.status === 'in_progress');
  const closed = requests.filter((r) => !open.includes(r));

  if (requests.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="No rights requests"
        body="Access, deletion and objection requests submitted through your site appear here with the clock already running."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="neutral" icon="info" title="Rift does not compute your deadline">
        Response windows differ by regime, and naming one would mean asserting which regime governs a
        particular request. Deadlines shown here are the ones you declared.
      </Notice>

      {open.length > 0 ? (
        <section>
          <h2 className="text-title-large font-medium text-md-on-surface">
            {open.length} open request{open.length === 1 ? '' : 's'}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {open.map((r) => <RequestCard key={r.request_id} request={r} />)}
          </div>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section>
          <h2 className="text-title-large font-medium text-md-on-surface">Closed</h2>
          <div className="mt-4 flex flex-col gap-4">
            {closed.map((r) => <RequestCard key={r.request_id} request={r} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RequestCard({ request: r }: { request: RightsRequest }) {
  const router = useRouter();
  const [note, setNote] = React.useState(r.resolution_note ?? '');
  const [moving, setMoving] = React.useState<Status | null>(null);
  const [pending, start] = React.useTransition();

  const moves = MOVES[r.status] ?? [];
  const overdue =
    r.due_at !== null && r.responded_at === null && new Date(r.due_at).getTime() < Date.now();

  function apply(next: Status) {
    if (NEEDS_NOTE.includes(next) && !note.trim()) {
      setMoving(next);
      toast('A note is required', {
        description: 'Rift cannot see your systems, so this note is the only record of what was done.',
      });
      return;
    }

    setMoving(null);
    start(async () => {
      const result = await setRightsRequestStatus(r.request_id, next, note.trim() || null);
      if (!result.ok) {
        toast.error('Could not update the request', { description: result.message });
        return;
      }
      toast.success(`Marked ${STATUS_LABEL[next].toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <Card className={cn('rounded-2xl', overdue && 'ring-1 ring-md-error')}>
      <CardBody className="p-7">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Chip>
          <Chip tone="neutral">{r.kind}</Chip>
          {r.jurisdictions.map((j) => <Chip key={j} tone="primary">{j}</Chip>)}
          {overdue ? <Chip tone="error" glyph="alert">Past your declared deadline</Chip> : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
          <Def label="Person" value={r.principal_external_id} mono />
          <Def label="Received" value={new Date(r.received_at).toLocaleString()} />
          <Def
            label="Deadline"
            value={r.due_at ? new Date(r.due_at).toLocaleDateString() : 'None declared'}
          />
          <Def
            label="Responded"
            value={r.responded_at ? new Date(r.responded_at).toLocaleString() : '—'}
          />
          {r.contact ? <Def label="Contact" value={r.contact} mono /> : null}
        </div>

        {r.message ? (
          <p className="mt-4 rounded-xl bg-md-surface-container p-5 text-body-medium leading-relaxed text-md-on-surface-variant">
            {r.message}
          </p>
        ) : null}

        {r.rule_references.length > 0 ? (
          <p className="mt-3 font-mono text-label-small text-md-on-surface-variant">
            {r.rule_references.join(' · ')}
          </p>
        ) : null}

        {moves.length > 0 ? (
          <>
            <div className="mt-5 max-w-[560px]">
              <Field
                label="What was done"
                htmlFor={`note-${r.request_id}`}
                hint="Required to complete or refuse. Rift cannot verify work done in your own systems, so this is the record."
                {...(moving && NEEDS_NOTE.includes(moving) && !note.trim()
                  ? { error: 'Write what was done before closing this request.' }
                  : {})}
              >
                <Input
                  id={`note-${r.request_id}`}
                  value={note}
                  placeholder="Exported and sent on 12 March; account deleted."
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {moves.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === 'completed' ? 'filled' : next === 'refused' ? 'text' : 'tonal'}
                  disabled={pending}
                  onClick={() => apply(next)}
                >
                  {pending ? 'Saving…' : `Mark ${STATUS_LABEL[next].toLowerCase()}`}
                </Button>
              ))}
            </div>
          </>
        ) : r.resolution_note ? (
          <p className="mt-5 rounded-xl bg-md-surface-container p-5 text-body-medium text-md-on-surface-variant">
            <span className="font-medium text-md-on-surface">What was done: </span>
            {r.resolution_note}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Def({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-md-outline-variant/40 py-2">
      <span className="text-label-medium text-md-on-surface-variant">{label}</span>
      <span
        className={cn(
          'text-right text-label-medium text-md-on-surface',
          mono && 'break-all font-mono',
        )}
      >
        {value}
      </span>
    </div>
  );
}
