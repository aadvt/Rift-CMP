import type { ReactNode } from "react";

/**
 * The onboarding spine: one journey, five steps, one place that knows the order.
 *
 * Phase 11 asks that setting a site up feel like a single continuous thing
 * rather than five unrelated corners of an admin panel. The step model is how
 * that is expressed, so it lives in one component and every screen in the flow
 * renders the same one.
 *
 * The current step is always **derived from server state** — is there a site,
 * has a scan completed, is a policy version approved, has any data arrived —
 * and never from client-side wizard state. There is exactly one scan state
 * machine in this product and it is in the database; a second one living in
 * React would drift from it the first time somebody reloaded the page.
 */

export const JOURNEY_STEPS = [
  { id: "website", label: "Website" },
  { id: "scan", label: "Scan" },
  { id: "configure", label: "Configure" },
  { id: "install", label: "Install" },
  { id: "verify", label: "Verify" },
] as const;

export type JourneyStepId = (typeof JOURNEY_STEPS)[number]["id"];

export function stepIndex(step: JourneyStepId): number {
  return JOURNEY_STEPS.findIndex((s) => s.id === step);
}

/**
 * The progress indicator.
 *
 * Rendered as an ordered list because that is what it is: a sequence with a
 * position in it. Screen readers get the position stated in words rather than
 * inferred from colour, and `aria-current="step"` marks where the operator is.
 */
export function JourneyProgress({ current }: { current: JourneyStepId }) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Setup progress" className="journey">
      <ol className="journey-steps">
        {JOURNEY_STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <li
              key={step.id}
              className={`journey-step journey-step-${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="journey-marker" aria-hidden="true">
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className="journey-label">
                {step.label}
                <span className="sr-only">
                  {state === "done"
                    ? " — completed"
                    : state === "current"
                      ? " — current step"
                      : " — not started"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A note about something the product genuinely cannot do yet.
 *
 * Deliberately not styled as an error or a warning. A missing capability is not
 * the operator's fault and not an alarm; dressing it in red would train people
 * to ignore red. It reads as what it is: a limit, stated plainly.
 */
export function NotYetAvailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card note" role="note">
      <p className="note-title">{title}</p>
      <div className="note-body">{children}</div>
    </div>
  );
}
