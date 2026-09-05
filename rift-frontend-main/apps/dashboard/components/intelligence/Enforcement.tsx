import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, Notice, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * What the firewall actually did, and what it could not see.
 *
 * ## The coverage note is not a footnote
 *
 * "14 blocked" reads as *fourteen things tried to leave and we stopped them*.
 * On the client plane that is not what it means — it is fourteen things the SDK
 * saw, which excludes everything that ran before it and everything that never
 * touched the browser. A number presented without that qualification is a number
 * an operator will act on wrongly, so the limits sit on the screen next to the
 * counts rather than in documentation nobody opens.
 *
 * ## Observe mode is called out on every row
 *
 * A BLOCK taken in observe mode did not block anything. Showing it identically
 * to an applied block would tell an operator their site is protected during
 * precisely the period when it deliberately is not.
 *
 * ## The two planes are never merged
 *
 * A server decision means the bytes did not leave. A client decision means a
 * page-level patch declined to make a request, which a hostile script could have
 * undone. Adding them into one total would overstate the weaker one.
 */

const DECISION_TONE: Record<string, ChipTone> = {
  BLOCK: 'error',
  REQUIRE_CONSENT: 'warning',
  REDACT: 'primary',
  REVIEW: 'warning',
  ALLOW: 'success',
};

const DECISION_LABEL: Record<string, string> = {
  BLOCK: 'Blocked',
  REQUIRE_CONSENT: 'Consent required',
  REDACT: 'Redacted',
  REVIEW: 'Not reviewed',
  ALLOW: 'Allowed',
};

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[26px] font-semibold leading-tight tabular-nums text-md-on-surface">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[12.5px] text-md-on-surface-variant/80">{label}</div>
      {hint ? <div className="mt-0.5 text-label-small text-md-on-surface-variant/70">{hint}</div> : null}
    </div>
  );
}

export function Enforcement({ history }: { history: W.WireEnforcementHistory | null }) {
  if (!history) {
    return (
      <EmptyState
        icon="shieldCheck"
        title="Enforcement activity unavailable"
        body="Rift could not read the enforcement log for this site. This is a connection problem, not a quiet site."
      />
    );
  }

  const { summary, events, coverage } = history;

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-2xl">
        <CardBody className="flex flex-wrap items-start gap-x-10 gap-y-6 p-7">
          <Stat label="decisions recorded" value={summary.total} />
          <Stat label="blocked or gated" value={summary.blocked} />
          <Stat label="redacted" value={summary.redacted} />
          <Stat
            label="unreviewed destinations"
            value={summary.needs_review}
            hint="allowed, but matched no approved rule"
          />
          <Stat label="distinct destinations" value={summary.destinations} />
        </CardBody>
      </Card>

      {summary.observed_only > 0 ? (
        <Notice tone="warning" title={`${summary.observed_only} of these were observed, not applied`}>
          The policy is in observe mode, so Rift recorded what it would have done and changed
          nothing on the site. Nothing was actually stopped.
        </Notice>
      ) : null}

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader
            title="What this log covers"
            sub="Read the counts above against this, not on their own."
          />
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
            <dt className="text-label-medium text-md-on-surface-variant">In the browser</dt>
            <dd className="text-body-small leading-relaxed text-md-on-surface">
              {coverage.client_enforcement}
            </dd>
            <dt className="text-label-medium text-md-on-surface-variant">On your server</dt>
            <dd className="text-body-small leading-relaxed text-md-on-surface">
              {coverage.server_enforcement}
            </dd>
          </dl>

          <p className="mt-5 text-label-medium text-md-on-surface-variant">Not covered at all:</p>
          <ul className="mt-2 flex flex-col gap-2">
            {coverage.not_covered.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon name="info" size={14} className="mt-1 shrink-0 text-md-on-surface-variant" />
                <span className="text-body-small leading-relaxed text-md-on-surface-variant">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {events.length === 0 ? (
        <EmptyState
          icon="shieldCheck"
          title="Nothing recorded yet"
          body="Once enforcement is running and a visitor loads a page, decisions appear here. An empty log is not the same as a site with nothing to block."
        />
      ) : (
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader title="Recent decisions" sub="Newest first." />
            <ul className="mt-5 flex flex-col gap-5">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border-t border-md-outline-variant/50 pt-5 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={DECISION_TONE[event.decision] ?? 'neutral'}>
                      {DECISION_LABEL[event.decision] ?? event.decision}
                    </Chip>
                    <span className="text-body-medium text-md-on-surface">
                      {event.vendor ?? event.destination_host ?? 'Unknown destination'}
                    </span>
                    {event.vendor && event.destination_host ? (
                      <span className="text-label-medium text-md-on-surface-variant">
                        {event.destination_host}
                      </span>
                    ) : null}
                    {/* Which plane took the decision. They are not equivalent. */}
                    <Chip tone="neutral">
                      {event.source === 'server' ? 'your server' : 'the browser'}
                    </Chip>
                    {event.observed_only ? (
                      <Chip tone="warning">observed, not applied</Chip>
                    ) : null}
                  </div>

                  <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
                    {event.reason}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-label-small text-md-on-surface-variant/75">
                    <span>{new Date(event.occurred_at).toLocaleString()}</span>
                    {event.purpose ? <span>purpose: {event.purpose}</span> : null}
                    {event.policy_version ? <span>against v{event.policy_version}</span> : null}
                    {event.matched_rule?.host ? (
                      <span>
                        rule: {event.matched_rule.host} ({event.matched_rule.action})
                      </span>
                    ) : null}
                  </div>

                  {event.redactions && event.redactions.length > 0 ? (
                    <div className="mt-3 border-l-2 border-md-outline-variant pl-3">
                      <p className="text-label-small uppercase tracking-[0.06em] text-md-on-surface-variant/70">
                        Fields removed before sending
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {event.redactions.map((r) => (
                          <li
                            key={`${r.rule}:${r.location}:${r.path}`}
                            className="font-mono text-body-small text-md-on-surface-variant"
                          >
                            {/* The path, never the value. Showing what was
                                redacted here would defeat redacting it. */}
                            {r.location}:{r.path}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
