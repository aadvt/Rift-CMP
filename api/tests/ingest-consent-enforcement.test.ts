import { beforeEach, describe, expect, it } from "vitest";
import { prisma, recordConsentDecision } from "database";
import { POST as ingest } from "@/app/api/v1/events/route";
import { POST as recordConsent } from "@/app/api/v1/consent/route";
import {
  buildEvent,
  createConsentFixture,
  createOwnershipTree,
  ingestRequest,
  openConsentSession,
  resetDatabase,
  siteRequest,
  type OpenedConsentSession,
} from "./helpers/fixtures";

/**
 * Server-side consent enforcement on the ingestion plane.
 *
 * The SDK has always been able to gate events client-side. That gate runs in
 * code the caller controls, on a page whose public key anybody can read, so it
 * is a convenience and not a control: an event batch arriving at the API is
 * evidence of nothing at all about what a person agreed to.
 *
 * A site opts in by setting `analytics_consent_purpose`. From then on the API
 * re-derives the decision from the append-only log on every batch — it does not
 * believe a flag, a header, or a claim in the payload. What the request supplies
 * is only *which principal to look up*; the answer comes from `consent_records`.
 *
 * Sites that have not opted in keep the pre-6A behaviour exactly, which the
 * first test here pins.
 */

beforeEach(resetDatabase);

interface Fixture {
  siteId: string;
  publicKey: string;
  purposeCode: string;
  session: OpenedConsentSession;
}

/**
 * A site with the gate on, and a browser that holds a session for it.
 *
 * `prefix` exists because organisation slugs are globally unique, and one test
 * below needs two independent enforcing sites inside a single `it`.
 */
async function enforcingSite(prefix = ""): Promise<Fixture> {
  const tree = await createOwnershipTree({ prefix });
  const consent = await createConsentFixture(tree.orgA.organisationId, prefix);

  await prisma.website.update({
    where: { id: tree.siteA1.siteId },
    data: { analyticsConsentPurpose: consent.purposeCode },
  });

  const session = await openConsentSession(tree.siteA1.publicKey);

  return {
    siteId: tree.siteA1.siteId,
    publicKey: tree.siteA1.publicKey,
    purposeCode: consent.purposeCode,
    session,
  };
}

/** Records a decision through the real route, so the log is genuine. */
async function decide(fixture: Fixture, status: "GRANTED" | "DENIED" | "WITHDRAWN") {
  const response = await recordConsent(
    siteRequest("/api/v1/consent", {
      key: fixture.publicKey,
      method: "POST",
      sessionToken: fixture.session.sessionToken,
      body: {
        principal_external_id: fixture.session.principalExternalId,
        purpose_code: fixture.purposeCode,
        status,
      },
    }),
  );
  if (response.status !== 201) {
    throw new Error(`decide(${status}) failed: ${response.status} ${await response.text()}`);
  }
}

function batchFor(siteId: string) {
  return { events: [buildEvent({ site_id: siteId })] };
}

describe("sites that have not opted in", () => {
  it("accepts events with no consent session at all", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(batchFor(siteA1.siteId), { key: siteA1.publicKey }),
    );

    // This is the pre-6A contract, and it is preserved deliberately: a site that
    // has not declared that its analytics needs consent has declared nothing for
    // the server to enforce.
    expect(response.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });
});

describe("absent consent", () => {
  it("refuses a batch with no consent session", async () => {
    const fixture = await enforcingSite();

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), { key: fixture.publicKey }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_session_required" },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("refuses a batch from a principal who has never decided anything", async () => {
    const fixture = await enforcingSite();

    // A live, legitimate session — but no decision behind it. Absence of a
    // decision is not permission.
    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_required" },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("refuses a batch when the decision is DENIED", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "DENIED");

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.event.count()).toBe(0);
  });
});

