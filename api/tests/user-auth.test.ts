/**
 * Signing in as a person, and what that is allowed to become.
 *
 * Two credential systems now exist and the whole design rests on them staying
 * apart: a password says which human is asking, a key says which organisation a
 * request represents. Most of what is checked here is that the boundary between
 * them holds — a session must be usable where a key is, must be revocable in a
 * way a key is not, and must never widen what its organisation can see.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, hashPassword, prisma, verifyPassword } from "database";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { GET as listSites } from "@/app/api/v1/sites/route";
import { createOwnershipTree, managementRequest, resetDatabase } from "./helpers/fixtures";

const PASSWORD = "correct-horse-battery-staple";

let orgAId: string;
let orgBSecret: string;

beforeEach(async () => {
  await resetDatabase();
  const tree = await createOwnershipTree({ prefix: "auth-" });
  orgAId = tree.orgA.organisationId;
  orgBSecret = tree.orgB.secretKey;
  await createUser(prisma, {
    email: "Owner@Example.com",
    password: PASSWORD,
    organisationId: orgAId,
  });
});

function loginRequest(body: unknown) {
  return managementRequest("/api/v1/auth/login", { method: "POST", body });
}

async function signIn(email = "owner@example.com", password = PASSWORD) {
  const response = await login(loginRequest({ email, password }));
  return { response, body: response.status === 201 ? await response.json() : null };
}

describe("password storage", () => {
  it("never stores the password itself", async () => {
    const row = await prisma.user.findFirstOrThrow({ select: { passwordHash: true } });

    expect(row.passwordHash).not.toContain(PASSWORD);
    // scrypt, not the SHA-256 used for `sk_` keys. A fast digest over a phrase a
    // person chose is a wordlist away from being no protection at all.
    expect(row.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("produces a different hash for the same password twice", async () => {
    // Per-password salt: without it, two people who chose the same password are
    // visibly the same row, and one crack does both.
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("verifies the right password and refuses the wrong one", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword(`${PASSWORD} `, stored)).toBe(false);
  });

  it("treats a corrupt stored hash as a failed sign-in, not a crash", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
    expect(await verifyPassword(PASSWORD, "")).toBe(false);
  });
});

describe("signing in", () => {
  it("accepts the right password and returns a session, not a key", async () => {
    const { response, body } = await signIn();

    expect(response.status).toBe(201);
    expect(body.session_token.startsWith("ds_")).toBe(true);
    // The organisation key must never travel to a browser. It also could not:
    // only its digest is stored.
    expect(JSON.stringify(body)).not.toContain("sk_");
  });

  it("matches the address regardless of case", async () => {
    const { response } = await signIn("OWNER@EXAMPLE.COM");
    expect(response.status).toBe(201);
  });

  it("answers a wrong password and an unknown address identically", async () => {
    // Any difference here — status, code, or wording — reports which addresses
    // have accounts, which is the first thing a credential-stuffing run wants.
    const wrong = await login(loginRequest({ email: "owner@example.com", password: "nope" }));
    const unknown = await login(loginRequest({ email: "nobody@example.com", password: "nope" }));

    expect(wrong.status).toBe(unknown.status);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("rejects a body that is not an email and a password", async () => {
    expect((await login(loginRequest({ email: "owner@example.com" }))).status).toBe(400);
  });
});

describe("a session as a management credential", () => {
  it("reads the organisation it belongs to", async () => {
    const { body } = await signIn();

    const response = await listSites(
      managementRequest("/api/v1/sites", { key: body.session_token }),
    );
    expect(response.status).toBe(200);
  });

  it("reports the person behind it, which a key cannot", async () => {
    const { body } = await signIn();

    const asUser = await me(managementRequest("/api/v1/auth/me", { key: body.session_token }));
    await expect(asUser.json()).resolves.toMatchObject({
      user: { email: "owner@example.com", role: "owner" },
    });

    // The same endpoint under an organisation key: same organisation, no person.
    const asKey = await me(managementRequest("/api/v1/auth/me", { key: orgBSecret }));
    await expect(asKey.json()).resolves.toMatchObject({ user: null });
  });

  it("sees only its own organisation", async () => {
    const { body } = await signIn();

    const mine = await listSites(managementRequest("/api/v1/sites", { key: body.session_token }));
    const theirs = await listSites(managementRequest("/api/v1/sites", { key: orgBSecret }));

    const mineIds = (await mine.json()).sites.map((s: { site_id: string }) => s.site_id);
    const theirIds = (await theirs.json()).sites.map((s: { site_id: string }) => s.site_id);

    expect(mineIds.length).toBeGreaterThan(0);
    expect(theirIds.length).toBeGreaterThan(0);
    expect(mineIds.some((id: string) => theirIds.includes(id))).toBe(false);
  });

  it("refuses a token that was never issued", async () => {
    const forged = `ds_${"A".repeat(43)}`;
    const response = await listSites(managementRequest("/api/v1/sites", { key: forged }));
    expect(response.status).toBe(401);
  });
});

describe("signing out", () => {
  it("revokes the session server-side, not just in the browser", async () => {
    const { body } = await signIn();

    const before = await listSites(managementRequest("/api/v1/sites", { key: body.session_token }));
    expect(before.status).toBe(200);

    await logout(managementRequest("/api/v1/auth/logout", { method: "POST", key: body.session_token }));

    // The point of a server-side session: a stolen cookie stops working when the
    // person signs out, which a static key never would.
    const after = await listSites(managementRequest("/api/v1/sites", { key: body.session_token }));
    expect(after.status).toBe(401);
  });

  it("answers the same whether or not the token existed", async () => {
    const real = await signIn();
    const known = await logout(
      managementRequest("/api/v1/auth/logout", { method: "POST", key: real.body.session_token }),
    );
    const unknown = await logout(
      managementRequest("/api/v1/auth/logout", { method: "POST", key: `ds_${"B".repeat(43)}` }),
    );

    expect(known.status).toBe(204);
    expect(unknown.status).toBe(204);
  });
});

describe("the key planes are unchanged", () => {
  it("still accepts an organisation secret key", async () => {
    const response = await listSites(managementRequest("/api/v1/sites", { key: orgBSecret }));
    expect(response.status).toBe(200);
  });

  it("still refuses a site public key", async () => {
    // `pk_` ships in page source. A browser-readable credential reaching the
    // management plane would expose every site in the organisation.
    const site = await prisma.website.findFirstOrThrow({ select: { publicKey: true } });
    const response = await listSites(managementRequest("/api/v1/sites", { key: site.publicKey }));
    expect(response.status).toBe(401);
  });
});
