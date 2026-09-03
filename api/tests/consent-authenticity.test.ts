import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type { ConsentSessionResponse } from "@rift-cmp/shared";
import { POST as recordConsent } from "@/app/api/v1/consent/route";
import { POST as openSession } from "@/app/api/v1/consent/session/route";
import {
  createConsentFixture,
  createOwnershipTree,
  openConsentSession,
  resetDatabase,
  siteRequest,
} from "./helpers/fixtures";

/**
 * Consent decision authenticity.
 *
 * The threat this file is about: **the site public key is printed in page
 * source**, so before Phase 6A "the caller holds a `pk_`" was true of everybody
 * on the internet, and `POST /api/v1/consent` accepted a decision for any
 * `principal_external_id` it was handed. Combined with an append-only log, that
 * meant anyone could write a permanent, unremovable record asserting that a
 * named person had consented to something.
 *
 * Every test below is written from the attacker's side. What is being asserted
 * is not that the mechanism is unbreakable — the honest limits are in
 * docs/security.md, and a scripted client can still mint principals of its own —
 * but that the specific attack of *speaking for somebody else's principal* is
 * closed.
 */

beforeEach(resetDatabase);

const VICTIM = "victim-principal-id";

async function setup() {
  const tree = await createOwnershipTree();
  const consent = await createConsentFixture(tree.orgA.organisationId);
  return { ...tree, consent };
}

/** A decision request, exactly as an attacker would compose it. */
function decisionRequest(options: {
  publicKey: string;
  principal: string;
  purposeCode: string;
  sessionToken?: string;
  status?: string;
}) {
  return siteRequest("/api/v1/consent", {
    key: options.publicKey,
    method: "POST",
    ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
    body: {
      principal_external_id: options.principal,
      purpose_code: options.purposeCode,
      status: options.status ?? "GRANTED",
    },
  });
}

describe("a public key alone cannot record a decision", () => {
  it("refuses a decision with no consent session", async () => {
    const { siteA1, consent } = await setup();

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: VICTIM,
        purposeCode: consent.purposeCode,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_session_required" },
    });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a fabricated session token", async () => {
    const { siteA1, consent } = await setup();

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: VICTIM,
        purposeCode: consent.purposeCode,
        sessionToken: "cs_totally-made-up-token-value",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_session" },
    });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a token that is not even session-shaped", async () => {
    const { siteA1, consent } = await setup();

    for (const token of ["", "   ", "pk_abc", "sk_abc", "cs_"]) {
      const response = await recordConsent(
        decisionRequest({
          publicKey: siteA1.publicKey,
          principal: VICTIM,
          purposeCode: consent.purposeCode,
          sessionToken: token,
        }),
      );
      expect(response.status).toBe(401);
    }

    expect(await prisma.consentRecord.count()).toBe(0);
  });
});

describe("a session speaks for exactly one principal", () => {
  it("refuses a decision naming a different principal", async () => {
    const { siteA1, consent } = await setup();

    // The attacker legitimately opens a session — anyone may — and then tries to
    // record against somebody else's identifier. This is the whole attack.
    const attacker = await openConsentSession(siteA1.publicKey);

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: VICTIM,
        purposeCode: consent.purposeCode,
        sessionToken: attacker.sessionToken,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "principal_mismatch" },
    });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a session opened for a principal whose secret is wrong", async () => {
    const { siteA1 } = await setup();

    // The victim exists and has bound a secret.
    await openConsentSession(siteA1.publicKey, {
      siteId: siteA1.siteId,
      principalExternalId: VICTIM,
      principalSecret: "ps_the-real-secret",
    });

    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: VICTIM, principal_secret: "ps_a-guess" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("answers identically for an unknown principal and a wrong secret", async () => {
    const { siteA1 } = await setup();

    await openConsentSession(siteA1.publicKey, {
      siteId: siteA1.siteId,
      principalExternalId: VICTIM,
      principalSecret: "ps_the-real-secret",
    });

    const wrongSecret = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: VICTIM, principal_secret: "ps_a-guess" },
      }),
    );
    const unknownPrincipal = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: "no-such-principal", principal_secret: "ps_a-guess" },
      }),
    );

    // Identical, so the endpoint cannot be used to enumerate which principals a
    // site has ever seen.
    expect(wrongSecret.status).toBe(unknownPrincipal.status);
    expect(await wrongSecret.json()).toEqual(await unknownPrincipal.json());
  });

  it("refuses a principal id without a secret", async () => {
    const { siteA1 } = await setup();

    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: VICTIM },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("will not let a client choose its own principal identifier", async () => {
    const { siteA1 } = await setup();

    // Nothing in the request names a principal, so the server mints one. A
    // client that could pick the identifier could pick one that collides with
    // somebody else's, or squat on one it expects to see later.
    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: {},
      }),
    );
    const body = (await response.json()) as ConsentSessionResponse;

    expect(response.status).toBe(201);
    expect(body.principal_external_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.principal_secret).toMatch(/^ps_[0-9a-f]{64}$/);
    expect(body.session_token).toMatch(/^cs_/);
  });
});