describe("forged consent", () => {
  it("refuses an invented session token", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: "cs_invented",
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("refuses a session belonging to another site, even with consent granted there", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    // A second enforcing site, whose visitor genuinely granted consent. Their
    // token must not unlock the first site's ingestion.
    const other = await enforcingSite("other-");
    await decide(other, "GRANTED");

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: other.session.sessionToken,
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.event.count({ where: { siteId: fixture.siteId } })).toBe(0);
  });

  it("cannot be bypassed by naming a consenting principal in the payload", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    // There is nowhere in the event envelope to put a principal, and that is the
    // point: the only thing that selects one is the session. Smuggling the
    // identifier into a custom property changes nothing.
    const event = buildEvent({
      site_id: fixture.siteId,
      event_type: "custom",
      name: "checkout",
      payload: {
        page: { url: "https://a1.example.com/checkout", title: "Checkout" },
        device: { type: "desktop", browser: "Chrome", os: "Windows" },
        referrer: null,
        properties: { principal_external_id: fixture.session.principalExternalId },
      },
    });

    const response = await ingest(ingestRequest({ events: [event] }, { key: fixture.publicKey }));

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });
});

describe("revoked consent", () => {
  it("stops accepting events as soon as the decision is withdrawn", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    const accepted = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );
    expect(accepted.status).toBe(202);

    await decide(fixture, "WITHDRAWN");

    // The same, still-valid session token. The token was never the evidence:
    // the log is, and it is re-read on every batch.
    const refused = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    expect(refused.status).toBe(403);
    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "consent_required" },
    });
    expect(await prisma.event.count()).toBe(1);
  });

  it("resumes when consent is granted again", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");
    await decide(fixture, "WITHDRAWN");
    await decide(fixture, "GRANTED");

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    expect(response.status).toBe(202);
    expect(await prisma.consentRecord.count()).toBe(3);
  });
});

describe("valid consent", () => {
  it("accepts a batch when the decision in force is GRANTED", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    const response = await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 0 });
  });

  it("writes no principal identifier onto the analytics rows", async () => {
    const fixture = await enforcingSite();
    await decide(fixture, "GRANTED");

    await ingest(
      ingestRequest(batchFor(fixture.siteId), {
        key: fixture.publicKey,
        sessionToken: fixture.session.sessionToken,
      }),
    );

    // Enforcement resolves a principal in-request to answer "may these be
    // stored" and then forgets it. The rule that analytics carries no consent
    // state and no persistent person identifier is unchanged by Phase 6A.
    const event = await prisma.event.findFirstOrThrow();
    const serialised = JSON.stringify(event);
    expect(serialised).not.toContain(fixture.session.principalExternalId);
    expect(Object.keys(event)).not.toContain("principalId");

    const session = await prisma.session.findFirstOrThrow();
    expect(JSON.stringify(session)).not.toContain(fixture.session.principalExternalId);
  });

  it("enforces the purpose the site named, not any granted purpose", async () => {
    const tree = await createOwnershipTree();
    const consent = await createConsentFixture(tree.orgA.organisationId);

    await prisma.website.update({
      where: { id: tree.siteA1.siteId },
      data: { analyticsConsentPurpose: consent.purposeCode },
    });

    const session = await openConsentSession(tree.siteA1.publicKey);

    // Granted, but for the *other* purpose.
    await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      purposeCode: consent.secondPurposeCode,
      status: "GRANTED",
    });

    const response = await ingest(
      ingestRequest(batchFor(tree.siteA1.siteId), {
        key: tree.siteA1.publicKey,
        sessionToken: session.sessionToken,
      }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.event.count()).toBe(0);
  });

  it("does not gate one site because a sibling site enforces consent", async () => {
    const tree = await createOwnershipTree();
    const consent = await createConsentFixture(tree.orgA.organisationId);

    await prisma.website.update({
      where: { id: tree.siteA1.siteId },
      data: { analyticsConsentPurpose: consent.purposeCode },
    });

    const response = await ingest(
      ingestRequest(batchFor(tree.siteA2.siteId), { key: tree.siteA2.publicKey }),
    );

    expect(response.status).toBe(202);
    expect(await prisma.event.count({ where: { siteId: tree.siteA2.siteId } })).toBe(1);
  });
});
