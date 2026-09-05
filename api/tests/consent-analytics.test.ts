/**
 * Counting consent, and refusing to count what was never recorded.
 *
 * Two rules do most of the work here and both are easy to get wrong in a way
 * that produces a plausible number:
 *
 *   Totals count decisions. Rates count people. A visitor who accepts,
 *   withdraws and accepts again is one person who currently accepts, and
 *   computing acceptance from the log would report them as three visitors, two
 *   of whom refused.
 *
 *   A field that was never populated stays `null` and is labelled "not
 *   recorded". It is never merged into another bucket and never dropped —
 *   dropping it would silently change every rate computed from the total.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getConsentAnalytics, prisma } from "database";
import { GET as consentAnalytics } from "@/app/api/v1/analytics/consent/route";
import { createOwnershipTree, managementRequest, resetDatabase } from "./helpers/fixtures";

let orgA: string;
let orgB: string;
let orgBKey: string;
let siteA: string;
let siteB: string;

/** Purposes are organisation-scoped, so each test makes its own. */
async function purpose(organisationId: string, code: string) {
  return prisma.purpose.create({
    data: { organisationId, code, name: code, description: code },
    select: { id: true },
  });
}

async function principal(siteId: string, external: string) {
  return prisma.principal.create({
    data: { siteId, externalId: external },
    select: { id: true },
  });
}

async function decide(input: {
  organisationId: string;
  siteId: string;
  principalId: string;
  purposeId: string;
  status: "GRANTED" | "DENIED" | "WITHDRAWN";
  decidedAt?: Date;
  jurisdictions?: string[];
  vendors?: string[];
  mechanism?: string | null;
  policyConfigVersion?: string | null;
}) {
  return prisma.consentRecord.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      principalId: input.principalId,
      purposeId: input.purposeId,
      status: input.status,
      decidedAt: input.decidedAt ?? new Date(),
      jurisdictions: input.jurisdictions ?? [],
      vendors: input.vendors ?? [],
      mechanism: input.mechanism ?? null,
      policyConfigVersion: input.policyConfigVersion ?? null,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  const tree = await createOwnershipTree({ prefix: "ca-" });
  orgA = tree.orgA.organisationId;
  orgB = tree.orgB.organisationId;
  orgBKey = tree.orgB.secretKey;
  siteA = tree.siteA1.siteId;
  siteB = tree.siteB1.siteId;
});

describe("totals count decisions", () => {
  it("counts every decision, including a principal changing their mind", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");

    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "WITHDRAWN" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED" });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    expect(out.totals.decisions).toBe(3);
    expect(out.totals.granted).toBe(2);
    expect(out.totals.withdrawn).toBe(1);
    // Three decisions, one person. Both numbers are true and they answer
    // different questions.
    expect(out.totals.principals).toBe(1);
  });
});

describe("rates count people", () => {
  it("reports one indecisive visitor as one acceptance, not three decisions", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");

    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-01-01") });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "WITHDRAWN", decidedAt: new Date("2026-01-02") });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-01-03") });

    // An explicit range: the default is the last 30 days, and these decisions
    // are deliberately dated so the order of them matters.
    const out = await getConsentAnalytics(prisma, {
      organisationId: orgA,
      from: new Date("2025-12-01"),
      to: new Date("2026-02-01"),
    });

    expect(out.rates.principals).toBe(1);
    expect(out.rates.acceptance_rate).toBe(1);
    expect(out.rates.rejection_rate).toBe(0);
  });

  it("counts somebody who accepted one purpose and refused another as partial", async () => {
    // The number operators most want and the one a GROUP BY cannot produce:
    // it is a property of a principal's whole set of decisions, not of a row.
    const analytics = await purpose(orgA, "analytics");
    const marketing = await purpose(orgA, "marketing");
    const who = await principal(siteA, "visitor-1");

    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: analytics.id, status: "GRANTED" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: marketing.id, status: "DENIED" });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    expect(out.rates.partial_rate).toBe(1);
    expect(out.rates.acceptance_rate).toBe(0);
    expect(out.rates.rejection_rate).toBe(0);
  });

  it("still counts a withdrawal as a withdrawal even when something else is granted", async () => {
    const analytics = await purpose(orgA, "analytics");
    const marketing = await purpose(orgA, "marketing");
    const who = await principal(siteA, "visitor-1");

    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: analytics.id, status: "GRANTED" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: marketing.id, status: "WITHDRAWN" });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });
    expect(out.rates.withdrawal_rate).toBe(1);
  });

  it("returns null rather than zero when nobody has decided", async () => {
    // Zero would read as "nobody accepts", which is a finding. Null is the
    // honest answer: there is nothing to take a share of.
    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    expect(out.rates.principals).toBe(0);
    expect(out.rates.acceptance_rate).toBeNull();
    expect(out.rates.rejection_rate).toBeNull();
  });
});

