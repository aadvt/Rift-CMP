'use client';
import * as React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Icon, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';
import { runFirewall } from '@/app/actions';

/**
 * Ask the firewall what it would do, without doing it.
 *
 * ## Why a dry run needs its own screen
 *
 * Enforcement shows what already happened. This answers the question an
 * operator has *before* turning enforcement on, and the one an integrator has
 * while wiring the guard into their own server: given this destination and this
 * visitor, what happens — and on what grounds.
 *
 * It runs the real evaluator against the real configuration and the visitor's
 * real recorded decisions. A preview computed by a different code path would be
 * a preview of something else.
 *
 * ## Decision and effect are both shown
 *
 * There are five classifications and only two things that can happen to a
 * request. Collapsing the five into two loses the reason; presenting five as
 * though they were five runtime behaviours would be worse, because REVIEW would
 * read as a control when it is the absence of one. So both are on screen, and
 * the effect is the one given visual weight.
 *
 * `observed_only` is called out loudly for the same reason: an observed BLOCK
 * did not block anything, and an operator who reads it as enforcement will
 * believe a tag is gated when it is still firing.
 */

const DECISION_TONE: Record<string, ChipTone> = {
  ALLOW: 'success',
  BLOCK: 'error',
  REDACT: 'tertiary',
  REQUIRE_CONSENT: 'primary',
  REVIEW: 'neutral',
};

const DECISION_LABEL: Record<string, string> = {
  ALLOW: 'Allow',
  BLOCK: 'Block',
  REDACT: 'Redact',
  REQUIRE_CONSENT: 'Require consent',
  REVIEW: 'Review',
};

export function DryRun({ siteId, purposes }: { siteId: string; purposes: string[] }) {
  const [destination, setDestination] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [principal, setPrincipal] = React.useState('');
  const [result, setResult] = React.useState<W.WireFirewallEvaluation | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (destination.trim() === '') {
      setError('Enter the destination you want to test.');
      return;
    }
    setError(null);
    start(async () => {
      const outcome = await runFirewall(siteId, {
        destination: destination.trim(),
        purpose: purpose === '' ? null : purpose,
        ...(principal.trim() === '' ? {} : { principalExternalId: principal.trim() }),
      });
      if ('error' in outcome) {
        setError(outcome.error);
        setResult(null);
        return;
      }
      setResult(outcome.evaluation);
    });
  }

  const decision = result?.decision;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardBody>
          <CardHeader
            title="Test a request"
            sub="Nothing is sent, nothing is written to the enforcement log, and no payload is stored."
          />

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-5" noValidate>
            <Field
              label="Destination"
              htmlFor="fw-destination"
              hint="A host or a full URL — the request you want the firewall to judge."
              {...(error ? { error } : {})}
            >
              <Input
                id="fw-destination"
                mono
                lead="sites"
                placeholder="analytics.tiktok.com"
                value={destination}
                invalid={Boolean(error)}
                onChange={(e) => setDestination(e.currentTarget.value)}
              />
            </Field>

            <Field
              label="Purpose"
              htmlFor="fw-purpose"
              optional
              hint="Leave blank to let the policy decide which purpose gates this destination."
            >
              <select
                id="fw-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.currentTarget.value)}
                className="h-14 w-full rounded-t-xl border-b-2 border-md-outline bg-md-surface-container-low px-4 text-body-medium text-md-on-surface transition-colors duration-[--md-duration-fast] focus:border-md-primary focus:outline-none"
              >
                <option value="">Let the policy decide</option>
                {purposes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field
              label="Visitor"
              htmlFor="fw-principal"
              optional
              hint="A principal id evaluates against that visitor's real recorded decisions. Without one, only the policy is applied."
            >
              <Input
                id="fw-principal"
                mono
                lead="user"
                placeholder="anon_5f2b91c4"
                value={principal}
                onChange={(e) => setPrincipal(e.currentTarget.value)}
              />
            </Field>

            <Button type="submit" variant="filled" iconAfter="arrowRight" disabled={pending}>
              {pending ? 'Evaluating…' : 'Evaluate'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="What would happen" sub="The real evaluator, against the approved configuration." />

          {!decision ? (
            <div className="mt-6 flex flex-col items-center rounded-3xl bg-md-surface-container-low px-6 py-12 text-center">
              <Icon name="consent" size={28} className="text-md-on-surface-variant" />
              <p className="mt-4 max-w-[42ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                Enter a destination and evaluate it. You will get the classification, what actually
                happens to the request, and the evidence behind both.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {/* Effect leads, because it is the thing that happens. */}
              <div
                className={`rounded-3xl p-6 ${
                  decision.effect === 'block'
                    ? 'bg-md-error-container/50 ring-1 ring-md-error/30'
                    : 'bg-md-secondary-container/50'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
                    {decision.effect === 'block' ? 'Blocked' : 'Allowed'}
                  </span>
                  <Chip tone={DECISION_TONE[decision.decision] ?? 'neutral'}>
                    {DECISION_LABEL[decision.decision] ?? decision.decision}
                  </Chip>
                  {decision.observed_only ? <Chip tone="warning">Observe mode</Chip> : null}
                </div>

                <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
                  {decision.reason}
                </p>

                {decision.observed_only ? (
                  <p className="mt-4 flex gap-2.5 rounded-2xl bg-md-surface/70 p-4 text-body-small leading-relaxed text-md-on-surface">
                    <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-md-tertiary" />
                    <span>
                      The deciding policy is in <strong className="font-medium">observe</strong> mode,
                      so this outcome would be recorded rather than applied. An observed block does
                      not block anything.
                    </span>
                  </p>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Detail label="Destination" value={decision.destination_host ?? 'Could not be parsed'} mono />
                <Detail label="Vendor" value={decision.vendor ?? 'Not in the catalogue'} />
                <Detail label="Purpose" value={decision.purpose ?? 'None applied'} />
                <Detail label="Visitor state" value={decision.user_state} />
                <Detail label="Policy version" value={decision.policy_version ?? 'None'} mono />
                <Detail
                  label="Matched rule"
                  value={decision.matched_rule ? `${decision.matched_rule.vendor} → ${decision.matched_rule.action}` : 'No rule matched'}
                />
              </dl>

              {decision.evidence.length > 0 ? (
                <div>
                  <h4 className="text-label-medium font-medium text-md-on-surface">Why</h4>
                  <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-md-outline-variant pl-3">
                    {decision.evidence.map((e, i) => (
                      <li key={i} className="text-body-small leading-relaxed text-md-on-surface-variant">
                        <span className="mr-1.5 text-label-small uppercase tracking-[0.06em] text-md-on-surface-variant/70">
                          {e.source}
                        </span>
                        {e.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result && result.redaction_applied.length > 0 ? (
                <p className="text-body-small leading-relaxed text-md-on-surface-variant">
                  Redaction rules that would fire:{' '}
                  <span className="font-mono text-md-on-surface">{result.redaction_applied.join(', ')}</span>.
                  Rule ids only — the redacted payload is never returned.
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
      <dt className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
        {label}
      </dt>
      <dd className={`mt-1 truncate text-body-medium text-md-on-surface ${mono ? 'font-mono text-body-small' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
