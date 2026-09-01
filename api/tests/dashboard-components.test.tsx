// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatTile,
  StatusBadge,
} from "@/app/dashboard/_components/ui";
import {
  displayPath,
  formatCount,
  formatDate,
  formatDateTime,
  formatShare,
  shortId,
} from "@/app/dashboard/_components/format";

/**
 * Presentational component tests.
 *
 * These cover the parts of the dashboard that are easy to get subtly wrong and
 * that no API test would catch: the difference between "nothing here" and
 * "something broke", a status rendering with the wrong tone, and a count of
 * zero disappearing because someone treated it as falsy.
 *
 * No database and no network - these run in milliseconds.
 */

afterEach(cleanup);

describe("state components", () => {
  it("announces an empty state as status, not as an error", () => {
    render(<EmptyState title="No consent decisions" hint="Record one to see rows." />);

    const region = screen.getByRole("status");
    expect(within(region).getByText("No consent decisions")).toBeTruthy();
    expect(within(region).getByText("Record one to see rows.")).toBeTruthy();
    // An empty result must never be announced as a failure.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces an error as an alert and shows the underlying message", () => {
    render(<ErrorState title="History could not be loaded" message="The API was unreachable." />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("History could not be loaded")).toBeTruthy();
    // The real cause must reach the operator rather than being swallowed.
    expect(within(alert).getByText("The API was unreachable.")).toBeTruthy();
  });

  it("renders an empty state without a hint", () => {
    render(<EmptyState title="Nothing yet" />);
    expect(screen.getByRole("status").textContent).toBe("Nothing yet");
  });

  it("marks the loading state as a live region so it is announced", () => {
    render(<LoadingState label="Loading transfers" />);

    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-label")).toBe("Loading transfers");
  });
});

describe("stat tiles", () => {
  it("renders a zero rather than hiding it", () => {
    render(<StatTile label="Withdrawn" value={0} />);

    // A count of zero is information. Treating it as falsy and rendering blank
    // would read as "no data" when it means "none, and we checked".
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Withdrawn")).toBeTruthy();
  });

  it("shows an optional hint", () => {
    render(<StatTile label="Sessions" value="1,204" hint="Last 30 days" />);
    expect(screen.getByText("Last 30 days")).toBeTruthy();
  });
});

describe("status badges", () => {
  it("gives permitting statuses a positive tone", () => {
    for (const status of ["GRANTED", "DELIVERED", "AUTHORISED", "RECORDED"]) {
      cleanup();
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status).className).toContain("badge-ok");
    }
  });

  it("gives refusing statuses a negative tone", () => {
    for (const status of ["DENIED", "WITHDRAWN", "FAILED"]) {
      cleanup();
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status).className).toContain("badge-bad");
    }
  });

  it("gives spent statuses a warning tone", () => {
    for (const status of ["CONSUMED", "EXPIRED"]) {
      cleanup();
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status).className).toContain("badge-warn");
    }
  });

  it("degrades an unknown status to neutral rather than breaking", () => {
    render(<StatusBadge status="SOMETHING_NEW" />);
    const badge = screen.getByText("SOMETHING_NEW");
    expect(badge.className).toBe("badge");
  });
});

describe("formatting", () => {
  it("groups thousands and keeps zero visible", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(1000000)).toBe("1,000,000");
  });

  it("renders timestamps unambiguously and in 24-hour time", () => {
    const formatted = formatDateTime("2026-09-01T14:05:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Sept");
    // No am/pm anywhere, so a timestamp is never ambiguous.
    expect(formatted.toLowerCase()).not.toContain("am");
    expect(formatted.toLowerCase()).not.toContain("pm");
  });

  it("renders a placeholder for absent or unparseable dates", () => {
    for (const value of [null, undefined, "", "not-a-date"]) {
      expect(formatDateTime(value)).toBe("—");
      expect(formatDate(value)).toBe("—");
    }
  });

  it("truncates long identifiers but leaves short ones alone", () => {
    expect(shortId("8ad1f0c2-6b78-4d12-bb09-e65ec6d3b2a9")).toBe("8ad1f0c2…");
    expect(shortId("short")).toBe("short");
    expect(shortId(null)).toBe("—");
  });

  it("reduces a URL to its path for a top-pages table", () => {
    expect(displayPath("https://example.com/pricing")).toBe("/pricing");
    expect(displayPath("https://example.com/search?q=1")).toBe("/search?q=1");
    expect(displayPath("https://example.com")).toBe("/");
    // A value that is not a URL is shown as-is rather than throwing.
    expect(displayPath("not a url")).toBe("not a url");
  });

  it("computes share without dividing by zero", () => {
    expect(formatShare(0, 0)).toBe("0%");
    expect(formatShare(1, 4)).toBe("25%");
    expect(formatShare(4, 4)).toBe("100%");
  });
});
