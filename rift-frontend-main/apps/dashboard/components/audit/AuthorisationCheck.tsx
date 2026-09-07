'use client';
import * as React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Icon } from '@rift/ui';
import type * as W from '@/lib/api/backend';
import { askAuthorisation } from '@/app/actions';

/**
 * "May this visitor's data be used for this purpose, right now?"
 *
 * ## Why asking is separate from doing
 *
 * Creating an authorisation burns a single-use permission and writes a row. The
 * question is usually asked *before* deciding whether to collect the data at
 * all — to show a person why something is unavailable, or to check a batch
 * before starting. Doing that by creating an authorisation would write a row
 * and spend a permission to answer a question.
 *
 * ## Why the reason matters more than the answer
 *
 * The platform returns six distinct refusal reasons rather than one generic
 * failure, and the distinction is the useful part. "Never decided", "refused"
 * and "granted then withdrawn" are three different situations: the first is a
 * gap in your collection, the second is a choice to respect, and the third is a
 * choice that changed and may need data deleted. A single red cross would
 * collapse all three.
 *
 * A refusal is therefore not shown as an error. It is the system working.
 */

const REASON_MEANING: Record<string, string> = {
  site_not_found: 'No site with that identifier belongs to this organisation.',
  principal_not_found: 'This site has never recorded a decision from that visitor. They may be new, or the identifier may be wrong.',
  purpose_not_found: 'That purpose is not part of this site’s published configuration.',
  no_consent_decision: 'The visitor exists but has never decided on this purpose. Not a refusal — an absence.',
  consent_denied: 'The visitor was asked and said no. Respect it.',
  consent_withdrawn: 'The visitor granted this and later took it back. Anything collected under the earlier grant may need attention.',
};

export function AuthorisationCheck({ siteId, purposes }: { siteId: string; purposes: string[] }) {
  const [principal, setPrincipal] = React.useState('');
  const [purpose, setPurpose] = React.useState(purposes[0] ?? 'analytics');
  const [result, setResult] = React.useState<W.WireAuthorisationDecision | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (principal.trim() === '') {
      setError('Enter the visitor identifier you want to check.');
      return;
    }
    setError(null);
    start(async () => {
      const outcome = await askAuthorisation({
        siteId,
        principalExternalId: principal.trim(),
        purposeCode: purpose,
      });
      if ('error' in outcome) {
        setError(outcome.error);
        setResult(null);
        return;
      }
      setResult(outcome.decision);
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card>
        <CardBody>
          <CardHeader
            title="Check an authorisation"
            sub="Answers the question without creating an authorisation, so no permission is spent and no row is written."
          />

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-5" noValidate>
            <Field
              label="Visitor identifier"
              htmlFor="az-principal"
              hint="The principal id your systems hold for this person."
              {...(error ? { error } : {})}
            >
              <Input
                id="az-principal"
                mono
                lead="user"
                placeholder="anon_5f2b91c4"
                value={principal}
                invalid={Boolean(error)}
                onChange={(e) => setPrincipal(e.currentTarget.value)}
              />
            </Field>

            <Field label="Purpose" htmlFor="az-purpose" hint="The purpose the data would be used for.">
              <select
                id="az-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.currentTarget.value)}
                className="h-14 w-full rounded-t-xl border-b-2 border-md-outline bg-md-surface-container-low px-4 text-body-medium text-md-on-surface transition-colors duration-[--md-duration-fast] focus:border-md-primary focus:outline-none"
              >
                {purposes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <Button type="submit" variant="filled" iconAfter="arrowRight" disabled={pending}>
              {pending ? 'Checking…' : 'Check authorisation'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Answer" sub="The live evaluation, against decisions as they stand now." />

          {!result ? (
            <div className="mt-6 flex flex-col items-center rounded-3xl bg-md-surface-container-low px-6 py-12 text-center">
              <Icon name="consent" size={28} className="text-md-on-surface-variant" />
              <p className="mt-4 max-w-[44ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                Enter a visitor and a purpose. You will get a yes or no, the reason behind it, and the
                exact consent decision it relied on.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              <div
                className={`rounded-3xl p-6 ${
                  result.permitted ? 'bg-md-secondary-container/50' : 'bg-md-surface-container'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
                    {result.permitted ? 'Permitted' : 'Not permitted'}
                  </span>
                  {result.reason ? <Chip tone="neutral">{result.reason.replace(/_/g, ' ')}</Chip> : null}
                </div>

                <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
                  {result.message}
                </p>

                {result.reason ? (
                  <p className="mt-4 flex gap-2.5 rounded-2xl bg-md-surface/70 p-4 text-body-small leading-relaxed text-md-on-surface">
                    <Icon name="info" size={18} className="mt-0.5 shrink-0 text-md-on-surface-variant" />
                    <span>{REASON_MEANING[result.reason] ?? 'The platform declined without a documented reason code.'}</span>
                  </p>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Detail label="Visitor" value={result.principal_external_id} mono />
                <Detail label="Purpose" value={result.purpose_code} mono />
                <Detail label="Consent status" value={result.consent_status ?? 'None recorded'} />
                <Detail
                  label="Decided"
                  value={result.decided_at
                    ? new Date(result.decided_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : 'Never'}
                />
              </dl>

              {result.consent_record_id ? (
                <p className="text-body-small leading-relaxed text-md-on-surface-variant">
                  Relied on consent record{' '}
                  <span className="font-mono text-md-on-surface">{result.consent_record_id}</span>. Its
                  receipt is on the Consent screen, where it can also be verified.
                </p>
              ) : null}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">{label}</dt>
      <dd className={`mt-1 truncate text-body-medium text-md-on-surface ${mono ? 'font-mono text-body-small' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
