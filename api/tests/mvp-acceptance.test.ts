import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createOrganisation, createPolicy, createPurpose, prisma } from "database";
import type {
  AnalyticsSummary,
  AuditResponse,
  ConsentStateResponse,
  PlatformOverview,
  RecipientCreated,
  TransferAuthorisationSummary,
  TransferDelivery,
  TransferRecordSummary,
  WebsiteCreated,
} from "@rift-cmp/shared";
import { POST as ingestEvents } from "@/app/api/v1/events/route";
import { POST as createSite } from "@/app/api/v1/sites/route";
import { POST as createRecipientRoute } from "@/app/api/v1/recipients/route";
import { POST as authorise } from "@/app/api/v1/authorisations/route";
import { POST as submitTransfer } from "@/app/api/v1/transfers/route";
import { GET as collectEnvelope } from "@/app/api/v1/transfers/[transferId]/envelope/route";
import { GET as getEffective } from "@/app/api/v1/consent/effective/route";
import { GET as getHistory } from "@/app/api/v1/consent/history/route";
import { GET as getAudit } from "@/app/api/v1/audit/route";
import { GET as getSummary } from "@/app/api/v1/analytics/summary/route";
import { GET as getOverview } from "@/app/api/v1/analytics/overview/route";
import { POST as recordConsentRoute } from "@/app/api/v1/consent/route";
import { POST as openConsentSessionRoute } from "@/app/api/v1/consent/session/route";
import { managementRequest, resetDatabase, siteRequest } from "./helpers/fixtures";
import { MockTargetFiduciary, sealForAuthorisation, submissionBody } from "./helpers/fiduciaries";
import { ConsentClient } from "../../sdk/src/consent";

/**
 * The MVP acceptance test.
 *
 * One scenario, twelve steps, from registering a site to proving the audit trail
 * survives a withdrawal. It uses the real SDK, the real HTTP handlers and the
 * real cryptography — the only things faked are the browser globals the SDK
 * needs and the mock target fiduciary, which stands in for a system we do not
 * operate.
 *
 * If this passes, the product works end to end.
 */

const PII = "PAN: ABCDE1234F | DOB: 1990-04-17 | Salary: 1,250,000 INR";
const API_ORIGIN = "http://localhost:3000";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

let originalFetch: typeof globalThis.fetch;

/** Routes the SDK's fetch calls straight into the route handlers. */
async function routeToHandler(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString());
  const method = (init?.method ?? "GET").toUpperCase();
  const request = new NextRequest(url, {
    method,
    headers: new Headers(init?.headers as HeadersInit),
    ...(init?.body == null ? {} : { body: init.body as BodyInit }),
  });

  // The SDK opens a consent session before it records anything: the site public
  // key alone has not authorised a write since Phase 6A.
  if (url.pathname === "/api/v1/consent/session") return openConsentSessionRoute(request);
  if (url.pathname === "/api/v1/consent") return recordConsentRoute(request);
  if (url.pathname === "/api/v1/events") return ingestEvents(request);
  throw new Error(`Unrouted request in acceptance test: ${method} ${url.pathname}`);
}

beforeEach(async () => {
  await resetDatabase();
  vi.stubGlobal("window", { localStorage: new MemoryStorage() });
  originalFetch = globalThis.fetch;
  globalThis.fetch = routeToHandler as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
});

function transferParams(transferId: string) {
  return { params: Promise.resolve({ transferId }) };
}

/** An analytics event in the canonical envelope, as the SDK would send it. */
function analyticsEvent(siteId: string, sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    event_id: randomUUID(),
    site_id: siteId,
    session_id: sessionId,
    event_type: "page_view",
    name: "page_view",
    event_time: new Date().toISOString(),
    schema_version: 1,
    source: "rift-cmp-sdk/acceptance",
    payload: {
      page: { url: "https://demo.example.com/pricing", title: "Pricing" },
      device: { type: "desktop", browser: "Chrome", os: "Windows" },
      referrer: null,
      properties: {},
    },
    ...overrides,
  };
}

