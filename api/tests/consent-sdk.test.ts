import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "database";
// Imported from source so the test exercises the SDK as written, not a stale bundle.
import { ConsentClient } from "../../sdk/src/consent";
import { GET as getConsent, POST as recordConsent } from "@/app/api/v1/consent/route";
import { POST as openConsentSessionRoute } from "@/app/api/v1/consent/session/route";
import { createConsentFixture, createOwnershipTree, resetDatabase } from "./helpers/fixtures";

/**
 * End-to-end test of the SDK talking to the consent API.
 *
 * `fetch` is routed straight into the route handlers rather than over a socket:
 * this exercises the real request building, real serialisation and the real
 * handlers, without needing a server. The browser globals the SDK depends on
 * (`window.localStorage`) are stubbed with an in-memory equivalent.
 */

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

let storage: MemoryStorage;
let originalFetch: typeof globalThis.fetch;

/** Dispatches a fetch call to the matching route handler. */
async function routeToHandler(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString());
  const method = (init?.method ?? "GET").toUpperCase();

  const request = new NextRequest(url, {
    method,
    headers: new Headers(init?.headers as HeadersInit),
    ...(init?.body === undefined || init?.body === null
      ? {}
      : { body: init.body as BodyInit }),
  });

  // Phase 6A: the SDK opens a session first, because the site public key alone
  // no longer authorises recording a decision.
  if (url.pathname === "/api/v1/consent/session") {
    return openConsentSessionRoute(request);
  }

  if (url.pathname === "/api/v1/consent") {
    return method === "POST" ? recordConsent(request) : getConsent(request);
  }

  throw new Error(`Unrouted request in test: ${method} ${url.pathname}`);
}

beforeEach(async () => {
  await resetDatabase();

  storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage });

  originalFetch = globalThis.fetch;
  globalThis.fetch = routeToHandler as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
});

async function setup() {
  const tree = await createOwnershipTree();
  const consent = await createConsentFixture(tree.orgA.organisationId);
  const client = new ConsentClient(tree.siteA1.siteId, tree.siteA1.publicKey, {
    apiUrl: "http://localhost:3000",
  });
  return { ...tree, consent, client };
}

