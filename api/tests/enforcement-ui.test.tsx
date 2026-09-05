/**
 * @vitest-environment jsdom
 *
 * The Protection screen, and the two numbers it must never present plainly.
 *
 * "14 blocked" reads as *fourteen things tried to leave and we stopped them*. On
 * the client plane it means fourteen things the SDK saw, which excludes
 * everything that ran before it and everything that never touched the browser.
 * And a block taken in observe mode stopped nothing at all.
 *
 * Both of those are the kind of qualification that gets written into
 * documentation and then never read, so these tests hold them on the screen.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Enforcement } from "../../rift-frontend-main/apps/dashboard/components/intelligence/Enforcement";

afterEach(cleanup);

function history(over: Record<string, unknown> = {}) {
  return {
    events: [
      {
        id: "e1",
        site_id: "site-1",
        occurred_at: "2026-09-05T10:00:00Z",
        source: "client",
        destination_host: "google-analytics.com",
        vendor: "Google Analytics",
        purpose: "analytics",
        decision: "REQUIRE_CONSENT",
        effect: "block",
        observed_only: false,
        policy_version: "3",
        matched_rule: { host: "google-analytics.com", action: "require_consent" },
        reason: "Silence is not consent, so Google Analytics is blocked.",
        severity: "medium",
        redactions: null,
      },
    ],
    summary: {
      by_decision: { REQUIRE_CONSENT: 1 },
      observed_only: 0,
      blocked: 1,
      redacted: 0,
      needs_review: 2,
      total: 3,
      destinations: 2,
    },
    coverage: {
      client_enforcement: "Decisions the browser SDK took and reported.",
      server_enforcement: "Decisions taken on a request path routed through Rift's firewall.",
      not_covered: [
        "Anything the page loaded before the SDK ran, including every script in the served HTML.",
        "Requests made by your own backend that do not go through the firewall.",
        "Traffic between a vendor's servers and anywhere else.",
      ],
    },
    ...over,
  } as never;
}

describe("the counts are never presented alone", () => {
  it("shows what the log does not cover, on the screen", () => {
    render(<Enforcement history={history()} />);

    expect(screen.getByText(/what this log covers/i)).toBeTruthy();
    expect(screen.getByText(/not covered at all/i)).toBeTruthy();
    expect(screen.getByText(/served HTML/i)).toBeTruthy();
  });

  it("names the plane each decision was taken on", () => {
    // A server block means the bytes did not leave. A client block means a
    // page-level patch declined, which a hostile script could have undone.
    render(<Enforcement history={history()} />);
    expect(screen.getByText("the browser")).toBeTruthy();
  });

  it("distinguishes a server decision from a browser one", () => {
    const server = history({
      events: [
        {
          ...(history() as never as { events: Array<Record<string, unknown>> }).events[0],
          id: "e2",
          source: "server",
        },
      ],
    });
    render(<Enforcement history={server} />);
    expect(screen.getByText("your server")).toBeTruthy();
  });
});

describe("observe mode", () => {
  it("says nothing was actually stopped", () => {
    const observed = history({
      summary: {
        by_decision: { BLOCK: 4 },
        observed_only: 4,
        blocked: 4,
        redacted: 0,
        needs_review: 0,
        total: 4,
        destinations: 1,
      },
    });
    render(<Enforcement history={observed} />);

    expect(screen.getByText(/observed, not applied/i)).toBeTruthy();
    expect(screen.getByText(/changed nothing on the site/i)).toBeTruthy();
  });

  it("marks the individual row too, not only the banner", () => {
    const observed = history({
      events: [
        {
          ...(history() as never as { events: Array<Record<string, unknown>> }).events[0],
          observed_only: true,
        },
      ],
      summary: {
        by_decision: { REQUIRE_CONSENT: 1 },
        observed_only: 1,
        blocked: 1,
        redacted: 0,
        needs_review: 0,
        total: 1,
        destinations: 1,
      },
    });
    render(<Enforcement history={observed} />);
    expect(screen.getAllByText(/observed, not applied/i).length).toBeGreaterThan(1);
  });

  it("shows no observe banner when everything was applied", () => {
    render(<Enforcement history={history()} />);
    expect(screen.queryByText(/changed nothing on the site/i)).toBeNull();
  });
});

describe("redaction detail", () => {
  it("shows the path a rule hit and never a value", () => {
    const redacted = history({
      events: [
        {
          ...(history() as never as { events: Array<Record<string, unknown>> }).events[0],
          decision: "REDACT",
          effect: "allow",
          redactions: [{ rule: "email", location: "body", path: "user.email" }],
        },
      ],
    });
    const { container } = render(<Enforcement history={redacted} />);

    expect(screen.getByText("body:user.email")).toBeTruthy();
    // Showing what was redacted here would defeat redacting it.
    expect(container.textContent).not.toMatch(/@/);
  });
});

describe("empty and unavailable", () => {
  it("says an empty log is not the same as a clean site", () => {
    const empty = history({
      events: [],
      summary: {
        by_decision: {},
        observed_only: 0,
        blocked: 0,
        redacted: 0,
        needs_review: 0,
        total: 0,
        destinations: 0,
      },
    });
    render(<Enforcement history={empty} />);

    expect(screen.getByText(/nothing recorded yet/i)).toBeTruthy();
    expect(screen.getByText(/not the same as a site with nothing to block/i)).toBeTruthy();
  });

  it("says a failed request failed, rather than reporting zero", () => {
    render(<Enforcement history={null} />);
    expect(screen.getByText(/not a quiet site/i)).toBeTruthy();
  });
});

describe("what a row explains", () => {
  it("carries the engine's reason verbatim", () => {
    render(<Enforcement history={history()} />);
    expect(screen.getByText(/silence is not consent/i)).toBeTruthy();
  });

  it("names the rule and the configuration version", () => {
    render(<Enforcement history={history()} />);
    expect(screen.getByText(/rule: google-analytics.com \(require_consent\)/i)).toBeTruthy();
    expect(screen.getByText(/against v3/i)).toBeTruthy();
  });

  it("counts unreviewed destinations separately from blocks", () => {
    // An allowed-but-unmatched destination is a task, not a block, and merging
    // the two would make a site look either busier or safer than it is.
    render(<Enforcement history={history()} />);
    expect(screen.getByText(/allowed, but matched no approved rule/i)).toBeTruthy();
  });
});
