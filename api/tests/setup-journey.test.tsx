/**
 * @vitest-environment jsdom
 *
 * The setup journey's presentation, and the promises it must not overstate.
 *
 * The journey's own state lives in the database — a scan's status, whether a
 * policy version is approved, whether any events have arrived. What is tested
 * here is the layer above that: given those facts, does the screen say the
 * right thing, and does it stay honest about the things Rift cannot do?
 *
 * That second half matters more than it looks. Most of the ways this screen
 * could go wrong are not crashes; they are claims. Saying "verified" when
 * nothing was verified, or "unresolved" in a way that reads as "requires
 * consent", would both render perfectly.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  JOURNEY_STEPS,
  JourneyProgress,
  NotYetAvailable,
  stepIndex,
} from "../app/dashboard/_components/journey";

// This project does not enable vitest globals, so the auto-cleanup that would
// normally come with them has to be registered by hand. Without it each render
// stacks on the last and every query finds several matches.
afterEach(cleanup);

describe("the journey's shape", () => {
  it("runs website to verify, in the order the operator meets them", () => {
    expect(JOURNEY_STEPS.map((s) => s.id)).toEqual([
      "website",
      "scan",
      "configure",
      "install",
      "verify",
    ]);
  });

  it("orders the steps so a later one never precedes an earlier one", () => {
    // Guards the derived-state logic on the page: it compares positions, so a
    // reordering of this array silently changes which steps render as done.
    expect(stepIndex("website")).toBeLessThan(stepIndex("scan"));
    expect(stepIndex("scan")).toBeLessThan(stepIndex("configure"));
    expect(stepIndex("configure")).toBeLessThan(stepIndex("install"));
    expect(stepIndex("install")).toBeLessThan(stepIndex("verify"));
  });
});

describe("the progress indicator", () => {
  it("marks where the operator currently is", () => {
    render(<JourneyProgress current="configure" />);

    const current = screen.getByRole("listitem", { current: "step" });
    expect(within(current).getByText(/Configure/)).toBeTruthy();
  });

  it("marks exactly one step as current", () => {
    render(<JourneyProgress current="scan" />);
    expect(screen.getAllByRole("listitem", { current: "step" })).toHaveLength(1);
  });

  it("states each step's state in words, not only in colour", () => {
    // A progress rail that distinguishes done from pending purely by fill is
    // unreadable to a screen reader and to anyone who cannot separate the two
    // colours. The state is in the accessible name too.
    render(<JourneyProgress current="configure" />);

    const text = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(text.some((t) => t.includes("Website — completed"))).toBe(true);
    expect(text.some((t) => t.includes("Configure — current step"))).toBe(true);
    expect(text.some((t) => t.includes("Verify — not started"))).toBe(true);
  });

  it("is a labelled navigation landmark", () => {
    render(<JourneyProgress current="website" />);
    expect(screen.getByRole("navigation", { name: /setup progress/i })).toBeTruthy();
  });

  it("renders every step at every position", () => {
    for (const step of JOURNEY_STEPS) {
      const { unmount } = render(<JourneyProgress current={step.id} />);
      expect(screen.getAllByRole("listitem")).toHaveLength(JOURNEY_STEPS.length);
      unmount();
    }
  });
});

describe("what Rift admits it cannot do", () => {
  it("presents a missing capability as a note, never as an error", () => {
    // If this ever becomes role="alert", every operator with a perfectly
    // healthy site gets an alarm about a feature that does not exist. The
    // distinction is the whole point of the component.
    render(
      <NotYetAvailable title="Rift cannot actively check your installation">
        <p>There is no endpoint that fetches your page.</p>
      </NotYetAvailable>,
    );

    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what is missing rather than hiding it", () => {
    render(
      <NotYetAvailable title="Rift cannot actively check your installation">
        <p>There is no endpoint that fetches your page.</p>
      </NotYetAvailable>,
    );

    expect(screen.getByText(/cannot actively check/i)).toBeTruthy();
    expect(screen.getByText(/no endpoint/i)).toBeTruthy();
  });
});