describe("SDK to API consent communication", () => {
  it("records a grant and reflects it in the returned state", async () => {
    const { client, consent, siteA1 } = await setup();

    await expect(client.grant(consent.purposeCode)).resolves.toBe(true);

    expect(client.isGranted(consent.purposeCode)).toBe(true);

    const stored = await prisma.consentRecord.findFirstOrThrow({
      include: { purpose: true, principal: true },
    });
    expect(stored.status).toBe("GRANTED");
    expect(stored.siteId).toBe(siteA1.siteId);
    expect(stored.source).toBe("sdk");
    expect(stored.purpose.code).toBe(consent.purposeCode);
  });

  it("adopts the server-minted anonymous principal id and reuses it across decisions", async () => {
    const { client, consent } = await setup();

    await client.grant(consent.purposeCode);
    // Minted by the server when the session was opened, not by the browser:
    // a client that chose its own identifier could choose somebody else's.
    const principalId = client.getPrincipalId();
    expect(principalId).toMatch(/^[0-9a-f-]{36}$/);

    await client.deny(consent.secondPurposeCode);
    expect(client.getPrincipalId()).toBe(principalId);
    expect(await prisma.principal.count()).toBe(1);
  });

  it("keeps the principal id separate from the analytics session id", async () => {
    const { client, consent } = await setup();
    await client.grant(consent.purposeCode);

    expect(storage.getItem("rift_cmp_principal_id")).toBe(client.getPrincipalId());
    // The session id lives in sessionStorage and is not touched here.
    expect(storage.getItem("rift_cmp_session_id")).toBeNull();
  });

  it("walks GRANTED then WITHDRAWN and ends not granted, with both records kept", async () => {
    const { client, consent } = await setup();

    await client.grant(consent.purposeCode);
    expect(client.isGranted(consent.purposeCode)).toBe(true);

    await client.withdraw(consent.purposeCode);
    expect(client.isGranted(consent.purposeCode)).toBe(false);

    expect(await prisma.consentRecord.count()).toBe(2);
    const state = await client.getState();
    expect(state).toEqual([
      expect.objectContaining({ purpose_code: consent.purposeCode, status: "WITHDRAWN" }),
    ]);
  });

  it("reads state back from the API for an existing principal", async () => {
    const { client, consent, siteA1 } = await setup();
    await client.grant(consent.purposeCode);
    const principalId = client.getPrincipalId();

    // A fresh client on the same browser storage sees the same decisions.
    const reopened = new ConsentClient(siteA1.siteId, siteA1.publicKey, {
      apiUrl: "http://localhost:3000",
    });
    expect(reopened.getPrincipalId()).toBe(principalId);

    const state = await reopened.getState();
    expect(state).toEqual([
      expect.objectContaining({ purpose_code: consent.purposeCode, status: "GRANTED" }),
    ]);
  });

  it("serves the cached decision synchronously before any network call", async () => {
    const { client, consent, siteA1 } = await setup();
    await client.grant(consent.purposeCode);

    // Simulates a later page load: new client, same localStorage, no await.
    const reopened = new ConsentClient(siteA1.siteId, siteA1.publicKey, {
      apiUrl: "http://localhost:3000",
    });
    expect(reopened.isGranted(consent.purposeCode)).toBe(true);
  });

  it("notifies onChange subscribers so a banner can react without SDK coupling", async () => {
    const { client, consent } = await setup();
    const seen: string[] = [];

    const unsubscribe = client.onChange((state) => {
      const entry = state.find((item) => item.purpose_code === consent.purposeCode);
      if (entry) seen.push(entry.status);
    });

    await client.grant(consent.purposeCode);
    await client.withdraw(consent.purposeCode);

    unsubscribe();
    await client.grant(consent.purposeCode);

    expect(seen).toEqual(["GRANTED", "WITHDRAWN"]);
  });

  it("records the notice that was shown", async () => {
    const { client, consent } = await setup();

    await client.grant(consent.purposeCode, { noticeId: consent.noticeId });

    const stored = await prisma.consentRecord.findFirstOrThrow();
    expect(stored.noticeId).toBe(consent.noticeId);
    expect(stored.policyVersionId).toBe(consent.policyVersionId);
  });

  it("reports failure without throwing when the purpose does not exist", async () => {
    const { client } = await setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(client.record("no-such-purpose", "GRANTED")).resolves.toBe(false);

    expect(await prisma.consentRecord.count()).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports failure without throwing when the key is not valid", async () => {
    const { consent, siteA1 } = await setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const rogue = new ConsentClient(siteA1.siteId, "pk_not_a_real_key", {
      apiUrl: "http://localhost:3000",
    });

    await expect(rogue.grant(consent.purposeCode)).resolves.toBe(false);
    expect(await prisma.consentRecord.count()).toBe(0);
    warn.mockRestore();
  });

  it("survives localStorage being unavailable", async () => {
    const { consent, siteA1 } = await setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("localStorage is disabled");
      },
    });

    const client = new ConsentClient(siteA1.siteId, siteA1.publicKey, {
      apiUrl: "http://localhost:3000",
    });

    // Still records: the decision reaches the server even with no local cache.
    await expect(client.grant(consent.purposeCode)).resolves.toBe(true);
    expect(await prisma.consentRecord.count()).toBe(1);
    warn.mockRestore();
  });

  it("opens a consent session and stores the secret that binds this browser", async () => {
    const { client, consent } = await setup();

    await client.grant(consent.purposeCode);

    // The server minted both halves; the SDK kept them. Without the secret this
    // browser could not open another session for the same principal, and
    // without the session it could not have recorded anything at all.
    expect(storage.getItem("rift_cmp_principal_secret")).toMatch(/^ps_[0-9a-f]{64}$/);
    expect(client.getSessionToken()).toMatch(/^cs_/);

    const stored = await prisma.principal.findFirstOrThrow();
    expect(stored.secretHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("renews an expired session rather than failing the decision", async () => {
    const { client, consent } = await setup();
    await client.grant(consent.purposeCode);

    // A person can leave a banner on screen for longer than a session lasts.
    // Making them click twice would be a bug, not a security property.
    await prisma.consentSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(client.withdraw(consent.purposeCode)).resolves.toBe(true);
    expect(await prisma.consentRecord.count()).toBe(2);
    expect(await prisma.principal.count()).toBe(1);
  });

  it("starts a new principal when the stored identity is no longer accepted", async () => {
    const { client, consent, siteA1 } = await setup();
    await client.grant(consent.purposeCode);
    const first = client.getPrincipalId();

    // Simulates a browser carrying an identifier the server will not honour —
    // a secret that no longer matches, or a principal that has been removed.
    await prisma.principal.updateMany({ data: { secretHash: "0".repeat(64) } });

    const reopened = new ConsentClient(siteA1.siteId, siteA1.publicKey, {
      apiUrl: "http://localhost:3000",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(reopened.grant(consent.purposeCode)).resolves.toBe(true);

    // Degrading to a fresh principal is the right failure: the alternative is a
    // browser that can never record a decision again.
    expect(reopened.getPrincipalId()).not.toBe(first);
    expect(await prisma.principal.count()).toBe(2);
    warn.mockRestore();
  });

  it("does not mint a principal merely to read state", async () => {
    const { client } = await setup();

    await expect(client.getState()).resolves.toEqual([]);

    // Creating an identity for a visitor who has decided nothing would
    // manufacture exactly the durable identifier this product exists without.
    expect(client.getPrincipalId()).toBeNull();
    expect(await prisma.principal.count()).toBe(0);
    expect(await prisma.consentSession.count()).toBe(0);
  });

  it("clear() forgets local identity without touching the server-side trail", async () => {
    const { client, consent } = await setup();
    await client.grant(consent.purposeCode);

    client.clear();

    expect(client.getPrincipalId()).toBeNull();
    expect(client.getSessionToken()).toBeNull();
    expect(storage.getItem("rift_cmp_principal_secret")).toBeNull();
    expect(client.isGranted(consent.purposeCode)).toBe(false);
    // The audit trail is append-only and unaffected by a local reset.
    expect(await prisma.consentRecord.count()).toBe(1);
  });
});
