import * as React from 'react';
import { series } from '@rift/tokens';
import { cn } from '@rift/ui';

/**
 * Thin marks, one accent hue per series, recessive gridlines, no 3D, and no
 * pie with more than three slices. Charts are plain SVG over d3-free maths —
 * the shapes here are simple enough that a charting library would cost more
 * than it saves.
 */

export function Donut({
  slices, size = 158, thickness = 16, center, centerLabel, ariaLabel,
}: {
  slices: Array<{ label: string; value: number; color?: string }>;
  size?: number;
  thickness?: number;
  center?: string;
  centerLabel?: string;
  ariaLabel: string;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  /**
   * Arcs are sized as a share of the total, not by treating each value as a
   * percentage. Callers pass whichever they have — the consent screen passes
   * decision counts, the device breakdown passes shares — and dividing by the
   * total is right for both. Reading a count as a percentage drew a three-out-
   * of-three split as a 3% sliver.
   *
   * A total of zero draws no arcs, leaving the track ring, which is what "no
   * decisions yet" should look like.
   */
  const total = slices.reduce((t, s) => t + s.value, 0);
  let acc = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--md-surface-variant)" strokeWidth={thickness} />
        {slices.map((s, i) => {
          const len = total > 0 ? (s.value / total) * circ : 0;
          const dash = Math.max(len - 6, 1); /* generous surface gap — MD3 keeps segments distinctly separate */
          const el = (
            <circle
              key={s.label}
              cx={c} cy={c} r={r} fill="none"
              stroke={s.color ?? series[i % series.length]}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${c} ${c})`}
            >
              <title>
                {`${s.label}: ${total > 0 ? Math.round((s.value / total) * 100) : 0}%`}
              </title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      {center ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-headline-medium font-normal leading-none tracking-[-0.01em] text-md-on-surface tabular-nums">{center}</div>
          {centerLabel ? <div className="mt-1.5 text-label-medium text-md-on-surface-variant">{centerLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function HBars({
  rows, labelWidth = 116, valueWidth = 60, className,
}: {
  rows: Array<{ label: string; value: number; display?: string }>;
  labelWidth?: number;
  valueWidth?: number;
  className?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3.5">
          <div className="shrink-0 truncate text-label-medium text-md-on-surface" style={{ width: labelWidth }}>{r.label}</div>
          <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-md-surface-variant">
            <div
              className="h-full rounded-full bg-md-primary transition-[width] duration-[--md-duration-xslow] ease-md"
              style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
            />
          </div>
          <div className="shrink-0 text-right text-label-medium font-medium text-md-on-surface tabular-nums" style={{ width: valueWidth }}>
            {r.display ?? r.value.toLocaleString('en-US')}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrendLine({
  points, height = 190, ariaLabel, className,
}: {
  points: Array<{ label: string; value: number }>;
  height?: number;
  ariaLabel: string;
  className?: string;
}) {
  const w = 1000;
  const padTop = 12;
  const padBottom = 24;
  // A series that is entirely zero is a real state — a site installed this
  // morning has one. Scaling to its own maximum divides by zero and every
  // coordinate comes out NaN, which renders nothing and fills the console with
  // attribute warnings. Falling back to a nominal axis draws the flat line the
  // data actually describes.
  const peak = Math.max(...points.map((p) => p.value), 0);
  const max = peak > 0 ? peak * 1.12 : 1;
  const x = (i: number) => (i / Math.max(points.length - 1, 1)) * w;
  const y = (v: number) => padTop + (1 - v / max) * (height - padTop - padBottom);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height - padBottom} L0,${height - padBottom} Z`;

  return (
    <div className={className}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className="block overflow-visible">
        <defs>
          <linearGradient id="rift-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]} stopOpacity="0.14" />
            <stop offset="100%" stopColor={series[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 2, 3].map((i) => (
          <line key={i} x1="0" x2={w} y1={y((max / 4) * i)} y2={y((max / 4) * i)} stroke="var(--md-outline-variant)" strokeWidth="1" opacity="0.5" />
        ))}
        <path d={area} fill="url(#rift-trend)" />
        <path d={line} fill="none" stroke={series[0]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-md-on-surface-variant/75">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2 text-label-medium text-md-on-surface-variant">
          <span className="h-2.5 w-4 shrink-0 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value ? <span className="font-medium text-md-on-surface tabular-nums">{i.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

/** Every metric the consent state can move carries this. */
export function ConsentAffected() {
  return (
    <span
      title="This metric only counts visitors whose consent allows measurement."
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-md-secondary-container pl-2.5 pr-3 text-label-small font-medium text-md-on-secondary-container"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="2.8" y="4.2" width="14.4" height="4.4" rx="2.2" />
        <rect x="2.8" y="11.4" width="14.4" height="4.4" rx="2.2" />
      </svg>
      Consent-affected
    </span>
  );
}
