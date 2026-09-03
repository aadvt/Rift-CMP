import { beforeEach, describe, expect, it } from "vitest";
import {
  DASHBOARD_SESSION_IDLE_SECONDS,
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
  createDashboardSession,
  createOrganisation,
  generateDashboardSessionToken,
  openSecret,
  prisma,
  resolveDashboardSession,
  revokeAllDashboardSessions,
  revokeDashboardSession,
  sealSecret,
} from "database";
import { resetDatabase } from "./helpers/fixtures";

/**
 * Dashboard operator sessions.
 *
 * What changed in Phase 6A: the cookie used to hold the organisation secret
 * verbatim for eight hours. Anything that obtained it *was* the organisation,
 * for every site it owns, with no way to revoke a single session.
 *
 * It now holds an opaque token, and the secret is sealed at rest with a key
 * derived from that token. The tests below are organised around the three
 * properties that buys, and the fourth section is the limitation that remains —
 * asserted rather than merely written down, because a limitation nobody tests is
 * a limitation nobody notices changing.
 */

beforeEach(resetDatabase);

async function tenant() {
  const org = await createOrganisation(prisma, { name: "Dashboard Co", slug: "dashboard-co" });
  return { organisationId: org.organisation_id, secretKey: org.secret_key };
}

describe("the cookie is not the credential", () => {
  it("stores no plaintext secret anywhere in the row", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    const row = await prisma.dashboardSession.findFirstOrThrow();
    const serialised = JSON.stringify(row);

    expect(serialised).not.toContain(secretKey);
    expect(serialised).not.toContain(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cannot be opened from the database alone", async () => {
    const { organisationId, secretKey } = await tenant();
    await createDashboardSession(prisma, { organisationId, secretKey });

    const row = await prisma.dashboardSession.findFirstOrThrow();

    // Everything an attacker with a full dump has, and a guess at the token.
    const opened = openSecret(generateDashboardSessionToken(), row.id, {
      sealedSecret: row.sealedSecret,
      sealIv: row.sealIv,
      sealTag: row.sealTag,
    });

    expect(opened).toBeNull();
  });

  it("cannot be opened from the cookie alone", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    await prisma.dashboardSession.deleteMany({});

    expect(await resolveDashboardSession(prisma, token)).toBeNull();
  });

  it("returns the secret when the token and the row are both present", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    const resolved = await resolveDashboardSession(prisma, token);

    expect(resolved?.secretKey).toBe(secretKey);
    expect(resolved?.organisationId).toBe(organisationId);
  });
});

describe("sealing", () => {
  it("round-trips through the same token and salt", () => {
    const token = generateDashboardSessionToken();
    const sealed = sealSecret(token, "session-id", "sk_abc123");

    expect(openSecret(token, "session-id", sealed)).toBe("sk_abc123");
  });

  it("will not open with a different salt", () => {
    const token = generateDashboardSessionToken();
    const sealed = sealSecret(token, "session-id", "sk_abc123");

    // The salt is the session id, so a row's ciphertext cannot be lifted into
    // another row and opened with the same token.
    expect(openSecret(token, "another-session-id", sealed)).toBeNull();
  });

  it("detects a tampered ciphertext rather than returning garbage", () => {
    const token = generateDashboardSessionToken();
    const sealed = sealSecret(token, "session-id", "sk_abc123");

    // GCM authenticates. Flipping a byte must fail closed, not decrypt to
    // something that happens to parse.
    const bytes = Buffer.from(sealed.sealedSecret, "base64");
    bytes[0] ^= 0xff;

    expect(
      openSecret(token, "session-id", { ...sealed, sealedSecret: bytes.toString("base64") }),
    ).toBeNull();
  });

  it("produces different ciphertext for the same secret each time", () => {
    const token = generateDashboardSessionToken();
    const a = sealSecret(token, "session-id", "sk_abc123");
    const b = sealSecret(token, "session-id", "sk_abc123");

    expect(a.sealIv).not.toBe(b.sealIv);
    expect(a.sealedSecret).not.toBe(b.sealedSecret);
  });
});

