'use client';
import * as React from 'react';
import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, cn, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';
import { ShadowTrackers, DriftFindings } from './Findings';

/**
 * One page, investigated.
 *
 * ## A list of pages, then one page in depth
 *
 * Dumping every page's components into one scroll would be a crawler report
 * with better fonts. The question a person actually has is about *a* page —
 * usually the one with something wrong on it — so the left column ranks pages
 * by what needs review and the right answers, for the selected page: what was
 * observed, what was configured, what consent was required, what enforcement
 * would do, what looks unaccounted for, and what changed.
 *
 * ## Attribution is on every row
 *
 * `observed` means seen on this page. `inferred` means matched to it — the
 * crawler records cookies for a whole scan, not per page, so a cookie here is a
 * host match rather than a sighting. Presenting the two identically is how an
 * inference gets repeated back as a measurement, and this screen is exactly
 * where that would happen.
 */

const ATTRIBUTION_TONE: Record<string, ChipTone> = {
  observed: 'success',
  configured: 'primary',
  enforced: 'primary',
  inferred: 'warning',
  unknown: 'neutral',
};

const ATTRIBUTION_HELP: Record<string, string> = {
  observed: 'Seen on this page by the scanner or in a real browser.',
  configured: 'From your approved configuration, not from an observation.',
  enforced: 'The runtime acted on this, or would have.',
  inferred: 'Matched to this page rather than seen on it. Cookies are recorded per scan, not per page.',
  unknown: 'Asked, and not answered yet.',
};

function Attribution({ value }: { value: string }) {
  return (
    <Chip tone={ATTRIBUTION_TONE[value] ?? 'neutral'} title={ATTRIBUTION_HELP[value]}>
      {value}
    </Chip>
  );
}

export function PageIntelligence({ pages }: { pages: W.WirePageIntelligence[] | null }) {
  const ranked = React.useMemo(
    () =>
      [...(pages ?? [])].sort(
        (a, b) => b.summary.needs_review - a.summary.needs_review || b.summary.third_party - a.summary.third_party,
      ),
    [pages],
  );
  const [selected, setSelected] = React.useState(0);

  if (!pages) {
    return (
      <EmptyState
        icon="sites"
        title="Page intelligence unavailable"
        body="Rift could not read scan results for this site. This is a connection problem, not an empty site."
      />
    );
  }

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon="scans"
        title="No pages scanned yet"
        body="Run a scan and Rift will report what each page loads, and which of it your configuration accounts for."
      />
    );
  }

  const page = ranked[selected] ?? ranked[0];
  if (!page) return null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <Card className="rounded-2xl">
        <CardBody className="p-4">
          <CardHeader title="Pages" sub="Most to look at, first." />
          <ul className="mt-3 flex flex-col gap-1">
            {ranked.map((p, i) => (
              <li key={p.url}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-current={i === selected ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                    i === selected
                      ? 'bg-md-secondary-container text-md-on-secondary-container'
                      : 'hover:bg-md-surface-container',
                  )}
                >
                  <span className="block truncate text-body-small font-medium">
                    {new URL(p.url).pathname || '/'}
                  </span>
                  <span className="mt-0.5 block text-label-small opacity-80">
                    {p.summary.third_party} third-party
                    {p.summary.needs_review > 0 ? ` · ${p.summary.needs_review} to review` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader
              title={page.title ?? new URL(page.url).pathname}
              sub={page.url}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {page.jurisdictions.map((j) => (
                <Chip key={j} tone="primary">
                  {j}
                </Chip>
              ))}
              {page.policy_version !== null ? (
                <Chip tone="neutral">judged against policy v{page.policy_version}</Chip>
              ) : (
                <Chip tone="warning">no approved configuration</Chip>
              )}
              {page.purposes.map((p) => (
                <Chip key={p} tone="neutral">
                  {p}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-2xl">
          <CardBody className="p-6">
            <CardHeader
              title="What this page loads"
              sub="Every row says how firmly it is attributed to this page."
            />
            {page.components.length === 0 ? (
              <p className="mt-4 text-body-small text-md-on-surface-variant">
                Nothing third-party observed on this page.
              </p>
            ) : (
              <ul className="mt-5 flex flex-col gap-4">
                {page.components.map((c) => (
                  <li
                    key={`${c.host}:${c.observed_as}`}
                    className="border-t border-md-outline-variant/50 pt-4 first:border-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-medium text-md-on-surface">{c.vendor ?? c.host}</span>
                      <Attribution value={c.attribution} />
                      <Chip tone="neutral">{c.observed_as}</Chip>
                      {c.third_party ? <Chip tone="neutral">third party</Chip> : null}
                      {!c.vendor ? <Chip tone="warning">unclassified</Chip> : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-body-small sm:grid-cols-[max-content_1fr]">
                      <dt className="text-md-on-surface-variant">Host</dt>
                      <dd className="text-md-on-surface">{c.host}</dd>
                      <dt className="text-md-on-surface-variant">Configured</dt>
                      <dd className="text-md-on-surface">
                        {c.policy_action ?? 'Nothing in your configuration covers this'}
                      </dd>
                      <dt className="text-md-on-surface-variant">Consent</dt>
                      {/* The engine's own answer, carried verbatim. "conditional"
                          and "unknown" are real answers and are never flattened. */}
                      <dd className="text-md-on-surface">{c.consent_required ?? 'Not determined'}</dd>
                      {c.crosses_border && c.destination_country ? (
                        <>
                          <dt className="text-md-on-surface-variant">Sends data to</dt>
                          <dd className="text-md-on-surface">{c.destination_country}</dd>
                        </>
                      ) : null}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {page.cookies.length > 0 ? (
          <Card className="rounded-2xl">
            <CardBody className="p-6">
              <CardHeader
                title="Cookies"
                sub="Matched to this page by host. The crawler records cookies per scan, not per page."
              />
              <ul className="mt-4 flex flex-col gap-2">
                {page.cookies.map((c) => (
                  <li key={`${c.domain}:${c.name}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-body-small text-md-on-surface">{c.name}</span>
                    <span className="text-body-small text-md-on-surface-variant">{c.domain}</span>
                    <Attribution value={c.attribution} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {page.unresolved.length > 0 ? (
          <Card className="rounded-2xl">
            <CardBody className="p-6">
              <CardHeader
                title="Rift could not classify these"
                sub="Not accusations. Nobody has looked at them yet, and unresolved is not the same as requiring consent."
              />
              <ul className="mt-4 flex flex-col gap-2">
                {page.unresolved.map((u) => (
                  <li key={u.host} className="flex items-center gap-2">
                    <Icon name="question" size={14} className="text-md-on-surface-variant" />
                    <span className="text-body-small text-md-on-surface">{u.host}</span>
                    <Chip tone="neutral">{u.confidence} confidence</Chip>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {page.shadow_trackers.length > 0 ? <ShadowTrackers findings={page.shadow_trackers} /> : null}
        {page.drift.length > 0 ? <DriftFindings findings={page.drift} /> : null}
      </div>
    </div>
  );
}
