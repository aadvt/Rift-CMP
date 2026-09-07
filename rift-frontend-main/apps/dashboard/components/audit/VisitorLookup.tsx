'use client';
import * as React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Icon, type ChipTone } from '@rift/ui';
import type { VisitorConsentState } from '@/lib/api/types';
import { lookUpVisitor } from '@/app/actions';

/**
 * One visitor's consent, as it stands right now.
 *
 * ## Not the same as their history
 *
 * The Consent screen lists decisions as they were made. This is the *derived
 * current state* — the same derivation the runtime and the authorisation gate
 * read — so it answers "what is this person allowing today", which is the
 * question asked when somebody writes in, or when an engineer is working out
 * why a tag did or did not fire for them.
 *
 * ## Every purpose carries the version it was decided under
 *
 * A status on its own invites the wrong conclusion. `WITHDRAWN` against a
 * superseded policy version means the withdrawal happened before the current
 * notice existed, which changes what an operator should do about it. So the
 * policy version travels with the status rather than being available one click
 * away.
 */

const STATUS_TONE: Record<string, ChipTone> = {
  GRANTED: 'success',
  DENIED: 'neutral',
  WITHDRAWN: 'warning',
};

export function VisitorLookup({ siteId }: { siteId: string }) {
  const [principal, setPrincipal] = React.useState('');
  const [state, setState] = React.useState<VisitorConsentState | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (principal.trim() === '') {
      setError('Enter the visitor identifier you want to look up.');
      return;
    }
    setError(null);
    setNotFound(false);
    start(async () => {
      const outcome = await lookUpVisitor(siteId, principal.trim());
      if (outcome.state === null) {
        setState(null);
        setNotFound(true);
        return;
      }
      setState(outcome.state);
    });
  }

  return (
    <Card>
      <CardBody>
        <CardHeader
          title="Look up a visitor"
          sub="Their consent as it stands now — the same derived state the runtime and the authorisation gate read."
        />

        <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-3" noValidate>
          <Field
            label="Visitor identifier"
            htmlFor="vl-principal"
            className="min-w-[240px] flex-1"
            {...(error ? { error } : {})}
          >
            <Input
              id="vl-principal"
              mono
              lead="user"
              placeholder="anon_5f2b91c4"
              value={principal}
              invalid={Boolean(error)}
              onChange={(e) => setPrincipal(e.currentTarget.value)}
            />
          </Field>
          <Button type="submit" variant="tonal" icon="search" disabled={pending} className="mb-[2px]">
            {pending ? 'Looking up…' : 'Look up'}
          </Button>
        </form>

        {notFound ? (
          <div className="mt-5 flex gap-3 rounded-3xl bg-md-surface-container-low p-5">
            <Icon name="info" size={20} className="mt-0.5 shrink-0 text-md-on-surface-variant" />
            <div>
              <div className="text-title-large font-normal text-md-on-surface">No decisions recorded</div>
              <p className="mt-1.5 max-w-[62ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                This site has never recorded a decision from that visitor. That is an absence, not a
                refusal — they may be new, or the identifier may not be the one your systems use.
              </p>
            </div>
          </div>
        ) : null}

        {state ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-body-medium text-md-on-surface">{state.principal}</span>
              <span className="text-label-medium text-md-on-surface-variant">
                {state.purposes.length} purpose{state.purposes.length === 1 ? '' : 's'} decided
              </span>
            </div>

            <ul className="mt-4 overflow-hidden rounded-3xl border border-md-outline-variant">
              {state.purposes.map((p, i) => (
                <li
                  key={p.purposeCode}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${
                    i > 0 ? 'border-t border-md-outline-variant' : ''
                  }`}
                >
                  <span className="min-w-[7rem] font-mono text-body-medium text-md-on-surface">
                    {p.purposeCode}
                  </span>
                  <Chip tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Chip>

                  <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-label-small text-md-on-surface-variant">
                    {/* The version travels with the status: a withdrawal against a
                        superseded version means something different from one
                        against the current notice. */}
                    <span>
                      under{' '}
                      <span className="font-mono text-md-on-surface">
                        {p.policyVersionId ?? 'no version recorded'}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {new Date(p.decidedAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-body-small leading-relaxed text-md-on-surface-variant">
              A purpose absent from this list has never been decided by this visitor — which is not
              the same as denied, and is why the authorisation check reports the two differently.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
