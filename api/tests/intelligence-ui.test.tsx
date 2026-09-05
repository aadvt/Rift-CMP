/**
 * @vitest-environment jsdom
 *
 * The screens, and the one thing they must never say.
 *
 * A dashboard normally has two states: data, or no data. These have three —
 * measured-and-zero, nothing-recorded-yet, and not-measurable-by-design — and
 * collapsing the third into the first is the specific failure worth testing
 * for. A "0" beside Country would read as "no visitors from anywhere", when the
 * truth is that Rift never asks where anyone is.
 *
 * These render the same components the dashboard renders, from the same wire
 * shapes the API returns.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConsentAnalytics } from "../../rift-frontend-main/apps/dashboard/components/intelligence/ConsentAnalytics";
import { QualityScore } from "../../rift-frontend-main/apps/dashboard/components/intelligence/QualityScore";
import {
  DriftFindings,
  ShadowTrackers,
} from "../../rift-frontend-main/apps/dashboard/components/intelligence/Findings";

afterEach(cleanup);

function analytics(over: Record<string, unknown> = {}) {
  return {
    range: { from: "2026-08-01T00:00:00Z", to: "2026-09-01T00:00:00Z" },
    totals: { decisions: 4, granted: 3, denied: 1, withdrawn: 0, principals: 3 },
    rates: {
      acceptance_rate: 0.5,
      rejection_rate: 0.25,
      partial_rate: 0.25,
      withdrawal_rate: 0,
      principals: 3,
    },
    by_purpose: [
      { key: "p1", label: "Analytics", granted: 3, denied: 1, withdrawn: 0, total: 4, acceptance_rate: 0.75 },
    ],
    by_jurisdiction: [
      { key: null, label: "Not recorded (decided before jurisdictions were captured)", granted: 1, denied: 0, withdrawn: 0, total: 1, acceptance_rate: 1 },
    ],
    by_policy_version: [],
    by_mechanism: [],
    by_vendor: [],
    by_site: [],
    trend: [{ day: "2026-08-02", granted: 3, denied: 1, withdrawn: 0 }],
    unavailable_dimensions: [
      { dimension: "country", reason: "Rift never geolocates a visitor, so no country is recorded against a decision." },
      { dimension: "browser", reason: "Recorded on analytics events only, and kept separate from consent identity." },
    ],
    ...over,
  } as never;
}

describe("consent analytics: zero is not unavailable", () => {
  it("names the dimensions it cannot answer, with the reason", () => {
    render(<ConsentAnalytics data={analytics()} />);

    expect(screen.getAllByText(/^not measurable$/i).length).toBeGreaterThan(0);
    expect(screen.getByText("country")).toBeTruthy();
    expect(screen.getByText(/never geolocates/i)).toBeTruthy();
  });

  it("gives an unavailable dimension a reason instead of a count", () => {
    render(<ConsentAnalytics data={analytics()} />);

    // The row is the dimension name, the chip, and the reason — no number.
    const row = screen.getByText("country").closest("li") as HTMLElement;
    expect(row.textContent).toMatch(/never geolocates/i);
    expect(row.textContent).not.toMatch(/\d/);
  });

  it("distinguishes an empty result from an unavailable one", () => {
    const empty = analytics({
      totals: { decisions: 0, granted: 0, denied: 0, withdrawn: 0, principals: 0 },
    });
    render(<ConsentAnalytics data={empty} />);

    // Genuinely empty: a real, reportable state.
    expect(screen.getByText(/no consent decisions recorded yet/i)).toBeTruthy();
    expect(screen.getByText(/genuinely empty, not unavailable/i)).toBeTruthy();
  });

  it("says so when the data could not be read at all", () => {
    render(<ConsentAnalytics data={null} />);

    expect(screen.getByText(/unavailable/i)).toBeTruthy();
    expect(screen.getByText(/not a finding about your visitors/i)).toBeTruthy();
  });

  it("shows a dash rather than zero for a rate with nobody behind it", () => {
    const none = analytics({
      rates: { acceptance_rate: null, rejection_rate: null, partial_rate: null, withdrawal_rate: null, principals: 0 },
    });
    const { container } = render(<ConsentAnalytics data={none} />);

    expect(container.textContent).toContain("—");
  });

  it("keeps a not-recorded breakdown row visible rather than dropping it", () => {
    render(<ConsentAnalytics data={analytics()} />);
    expect(screen.getByText(/not recorded \(decided before jurisdictions/i)).toBeTruthy();
  });

  it("explains that rates count people rather than decisions", () => {
    render(<ConsentAnalytics data={analytics()} />);
    expect(screen.getByText(/rates count people, not decisions/i)).toBeTruthy();
  });
});

function quality(over: Record<string, unknown> = {}) {
  return {
    site_id: "site_1",
    score: 78,
    band: "fair",
    weight_considered: 85,
    computed_at: "2026-09-05T00:00:00Z",
    legal_advice: false,
    not_applicable: ["proof_completeness"],
    components: [
      {
        id: "consent_coverage",
        label: "Consent coverage",
        ratio: 0.9,
        weight: 15,
        earned: 13.5,
        applicable: true,
        detail: "9 of 10 observed technologies are covered.",
        remedy: "Accept the current configuration.",
      },
      {
        id: "proof_completeness",
        label: "Proof completeness",
        ratio: null,
        weight: 5,
        earned: 0,
        applicable: false,
        detail: "No consent decisions recorded yet, so there is nothing to prove.",
        remedy: null,
      },
    ],
    ...over,
  } as never;
}

describe("quality score: a posture reading, not a verdict", () => {
  it("states plainly that it is not a compliance certification", () => {
    render(<QualityScore quality={quality()} />);
    expect(screen.getByText(/not a compliance certification/i)).toBeTruthy();
  });

  it("shows the score out of the weight that actually applied", () => {
    render(<QualityScore quality={quality()} />);
    expect(screen.getByText("78")).toBeTruthy();
    expect(screen.getByText(/85 of 100 points that applied/i)).toBeTruthy();
  });

  it("explains each component and what would raise it", () => {
    render(<QualityScore quality={quality()} />);

    expect(screen.getByText(/9 of 10 observed technologies/i)).toBeTruthy();
    expect(screen.getByText(/accept the current configuration/i)).toBeTruthy();
  });

  it("shows components that were set aside rather than hiding them", () => {
    // A high score over five components is not the same as a high score over
    // nine, and hiding the difference would let a thin site look healthy.
    render(<QualityScore quality={quality()} />);

    expect(screen.getAllByText(/^not scored$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/nothing to prove/i)).toBeTruthy();
  });

  it("says unavailable rather than showing a zero when it cannot be read", () => {
    render(<QualityScore quality={null} />);
    expect(screen.getByText(/not a score of zero/i)).toBeTruthy();
  });
});

function shadowTracker(over: Record<string, unknown> = {}) {
  return {
    id: "ga",
    host: "google-analytics.com",
    vendor: "Google Analytics",
    category: "analytics",
    reason: "not_configured",
    severity: "medium",
    pages: ["https://example.com/"],
    destination_country: "US",
    crosses_border: true,
    confidence: "medium",
    approved: false,
    purpose: null,
    policy_action: null,
    evidence: [{ source: "scan", detail: "Observed by the scanner.", scan_id: "scan_1" }],
    recommended_action: "Review it and decide whether it needs consent.",
    first_seen: null,
    last_seen: null,
    ...over,
  } as never;
}

describe("findings show their evidence", () => {
  it("says nothing is wrong when nothing is", () => {
    render(<ShadowTrackers findings={[]} />);
    expect(screen.getByText(/nothing unaccounted for/i)).toBeTruthy();
  });

  it("shows where the observation came from", () => {
    render(<ShadowTrackers findings={[shadowTracker()] as never} />);

    expect(screen.getByText(/observed by the scanner/i)).toBeTruthy();
    expect(screen.getByText("scan")).toBeTruthy();
  });

  it("carries the scanner's confidence rather than asserting certainty", () => {
    render(<ShadowTrackers findings={[shadowTracker()] as never} />);
    expect(screen.getByText(/medium confidence/i)).toBeTruthy();
  });

  it("tells the reader what to do about it", () => {
    render(<ShadowTrackers findings={[shadowTracker()] as never} />);
    expect(screen.getByText(/review it and decide/i)).toBeTruthy();
  });

  it("shows drift as a before and after, against the approved version", () => {
    render(
      <DriftFindings
        findings={
          [
            {
              id: "added:ga",
              kind: "tracker_added",
              severity: "high",
              host: "Google Analytics",
              vendor: "Google Analytics",
              page: null,
              previous_state: "Not present in the previous scan",
              current_state: "Observed",
              policy_version: 3,
              evidence: [{ source: "scan", detail: "Present in this scan." }],
              recommended_action: "Review it.",
            },
          ] as never
        }
      />,
    );

    expect(screen.getByText(/not present in the previous scan/i)).toBeTruthy();
    expect(screen.getByText(/against v3/i)).toBeTruthy();
  });

  it("says nothing has drifted when nothing has", () => {
    render(<DriftFindings findings={[]} />);
    expect(screen.getByText(/nothing has drifted/i)).toBeTruthy();
  });
});
