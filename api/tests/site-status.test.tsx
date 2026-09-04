/**
 * @vitest-environment jsdom
 *
 * The site card, and the two words it must never confuse.
 *
 * "Connected" is an observation — data arrived. "Protected" is a configuration
 * fact — a policy version was approved. Neither is a compliance claim, and the
 * failure mode worth testing for is not a crash but a card that quietly implies
 * one of those things when the other is true.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteStatusCard, type SiteStatus } from "../app/dashboard/_components/site-status";

afterEach(cleanup);

function status(overrides: Partial<SiteStatus> = {}): SiteStatus {
  return {
    siteId: "site_1",
    name: "Example",
    domain: "example.com",
    connected: true,
    protected: true,
    scanStatus: "completed",
    scannedAt: new Date().toISOString(),
    findings: { pages: 43, cookies: 12, services: 7, technologies: 4 },
    attention: 0,
    undeclaredPurposes: [],
    sessions: 24_381,
    pageViews: 31_204,
    ...overrides,
  };
}

describe("connection", () => {
  it("says connected only once data has actually arrived", () => {
    render(<SiteStatusCard status={status({ connected: true })} />);
    expect(screen.getByText(/^connected$/i)).toBeTruthy();
  });

  it("says waiting rather than broken when nothing has arrived", () => {
    // A site installed five minutes ago with no visitors yet is not a failure,
    // and calling it one would send operators hunting for a bug that is not
    // there. There is no endpoint that could tell the two apart.
    render(<SiteStatusCard status={status({ connected: false })} />);

    expect(screen.getByText(/waiting for data/i)).toBeTruthy();
    expect(screen.queryByText(/^connected$/i)).toBeNull();
  });
});

describe("protection", () => {
  it("reports protected when a configuration has been approved", () => {
    render(<SiteStatusCard status={status({ protected: true })} />);
    expect(screen.getByText(/^protected$/i)).toBeTruthy();
  });

  it("does not claim protection merely because data is arriving", () => {
    // Events flowing says the snippet runs. It says nothing about whether
    // anybody approved a configuration for it to apply.
    render(<SiteStatusCard status={status({ connected: true, protected: false })} />);

    expect(screen.getByText(/not configured yet/i)).toBeTruthy();
    expect(screen.queryByText(/^protected$/i)).toBeNull();
  });
});

describe("the scanner line", () => {
  it("distinguishes never scanned from scanned long ago", () => {
    render(<SiteStatusCard status={status({ scanStatus: null, scannedAt: null })} />);
    expect(screen.getByText(/never scanned/i)).toBeTruthy();
  });

  it("reports a scan that is still running as running", () => {
    render(<SiteStatusCard status={status({ scanStatus: "running" })} />);
    expect(screen.getByText(/scan running/i)).toBeTruthy();
  });
});

describe("findings", () => {
  it("shows counts without dressing them as problems", () => {
    render(<SiteStatusCard status={status()} />);

    // Counts are facts about a website, not warnings about it. If this ever
    // starts rendering an alert role, the card has changed its mind about that.
    expect(screen.getByText("43")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says nothing was found rather than showing zeroes for an unscanned site", () => {
    render(<SiteStatusCard status={status({ findings: null })} />);
    expect(screen.getByText(/has not scanned this site/i)).toBeTruthy();
  });
});

describe("attention", () => {
  it("stays quiet when Rift is not asking for a decision", () => {
    render(<SiteStatusCard status={status({ attention: 0 })} />);
    expect(screen.queryByText(/needs attention/i)).toBeNull();
  });

  it("asks only when there is a decision only a person can make", () => {
    render(<SiteStatusCard status={status({ attention: 2 })} />);

    expect(screen.getByText(/needs attention/i)).toBeTruthy();
    expect(screen.getByText(/2 items Rift cannot decide for you/i)).toBeTruthy();
  });
});
