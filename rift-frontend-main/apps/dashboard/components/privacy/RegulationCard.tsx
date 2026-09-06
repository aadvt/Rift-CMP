'use client';
import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Button, Card, Chip, Icon } from '@rift/ui';
import type { RegionConfiguration } from '@/lib/api/types';

/**
 * One regulation, and the reasoning behind it.
 *
 * ## Why this is a component and not markup on the page
 *
 * The reasoning panel used to open for the first card and only the first card,
 * because "is this expanded" was `i === 0` — a server-rendered constant. The
 * chevron pointed the right way and the button did nothing, so the second
 * regulation's reasoning was unreachable in a product whose entire argument is
 * that it shows its work.
 *
 * Disclosure is state, and state needs a client component. This is that.
 *
 * ## It is a real button
 *
 * `aria-expanded` and `aria-controls` are what make this legible to somebody
 * using a screen reader — without them a toggle is an unlabelled control that
 * changes something elsewhere on the page with no announcement. The chevron
 * follows the state rather than the index, which is what it looked like it was
 * doing before.
 */
export function RegulationCard({
  region,
  defaultOpen,
  evidenceHref,
}: {
  region: RegionConfiguration;
  /** The first card opens by default, so the pattern is visible without a click. */
  defaultOpen?: boolean;
  /**
   * Where the observations behind this came from. `null` when the site has no
   * completed scan yet — in which case the control is not offered at all,
   * rather than pointing somewhere that cannot answer.
   */
  evidenceHref: Route | null;
}) {
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const panelId = `reasoning-${region.code.replace(/[^a-z0-9]/gi, '-')}`;

  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-start gap-4 p-7">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-md-secondary-container font-mono text-label-medium font-medium text-md-on-secondary-container">
          {region.shortCode}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-title-large font-medium text-md-on-surface">{region.name}</span>
            {region.confidence === 'high' ? (
              <Chip tone="success" glyph="check">High confidence</Chip>
            ) : (
              <Chip tone="warning">Medium confidence</Chip>
            )}
            {region.visitorShare !== null ? (
              <span className="text-label-medium text-md-on-surface-variant">
                {region.visitorShare}% of your visitors
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-body-medium text-md-on-surface-variant">{region.requirement}</div>
        </div>

        {region.reasoning ? (
          <Button
            variant="text"
            size="sm"
            iconAfter={open ? 'chevronDown' : 'chevronRight'}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide reasoning' : 'View reasoning'}
          </Button>
        ) : (
          // No reasoning came back for this jurisdiction. A disabled toggle
          // would suggest it exists and is temporarily unavailable; saying
          // nothing is the accurate account.
          <span className="text-label-medium text-md-on-surface-variant/70">No reasoning recorded</span>
        )}
      </div>

      {open && region.reasoning ? (
        <div id={panelId} className="bg-md-surface-high p-7 motion-safe:animate-[md-fade_300ms_var(--md-ease)]">
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            <div>
              <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                Requirement
              </div>
              <div className="text-body-medium font-medium text-md-on-surface">{region.behaviour}</div>
              <p className="mt-2 text-label-medium leading-relaxed text-md-on-surface-variant">
                Analytics, marketing and preferences technologies are held until the visitor has made a
                choice. Necessary technologies are not.
              </p>
            </div>
            <div>
              <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                Why Rift selected this
              </div>
              <ul className="flex flex-col gap-2.5">
                {region.reasoning.factors.map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-md-primary" />
                    <span className="text-label-medium leading-relaxed text-md-on-surface-variant">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-7 border-t border-md-outline-variant/50 pt-5">
            <Meta label="Source" value={region.reasoning.source} />
            <Meta label="Knowledge base" value={region.reasoning.knowledgeBaseVersion} mono />
            <Meta
              label="Applied"
              value={new Date(region.reasoning.appliedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            />
            {evidenceHref ? (
              <Link href={evidenceHref} className="ml-auto">
                <Button variant="outlined" size="sm" iconAfter="arrowUpRight">
                  View evidence
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
        {label}
      </div>
      <div
        className={
          mono
            ? 'mt-1 font-mono text-label-medium text-md-on-surface'
            : 'mt-1 text-label-medium text-md-on-surface'
        }
      >
        {value}
      </div>
    </div>
  );
}