describe("MVP acceptance", () => {
  it("runs the whole product: register, instrument, consent, authorise, transfer, audit, withdraw, refuse", async () => {
    // ---- 1. Register an organisation (Data Fiduciary) and a website ---------
    const org = await createOrganisation(prisma, { name: "Acceptance Co", slug: "acceptance" });

    const siteResponse = await createSite(
      managementRequest("/api/v1/sites", {
        key: org.secret_key,
        method: "POST",
        body: { name: "Acceptance Site", domain: "demo.example.com" },
      }),
    );
    expect(siteResponse.status).toBe(201);
    const site = (await siteResponse.json()) as WebsiteCreated;
    expect(site.public_key).toMatch(/^pk_/);

    // Reference data the consent domain needs.
    await createPurpose(prisma, {
      organisationId: org.organisation_id,
      code: "analytics",
      name: "Product analytics",
      description: "Understand how visitors use the site.",
    });
    await createPolicy(prisma, {
      organisationId: org.organisation_id,
      code: "privacy-policy",
      name: "Privacy Policy",
      version: "1.0.0",
    });

    // ---- 2 & 3. Use the SDK and generate activity ---------------------------
    // Events go through the real ingestion route with the site's public key,
    // exactly as an installed snippet would send them.
    const sessionId = randomUUID();
    const ingest = await ingestEvents(
      siteRequest("/api/v1/events", {
        key: site.public_key,
        method: "POST",
        body: {
          events: [
            analyticsEvent(site.site_id, sessionId, {
              event_type: "session_start",
              name: "session_start",
            }),
            analyticsEvent(site.site_id, sessionId),
            analyticsEvent(site.site_id, sessionId, {
              event_type: "custom",
              name: "signup_started",
            }),
          ],
        },
      }),
    );
    expect(ingest.status).toBe(202);
    await expect(ingest.json()).resolves.toMatchObject({ accepted: 3, rejected: 0 });

    // ---- 4. A Data Principal records a consent decision, via the SDK --------
    const consentClient = new ConsentClient(site.site_id, site.public_key, { apiUrl: API_ORIGIN });
    await expect(consentClient.grant("analytics")).resolves.toBe(true);

    const principalId = consentClient.getPrincipalId();
    // Minted by the *server* when the session was opened, and stored by the SDK,
    // so narrow it before it is used as a filter.
    if (principalId === null) throw new Error("no principal id was established");
    expect(principalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(consentClient.isGranted("analytics")).toBe(true);

    // ---- 5. A Fiduciary requests an authorised action -----------------------
    const target = new MockTargetFiduciary();
    const recipientResponse = await createRecipientRoute(
      managementRequest("/api/v1/recipients", {
        key: org.secret_key,
        method: "POST",
        body: {
          code: "partner-bank",
          name: "Partner Bank",
          public_key: target.publicKey,
        },
      }),
    );
    const recipient = (await recipientResponse.json()) as RecipientCreated;

    const authResponse = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: org.secret_key,
        method: "POST",
        body: {
          site_id: site.site_id,
          principal_external_id: principalId,
          purpose_code: "analytics",
          recipient_code: "partner-bank",
        },
      }),
    );
    expect(authResponse.status).toBe(201);
    const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;

    // ---- 6 & 7. Perform the secure transfer and record it ------------------
    const envelope = sealForAuthorisation(authorisation, PII);
    const submitted = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: org.secret_key,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );
    expect(submitted.status).toBe(201);
    const transfer = (await submitted.json()) as TransferRecordSummary;

    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${transfer.transfer_id}/envelope`, {
          key: recipient.delivery_key,
        }),
        transferParams(transfer.transfer_id),
      )
    ).json()) as TransferDelivery;

    // Only the target recovers the plaintext.
    expect(target.open(delivery)).toBe(PII);

    // ---- 8. View the resulting activity, as the dashboard does -------------
    // Every screen reads through these endpoints; nothing queries the database.
    const [overviewRes, summaryRes, auditRes, effectiveRes] = await Promise.all([
      getOverview(managementRequest("/api/v1/analytics/overview", { key: org.secret_key })),
      getSummary(managementRequest("/api/v1/analytics/summary", { key: org.secret_key })),
      getAudit(managementRequest("/api/v1/audit", { key: org.secret_key })),
      getEffective(
        managementRequest("/api/v1/consent/effective", {
          key: org.secret_key,
          query: { site_id: site.site_id, principal_external_id: principalId },
        }),
      ),
    ]);

    const overview = (await overviewRes.json()) as PlatformOverview;
    const summary = (await summaryRes.json()) as AnalyticsSummary;
    const audit = (await auditRes.json()) as AuditResponse;
    const effective = (await effectiveRes.json()) as ConsentStateResponse;

    expect(overview.sites.total).toBe(1);
    expect(overview.consent.granted).toBe(1);
    expect(overview.authorisations.consumed).toBe(1);
    expect(overview.transfers.total).toBe(1);
    expect(summary.totals.page_views).toBe(1);
    expect(summary.totals.custom_events).toBe(1);
    expect(summary.top_pages[0]).toMatchObject({ url: "https://demo.example.com/pricing" });
    expect(effective.purposes).toEqual([
      expect.objectContaining({ purpose_code: "analytics", status: "GRANTED" }),
    ]);

    // The timeline tells the whole story in one place.
    expect(audit.entries.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(["consent", "authorisation", "transfer"]),
    );

    // Nothing an operator can see contains the payload.
    for (const body of [overview, summary, audit, effective]) {
      expect(JSON.stringify(body)).not.toContain("ABCDE1234F");
    }

    // ---- 9. The principal withdraws consent, through the SDK ---------------
    await expect(consentClient.withdraw("analytics")).resolves.toBe(true);
    expect(consentClient.isGranted("analytics")).toBe(false);

    // ---- 10 & 11. The same action is attempted again, and refused ----------
    const refused = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: org.secret_key,
        method: "POST",
        body: {
          site_id: site.site_id,
          principal_external_id: principalId,
          purpose_code: "analytics",
          recipient_code: "partner-bank",
        },
      }),
    );

    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "consent_not_granted" },
    });
    // No second authorisation was created.
    expect(await prisma.transferAuthorisation.count()).toBe(1);

    // ---- 12. The audit history remains intact ------------------------------
    const historyRes = await getHistory(
      managementRequest("/api/v1/consent/history", {
        key: org.secret_key,
        query: { principal_external_id: principalId },
      }),
    );
    const history = (await historyRes.json()) as { records: Array<{ status: string }> };

    // Newest first: the withdrawal was appended, the grant was not rewritten.
    expect(history.records.map((record) => record.status)).toEqual(["WITHDRAWN", "GRANTED"]);

    // The completed transfer still stands, still citing the consent that was in
    // force when it happened.
    const storedTransfer = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: transfer.transfer_id },
      include: { authorisation: { include: { consentRecord: true } } },
    });
    expect(storedTransfer.status).toBe("DELIVERED");
    expect(storedTransfer.authorisation.consentRecord.status).toBe("GRANTED");

    // And the audit trail still shows every step after the withdrawal.
    const finalAudit = (await (
      await getAudit(managementRequest("/api/v1/audit", { key: org.secret_key }))
    ).json()) as AuditResponse;

    const kinds = finalAudit.entries.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === "consent")).toHaveLength(2);
    expect(kinds).toContain("authorisation");
    expect(kinds).toContain("transfer");
  });
});
