import type { ReactNode } from "react";
import { CountUp, Reveal, Stagger, StaggerItem } from "./motion";

/**
 * Presentational primitives.
 *
 * Deliberately dumb: they take data and render it. Every page composes these,
 * which is what keeps a table on the transfers screen looking like a table on
 * the consent screen.
 */

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <Reveal>
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
    </Reveal>
  );
}

export function Section({
  title,
  children,
  delay = 0,
}: {
  title?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <section className="section">
        {title ? <h2>{title}</h2> : null}
        {children}
      </section>
    </Reveal>
  );
}

/**
 * A row of stat tiles that arrive in sequence.
 *
 * The stagger is the point: it gives the eye an order to read a row of numbers
 * in, rather than presenting six of them simultaneously.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <Stagger className="grid">{children}</Stagger>;
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  // Only a real number counts up. A formatted string may be a date or a label,
  // and animating it would produce nonsense on the way to the final value.
  const numeric = typeof value === "number" ? value : parseCount(value);

  return (
    <StaggerItem>
      <div className="stat">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {numeric === null ? value : <CountUp value={numeric} />}
        </div>
        {hint ? <div className="stat-hint">{hint}</div> : null}
      </div>
    </StaggerItem>
  );
}

/** Recovers the number behind an already-formatted count such as "1,234". */
function parseCount(value: string): number | null {
  if (!/^[\d,]+$/.test(value)) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Nothing to show, and that is fine.
 *
 * Distinct from an error: an empty state explains what would appear here and how
 * to make it appear, rather than implying something went wrong.
 */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state" role="status">
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

/** Something failed. Says what, and never swallows it into an empty table. */
export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state state-error" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

/** Shown while a streamed section resolves. */
export function LoadingState({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite" aria-label={label}>
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="skeleton"
            style={{ width: `${100 - index * 12}%`, margin: "0 auto" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Maps a domain status onto a consistent colour.
 *
 * One mapping for every status in the product, so `GRANTED` and `DELIVERED`
 * read the same way, and anything unrecognised degrades to neutral rather than
 * throwing or rendering blank.
 */
const TONE: Record<string, "ok" | "warn" | "bad"> = {
  GRANTED: "ok",
  AUTHORISED: "ok",
  DELIVERED: "ok",
  RECORDED: "ok",
  ACTIVE: "ok",
  CONSUMED: "warn",
  EXPIRED: "warn",
  INACTIVE: "warn",
  DENIED: "bad",
  WITHDRAWN: "bad",
  FAILED: "bad",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status.toUpperCase()];
  return <span className={tone ? `badge badge-${tone}` : "badge"}>{status}</span>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}
