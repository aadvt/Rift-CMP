import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, Notice, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * The recommendation queue, worst first.
 *
 * ## The engine decides; the ranking only sorts
 *
 * Every row's `recommended_action`, `reason` and `consent_requirement` come from
 * the policy engine and are rendered verbatim. What this screen adds is order —
 * and the one sentence saying why a row is where it is, so the ordering can be
 * argued with rather than trusted.
 *
 * ## The model is a guest here
 *
 * When a provider is configured, its commentary appears in a visually
 * subordinate block, labelled, with the model named and its confidence shown. It
 * is never the headline, never a badge on the row, and never changes the
 * recommended action. When no provider is configured, or its reply failed
 * validation, that block is simply absent — and the row is complete without it.
 * A screen where the advisory text is load-bearing would be one where an expired
 * API key changes what a company believes about its own site.
 */

const ACTION_TONE: Record<string, ChipTone> = {
  block: 'error',
  require_consent: 'warning',
  review: 'warning',
  allow: 'success',
  allow_with_notice: 'primary',
};

function AiNote({ note }: { note: W.WireAiNote }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-md-outline-variant bg-md-surface-container/50 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="sparkle" size={14} className="text-md-on-surface-variant" />
        <span className="text-label-medium text-md-on-surface-variant">
          Suggestion from {note.model}, for context only
        </span>
        <Chip tone="neutral">{Math.round(note.confidence * 100)}% confident</Chip>
        {note.ambiguous ? <Chip tone="warning">the model was unsure</Chip> : null}
      </div>
      <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
        {note.reasoning}
      </p>
      {note.suggested_category ? (
        <p className="mt-1.5 text-label-medium text-md-on-surface-variant">
          It would categorise this as “{note.suggested_category}”. Rift has not acted on that.
        </p>
      ) : null}
    </div>
  );
}

export function Autopilot({ autopilot }: { autopilot: W.WireAutopilotIntelligence | null }) {
  if (!autopilot) {
    return (
      <EmptyState
        icon="sparkle"
        title="Recommendations unavailable"
        body="Rift could not read the recommendations for this site. This is a connection problem, not an empty queue."
      />
    );
  }

  if (autopilot.recommendations.length === 0) {
    return (
      <EmptyState
        icon="scans"
        title="Nothing to decide yet"
        body="Run a scan and Rift will list what it found, ranked by what most needs a decision."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="neutral" title="Nothing here is applied until you approve it">
        Rift ranks what it found and explains each one. Changing what your site actually does is
        always your decision, made in the configuration.
      </Notice>

      {autopilot.ai_summary ? (
        <Card className="rounded-2xl border-dashed">
          <CardBody className="p-6">
            <CardHeader
              title="Summary from an assistant"
              sub={`${autopilot.ai_summary.provider} · ${autopilot.ai_summary.model} · advisory, not a decision`}
            />
            <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
              {autopilot.ai_summary.summary}
            </p>
            {autopilot.ai_summary.ambiguities.length > 0 ? (
              <>
                <p className="mt-4 text-label-medium text-md-on-surface-variant">
                  It said it was unsure about:
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {autopilot.ai_summary.ambiguities.map((a) => (
                    <li key={a} className="text-body-small text-md-on-surface-variant">
                      {a}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader
            title={`${autopilot.recommendations.length} recommendation${autopilot.recommendations.length === 1 ? '' : 's'}`}
            sub="Ordered by what the evidence says is urgent — not by the assistant."
          />
          <ul className="mt-5 flex flex-col gap-6">
            {autopilot.recommendations.map((item) => {
              const rec = item.recommendation;
              return (
                <li
                  key={rec.detector_id}
                  className="border-t border-md-outline-variant/50 pt-5 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-medium font-medium text-md-on-surface">
                      {rec.vendor_name}
                    </span>
                    <Chip tone={ACTION_TONE[rec.recommended_action] ?? 'neutral'}>
                      {rec.recommended_action.replace(/_/g, ' ')}
                    </Chip>
                    <Chip tone="neutral">{rec.confidence} confidence</Chip>
                    {rec.overridden ? <Chip tone="primary">you overrode this</Chip> : null}
                    {!rec.observed_in_latest_scan ? (
                      <Chip tone="neutral">not in the latest scan</Chip>
                    ) : null}
                  </div>

                  {/* The engine's own words. Never paraphrased here. */}
                  <p className="mt-2.5 text-body-small leading-relaxed text-md-on-surface">
                    {rec.reason}
                  </p>

                  <p className="mt-2 flex items-start gap-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
                    <Icon name="arrowRight" size={14} className="mt-1 shrink-0 text-md-primary" />
                    {item.priority_reason}
                  </p>

                  {item.shadow_trackers.length > 0 || item.drift.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.shadow_trackers.length > 0 ? (
                        <Chip tone="warning">
                          {item.shadow_trackers.length} unaccounted-for finding
                          {item.shadow_trackers.length === 1 ? '' : 's'}
                        </Chip>
                      ) : null}
                      {item.drift.length > 0 ? (
                        <Chip tone="warning">
                          {item.drift.length} change{item.drift.length === 1 ? '' : 's'} since you
                          approved
                        </Chip>
                      ) : null}
                    </div>
                  ) : null}

                  {item.ai ? <AiNote note={item.ai} /> : null}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {!autopilot.ai_configured ? (
        <p className="text-label-medium text-md-on-surface-variant">
          No assistant is configured. Everything above was decided by the policy engine, which is
          how it works either way — an assistant only ever adds commentary.
        </p>
      ) : null}
    </div>
  );
}