describe("revocation, which the old design had no way to do", () => {
  it("stops a session immediately on sign-out", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    expect(await resolveDashboardSession(prisma, token)).not.toBeNull();
    expect(await revokeDashboardSession(prisma, token)).toBe(true);
    expect(await resolveDashboardSession(prisma, token)).toBeNull();
  });

  it("can revoke every session an organisation has open", async () => {
    const { organisationId, secretKey } = await tenant();
    const first = await createDashboardSession(prisma, { organisationId, secretKey });
    const second = await createDashboardSession(prisma, { organisationId, secretKey });

    expect(await revokeAllDashboardSessions(prisma, organisationId)).toBe(2);
    expect(await resolveDashboardSession(prisma, first.token)).toBeNull();
    expect(await resolveDashboardSession(prisma, second.token)).toBeNull();
  });

  it("does not revoke another organisation's sessions", async () => {
    const a = await tenant();
    const b = await createOrganisation(prisma, { name: "Other Co", slug: "other-co" });

    const mine = await createDashboardSession(prisma, {
      organisationId: a.organisationId,
      secretKey: a.secretKey,
    });
    const theirs = await createDashboardSession(prisma, {
      organisationId: b.organisation_id,
      secretKey: b.secret_key,
    });

    await revokeAllDashboardSessions(prisma, a.organisationId);

    expect(await resolveDashboardSession(prisma, mine.token)).toBeNull();
    expect(await resolveDashboardSession(prisma, theirs.token)).not.toBeNull();
  });

  it("treats a revoked-but-present row as no session", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    await prisma.dashboardSession.updateMany({ data: { revokedAt: new Date() } });

    expect(await resolveDashboardSession(prisma, token)).toBeNull();
  });
});

describe("expiry", () => {
  it("refuses a session past its absolute lifetime", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, {
      organisationId,
      secretKey,
      maxAgeSeconds: -1,
    });

    expect(await resolveDashboardSession(prisma, token)).toBeNull();
  });

  it("refuses a session that has been idle too long", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    const later = new Date(Date.now() + (DASHBOARD_SESSION_IDLE_SECONDS + 60) * 1000);

    // An abandoned tab on a shared machine stops working long before the
    // eight-hour ceiling.
    expect(await resolveDashboardSession(prisma, token, { now: later })).toBeNull();
  });

  it("advances the idle clock when a session is used", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    const halfway = new Date(Date.now() + (DASHBOARD_SESSION_IDLE_SECONDS / 2) * 1000);
    expect(await resolveDashboardSession(prisma, token, { touch: true, now: halfway })).not.toBeNull();

    const laterStill = new Date(halfway.getTime() + (DASHBOARD_SESSION_IDLE_SECONDS - 60) * 1000);
    expect(await resolveDashboardSession(prisma, token, { now: laterStill })).not.toBeNull();
  });

  it("keeps the eight-hour absolute lifetime the cookie had", async () => {
    expect(DASHBOARD_SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(DASHBOARD_SESSION_IDLE_SECONDS).toBeLessThan(DASHBOARD_SESSION_MAX_AGE_SECONDS);
  });
});

describe("rejecting what is not a session", () => {
  it("refuses a token of the wrong shape without touching the database", async () => {
    for (const token of ["", "sk_abcdef", "cs_abcdef", "ds_", "not-a-token"]) {
      expect(await resolveDashboardSession(prisma, token)).toBeNull();
    }
  });

  it("refuses an unknown but well-formed token", async () => {
    const { organisationId, secretKey } = await tenant();
    await createDashboardSession(prisma, { organisationId, secretKey });

    expect(await resolveDashboardSession(prisma, generateDashboardSessionToken())).toBeNull();
  });
});

describe("the limitation that remains", () => {
  it("still hands back one all-or-nothing organisation credential", async () => {
    const { organisationId, secretKey } = await tenant();
    const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

    const resolved = await resolveDashboardSession(prisma, token);

    // This is the honest position, asserted so it cannot be quietly overstated
    // in documentation: a session is a *container* for the organisation secret,
    // not a credential derived from a user. Every session speaks for the whole
    // organisation, and nothing here records who opened it. Real per-user
    // accounts and roles remain out of scope - see docs/security.md.
    expect(resolved?.secretKey).toBe(secretKey);
    expect(Object.keys(resolved ?? {})).not.toContain("userId");
  });
});
