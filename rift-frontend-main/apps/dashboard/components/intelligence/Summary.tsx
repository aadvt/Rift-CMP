import Link from 'next/link';
import type { Route } from 'next';
import { Card, CardBody, Icon } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * One line on the site overview: is anything wrong, and how wrong.
 *
 * ## Every number here has a source that loaded
 *
 * A tile appears only when the request behind it succeeded. Rendering "0
 * findings" because a fetch failed would be the worst possible failure for this
 * strip — it is the reassurance surface, and false reassurance about tracking is
 * exactly the thing this product exists to prevent. A missing tile is honest;
 * a zero that means "we could not ask" is not.
 *
 * ## Zero is shown, and shown calmly
 *
 * When a source did load and found nothing, the tile stays with a zero and no
 * colour. That is a real, useful finding, and hiding it would leave someone
 * unable to tell "clean" from "not checked".
 */

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'warning';
}) {
  return (
    <div className="min-w-0 px-5 first:pl-0 last:pr-0 sm:border-l sm:border-md-outline-variant sm:first:border-l-0">
      <div
        className={
          tone === 'warning'
            ? 'text-[22px] font-semibold leading-tight tabular-nums text-md-on-surface'
            : 'text-[22px] font-semibold leading-tight tabular-nums text-md-on-surface-variant'
        }
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[12.5px] text-md-on-surface-variant/75">{label}</div>
    </div>
  );
}

export function IntelligenceSummary({
  siteId,
  quality,
  intelligence,
  pages,
  autopilot,
}: {
  siteId: string;
  quality: W.WireQuality | null;
  intelligence: W.WireSiteIntelligence | null;
  pages: W.WirePageIntelligence[] | null;
  autopilot: W.WireAutopilotIntelligence | null;
}) {
  const tiles: Array<{ label: string; value: string; tone: 'neutral' | 'warning' }> = [];

  if (quality) {
    tiles.push({ label: 'consent quality', value: `${quality.score}/100`, tone: 'neutral' });
  }
  if (intelligence) {
    tiles.push({
      label: `shadow tracker finding${intelligence.shadow_trackers.length === 1 ? '' : 's'}`,
      value: String(intelligence.shadow_trackers.length),
      tone: intelligence.shadow_trackers.length > 0 ? 'warning' : 'neutral',
    });
    tiles.push({
      label: `drift finding${intelligence.drift.length === 1 ? '' : 's'}`,
      value: String(intelligence.drift.length),
      tone: intelligence.drift.length > 0 ? 'warning' : 'neutral',
    });
  }
  if (pages) {
    const needing = pages.filter((p) => p.summary.needs_review > 0).length;
    tiles.push({
      label: `page${needing === 1 ? '' : 's'} to review`,
      value: String(needing),
      tone: needing > 0 ? 'warning' : 'neutral',
    });
  }
  if (autopilot) {
    tiles.push({
      label: 'recommendations pending',
      value: String(autopilot.recommendations.length),
      tone: autopilot.recommendations.length > 0 ? 'warning' : 'neutral',
    });
  }

  // Nothing loaded. Say nothing rather than imply an all-clear.
  if (tiles.length === 0) return null;

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-y-4">
          {tiles.map((t) => (
            <Tile key={t.label} label={t.label} value={t.value} tone={t.tone} />
          ))}
        </div>
        <Link
          href={`/dashboard/sites/${siteId}/intelligence` as Route}
          className="inline-flex items-center gap-1 text-label-medium font-medium text-md-primary hover:underline"
        >
          Intelligence
          <Icon name="chevronRight" size={14} />
        </Link>
      </CardBody>
    </Card>
  );
}