describe("dimensions that were never recorded", () => {
  it("keeps a decision with no jurisdiction rather than dropping it", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", jurisdictions: [] });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });
    const row = out.by_jurisdiction.find((r) => r.key === null);

    expect(row).toBeTruthy();
    expect(row?.label).toMatch(/not recorded/i);
    expect(row?.granted).toBe(1);
    // Dropping it would have made this disagree with the total.
    expect(out.totals.decisions).toBe(1);
  });

  it("distinguishes a missing jurisdiction from one recorded as a value", async () => {
    const p = await purpose(orgA, "analytics");
    const a = await principal(siteA, "visitor-1");
    const b = await principal(siteA, "visitor-2");

    await decide({ organisationId: orgA, siteId: siteA, principalId: a.id, purposeId: p.id, status: "GRANTED", jurisdictions: [] });
    await decide({ organisationId: orgA, siteId: siteA, principalId: b.id, purposeId: p.id, status: "GRANTED", jurisdictions: ["EU"] });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    expect(out.by_jurisdiction.find((r) => r.key === null)?.granted).toBe(1);
    expect(out.by_jurisdiction.find((r) => r.key === "EU")?.granted).toBe(1);
  });

  it("counts a decision under each of its jurisdictions", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", jurisdictions: ["EU", "India"] });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    // One decision, two rows. The rows deliberately sum to more than the total:
    // they are "decisions touching X", not a partition.
    expect(out.by_jurisdiction.find((r) => r.key === "EU")?.total).toBe(1);
    expect(out.by_jurisdiction.find((r) => r.key === "India")?.total).toBe(1);
    expect(out.totals.decisions).toBe(1);
  });

  it("names the dimensions it cannot answer, with a reason for each", async () => {
    const out = await getConsentAnalytics(prisma, { organisationId: orgA });
    const named = out.unavailable_dimensions.map((d) => d.dimension);

    // An empty breakdown says "measured, and it was zero". These were never
    // measurable, and saying so is the difference between a gap and a finding.
    expect(named).toContain("country");
    expect(named).toContain("browser");
    expect(named).toContain("device");
    for (const d of out.unavailable_dimensions) {
      expect(d.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("breakdowns", () => {
  it("groups by purpose using the operator's own names", async () => {
    const analytics = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: analytics.id, status: "GRANTED" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: analytics.id, status: "DENIED" });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });
    const row = out.by_purpose.find((r) => r.key === analytics.id);

    expect(row?.label).toBe("analytics");
    expect(row?.granted).toBe(1);
    expect(row?.denied).toBe(1);
    expect(row?.acceptance_rate).toBe(0.5);
  });

  it("separates policy versions so one can be compared with another", async () => {
    const p = await purpose(orgA, "analytics");
    const a = await principal(siteA, "visitor-1");
    const b = await principal(siteA, "visitor-2");

    await decide({ organisationId: orgA, siteId: siteA, principalId: a.id, purposeId: p.id, status: "GRANTED", policyConfigVersion: "v1" });
    await decide({ organisationId: orgA, siteId: siteA, principalId: b.id, purposeId: p.id, status: "DENIED", policyConfigVersion: "v2" });

    const out = await getConsentAnalytics(prisma, { organisationId: orgA });

    expect(out.by_policy_version.find((r) => r.key === "v1")?.acceptance_rate).toBe(1);
    expect(out.by_policy_version.find((r) => r.key === "v2")?.acceptance_rate).toBe(0);
  });

  it("reports a trend in whole UTC days", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-02-01T10:00:00Z") });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "DENIED", decidedAt: new Date("2026-02-01T18:00:00Z") });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-02-03T09:00:00Z") });

    const out = await getConsentAnalytics(prisma, {
      organisationId: orgA,
      from: new Date("2026-01-01"),
      to: new Date("2026-03-01"),
    });

    expect(out.trend).toEqual([
      { day: "2026-02-01", granted: 1, denied: 1, withdrawn: 0 },
      { day: "2026-02-03", granted: 1, denied: 0, withdrawn: 0 },
    ]);
  });

  it("honours the date range", async () => {
    const p = await purpose(orgA, "analytics");
    const who = await principal(siteA, "visitor-1");
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-01-01") });
    await decide({ organisationId: orgA, siteId: siteA, principalId: who.id, purposeId: p.id, status: "GRANTED", decidedAt: new Date("2026-06-01") });

    const out = await getConsentAnalytics(prisma, {
      organisationId: orgA,
      from: new Date("2026-05-01"),
      to: new Date("2026-07-01"),
    });

    expect(out.totals.decisions).toBe(1);
  });
});

describe("tenant isolation", () => {
  it("never counts another organisation's decisions", async () => {
    const pa = await purpose(orgA, "analytics");
    const pb = await purpose(orgB, "analytics");
    const a = await principal(siteA, "visitor-a");
    const b = await principal(siteB, "visitor-b");

    await decide({ organisationId: orgA, siteId: siteA, principalId: a.id, purposeId: pa.id, status: "GRANTED" });
    await decide({ organisationId: orgB, siteId: siteB, principalId: b.id, purposeId: pb.id, status: "DENIED" });

    const mine = await getConsentAnalytics(prisma, { organisationId: orgA });
    const theirs = await getConsentAnalytics(prisma, { organisationId: orgB });

    expect(mine.totals.decisions).toBe(1);
    expect(mine.totals.granted).toBe(1);
    expect(theirs.totals.decisions).toBe(1);
    expect(theirs.totals.denied).toBe(1);
  });

  it("refuses a site belonging to somebody else", async () => {
    // Indistinguishable from a site that does not exist, which is the point.
    const response = await consentAnalytics(
      managementRequest("/api/v1/analytics/consent", { key: orgBKey, query: { site_id: siteA } }),
    );
    expect(response.status).toBe(404);
  });
});

describe("the endpoint", () => {
  it("requires a management credential", async () => {
    const response = await consentAnalytics(managementRequest("/api/v1/analytics/consent"));
    expect(response.status).toBe(401);
  });

  it("rejects a malformed date rather than guessing at one", async () => {
    const response = await consentAnalytics(
      managementRequest("/api/v1/analytics/consent", { key: orgBKey, query: { from: "not-a-date" } }),
    );
    expect(response.status).toBe(400);
  });
});