describe("cross-tenant and cross-site session use", () => {
  it("refuses a session minted on another site in the same organisation", async () => {
    const { siteA1, siteA2, consent } = await setup();

    const onA1 = await openConsentSession(siteA1.publicKey);

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA2.publicKey,
        principal: onA1.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: onA1.sessionToken,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_session" },
    });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a session minted in another organisation entirely", async () => {
    const { siteA1, siteB1, consent } = await setup();
    const consentB = await createConsentFixture(
      (await prisma.website.findUniqueOrThrow({ where: { id: siteB1.siteId } })).organisationId,
      "b-",
    );

    const onB1 = await openConsentSession(siteB1.publicKey);

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: onB1.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: onB1.sessionToken,
      }),
    );

    expect(response.status).toBe(401);
    expect(consentB.purposeCode).toBeTruthy();
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("keeps the same external id as two unrelated principals with unrelated secrets", async () => {
    const { siteA1, siteB1 } = await setup();

    const onA1 = await openConsentSession(siteA1.publicKey, {
      siteId: siteA1.siteId,
      principalExternalId: "shared-id",
      principalSecret: "ps_secret-for-site-a",
    });

    // Site B's principal with the same external id is a different person, and
    // site A's secret does not open it.
    await openConsentSession(siteB1.publicKey, {
      siteId: siteB1.siteId,
      principalExternalId: "shared-id",
      principalSecret: "ps_secret-for-site-b",
    });

    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteB1.publicKey,
        method: "POST",
        body: { principal_external_id: "shared-id", principal_secret: "ps_secret-for-site-a" },
      }),
    );

    expect(response.status).toBe(401);
    expect(onA1.sessionToken).toBeTruthy();
  });
});

describe("replay and exhaustion", () => {
  it("refuses a session after it has expired", async () => {
    const { siteA1, consent } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    await prisma.consentSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: session.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: session.sessionToken,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "session_expired" },
    });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a revoked session", async () => {
    const { siteA1, consent } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    await prisma.consentSession.updateMany({ data: { revokedAt: new Date() } });

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: session.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: session.sessionToken,
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("caps how many decisions one session may record", async () => {
    const { siteA1, consent } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    // Lowered rather than looped 50 times: the cap is the behaviour under test,
    // not the specific number, and 50 round trips would make this file slow.
    await prisma.consentSession.updateMany({ data: { maxDecisions: 2 } });

    for (let i = 0; i < 2; i += 1) {
      const ok = await recordConsent(
        decisionRequest({
          publicKey: siteA1.publicKey,
          principal: session.principalExternalId,
          purposeCode: consent.purposeCode,
          sessionToken: session.sessionToken,
        }),
      );
      expect(ok.status).toBe(201);
    }

    const refused = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: session.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: session.sessionToken,
      }),
    );

    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "session_exhausted" },
    });
    expect(await prisma.consentRecord.count()).toBe(2);
  });

  it("charges the cap even when the decision itself is rejected", async () => {
    const { siteA1 } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: session.principalExternalId,
        purposeCode: "no-such-purpose",
        sessionToken: session.sessionToken,
      }),
    );

    expect(response.status).toBe(400);
    // Otherwise a caller could probe purpose codes without limit by making sure
    // every attempt failed.
    const row = await prisma.consentSession.findFirstOrThrow();
    expect(row.decisionCount).toBe(1);
  });
});

describe("legitimate use still works", () => {
  it("records a decision through a freshly minted session", async () => {
    const { siteA1, consent } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    const response = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: session.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: session.sessionToken,
      }),
    );

    expect(response.status).toBe(201);
    const stored = await prisma.consentRecord.findFirstOrThrow({ include: { principal: true } });
    expect(stored.status).toBe("GRANTED");
    expect(stored.principal.externalId).toBe(session.principalExternalId);
  });

  it("lets a returning browser reopen a session with its stored secret", async () => {
    const { siteA1, consent } = await setup();
    const first = await openConsentSession(siteA1.publicKey);

    const reopened = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: {
          principal_external_id: first.principalExternalId,
          principal_secret: first.principalSecret,
        },
      }),
    );
    const body = (await reopened.json()) as ConsentSessionResponse;

    expect(reopened.status).toBe(201);
    expect(body.principal_external_id).toBe(first.principalExternalId);
    // Never re-sent: the browser already has it.
    expect(body.principal_secret).toBeNull();
    expect(body.session_token).not.toBe(first.sessionToken);

    const decision = await recordConsent(
      decisionRequest({
        publicKey: siteA1.publicKey,
        principal: first.principalExternalId,
        purposeCode: consent.purposeCode,
        sessionToken: body.session_token,
      }),
    );
    expect(decision.status).toBe(201);
    expect(await prisma.principal.count()).toBe(1);
  });

  it("binds a secret to a legacy principal on first use, then holds it", async () => {
    const { siteA1 } = await setup();

    // A principal created before Phase 6A, or by the seed script: no secret.
    await prisma.principal.create({
      data: { siteId: siteA1.siteId, externalId: "legacy-principal" },
    });

    const bound = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: "legacy-principal", principal_secret: "ps_first-claim" },
      }),
    );
    expect(bound.status).toBe(201);

    const stolen = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: "legacy-principal", principal_secret: "ps_second-claim" },
      }),
    );

    // Trust on first use: the first claim wins and every later one is refused.
    // The weakness — that the *first* claim need not be the real browser — is
    // documented in docs/security.md rather than papered over here.
    expect(stolen.status).toBe(401);
  });

  it("stores only a digest of the session token", async () => {
    const { siteA1 } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    const row = await prisma.consentSession.findFirstOrThrow();
    expect(row.tokenHash).not.toContain(session.sessionToken);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores only a digest of the principal secret", async () => {
    const { siteA1 } = await setup();
    const session = await openConsentSession(siteA1.publicKey);

    const principal = await prisma.principal.findFirstOrThrow();
    expect(principal.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(principal.secretHash).not.toContain(session.principalSecret);
  });
});
