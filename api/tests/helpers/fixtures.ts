import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  createRecipient,
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
  prisma,
  recordConsentDecision,
} from "database";
import type {
  AnalyticsEvent,
  ConsentSessionResponse,
  TransferAuthorisationSummary,
  TransferRecordSummary,
} from "@rift-cmp/shared";
import { CONSENT_SESSION_HEADER } from "@rift-cmp/shared";
import { resetRateLimits } from "@/lib/rate-limit";
import { TEST_SCHEMA } from "../setup/database-url";
import { MockTargetFiduciary } from "./fiduciaries";

const BASE_URL = "http://localhost:3000";

/**
 * Removes every row in a single round trip. Table names are schema-qualified
 * rather than relying on `search_path`, which the connection pooler can carry
 * over from an unrelated session.
 *
 * It also clears the in-process rate limiter. Every test file already calls this
 * in `beforeEach`, and the limiter's pre-authentication bucket is keyed by client
 * address alone — which for a `NextRequest` built in a test is always "unknown".
 * Without the reset, a few hundred tests sharing one fork would eventually trip a
 * limit that has nothing to do with what they are asserting. Tests that are
 * *about* rate limiting drive `checkRateLimit` directly.
 */
export async function resetDatabase() {
  resetRateLimits();
  const tables = [
    "organisations",
    "websites",
    "sessions",
    "events",
    "principals",
    "purposes",
    "policies",
    "policy_versions",
    "notices",
    "notice_purposes",
    "consent_records",
    "consent_sessions",
    "dashboard_sessions",
    "data_recipients",
    "transfer_authorisations",
    "transfer_records",
    "discovered_components",
    "discovered_storage",
    "discovery_violations",
    // Scanner. These cascade from `scans`, which cascades from `websites` and
    // `organisations`, so CASCADE would reach them anyway - listed explicitly
    // to match the rest and so a future non-cascading table is not missed.
    "scans",
    "scan_pages",
    "scan_cookies",
    "scan_scripts",
    "scan_requests",
    "scan_storage",
    "scan_technologies",
  ]
    .map((table) => `"${TEST_SCHEMA}"."${table}"`)
    .join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

export interface Tenant {
  organisationId: string;
  secretKey: string;
}

export interface Site {
  siteId: string;
  publicKey: string;
}

/**
 * Builds the ownership tree this phase is specified against:
 *
 *   Organisation A -> Site A1, Site A2
 *   Organisation B -> Site B1
 *
 * Rows are inserted in one transaction to keep per-test latency down. The real
 * `createOrganisation` / `createWebsite` provisioning helpers are exercised
 * directly by `tenancy-model.test.ts`.
 */
export async function createOwnershipTree(options: { prefix?: string } = {}) {
  // `slug` is unique across the whole table, so a test that needs two
  // independent trees inside one `it` — a cross-tenant attack usually does —
  // passes a prefix. The default is empty, so every existing caller and the
  // assertion on `slug: "org-a"` are untouched.
  const prefix = options.prefix ?? "";

  const organisations = [
    {
      id: randomUUID(),
      name: "Organisation A",
      slug: `${prefix}org-a`,
      secretKey: generateSecretKey(),
    },
    {
      id: randomUUID(),
      name: "Organisation B",
      slug: `${prefix}org-b`,
      secretKey: generateSecretKey(),
    },
  ];

  const sites = [
    { id: randomUUID(), organisationId: organisations[0].id, name: "Site A1", domain: `${prefix}a1.example.com` },
    { id: randomUUID(), organisationId: organisations[0].id, name: "Site A2", domain: `${prefix}a2.example.com` },
    { id: randomUUID(), organisationId: organisations[1].id, name: "Site B1", domain: `${prefix}b1.example.com` },
  ].map((site) => ({ ...site, publicKey: generatePublicKey() }));

  await prisma.$transaction([
    prisma.organisation.createMany({
      data: organisations.map(({ id, name, slug, secretKey }) => ({
        id,
        name,
        slug,
        secretKeyHash: hashSecretKey(secretKey),
      })),
    }),
    prisma.website.createMany({ data: sites }),
  ]);

  const asSite = (site: { id: string; publicKey: string }): Site => ({
    siteId: site.id,
    publicKey: site.publicKey,
  });

  return {
    orgA: { organisationId: organisations[0].id, secretKey: organisations[0].secretKey } satisfies Tenant,
    orgB: { organisationId: organisations[1].id, secretKey: organisations[1].secretKey } satisfies Tenant,
    siteA1: asSite(sites[0]),
    siteA2: asSite(sites[1]),
    siteB1: asSite(sites[2]),
  };
}

/** A schema-valid event. Overrides let each test bend exactly one thing. */
export function buildEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    event_id: randomUUID(),
    site_id: "unset",
    session_id: randomUUID(),
    event_type: "page_view",
    name: "page_view",
    event_time: new Date().toISOString(),
    schema_version: 1,
    source: "rift-cmp-sdk/test",
    payload: {
      page: { url: "https://example.com/pricing", title: "Pricing" },
      device: { type: "desktop", browser: "Chrome", os: "Windows" },
      referrer: null,
      properties: {},
    },
    ...overrides,
  };
}

/** POST to the ingestion endpoint. `key` is sent as a bearer token. */
export function ingestRequest(
  body: unknown,
  options: {
    key?: string;
    queryKey?: string;
    /** Consent session token, for sites that enforce consent server-side. */
    sessionToken?: string;
    /** Browser `Origin`. Omitted by default, as a non-browser caller would. */
    origin?: string;
  } = {},
): NextRequest {
  const url = new URL("/api/v1/events", BASE_URL);
  if (options.queryKey) url.searchParams.set("pk", options.queryKey);

  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.key) headers.set("Authorization", `Bearer ${options.key}`);
  if (options.sessionToken) headers.set(CONSENT_SESSION_HEADER, options.sessionToken);
  if (options.origin) headers.set("Origin", options.origin);

  return new NextRequest(url, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Request against the management plane. `key` is an organisation secret key. */
export function managementRequest(
  pathname: string,
  options: {
    key?: string;
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): NextRequest {
  const url = new URL(pathname, BASE_URL);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(name, value);
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.key) headers.set("Authorization", `Bearer ${options.key}`);

  return new NextRequest(url, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

/** Route context for a dynamic `[siteId]` segment. */
export function siteParams(siteId: string) {
  return { params: Promise.resolve({ siteId }) };
}

// --- Consent domain fixtures -------------------------------------------------

export interface ConsentFixture {
  purposeCode: string;
  secondPurposeCode: string;
  policyId: string;
  policyVersionId: string;
  noticeId: string;
  /** A purpose that exists but is NOT disclosed by the notice above. */
  undisclosedPurposeCode: string;
}

/**
 * Reference data for one organisation: two purposes disclosed by a notice, one
 * purpose deliberately left out of it, and the policy version the notice
 * presents. Enough to exercise every reference the consent API validates.
 *
 * Written in a single transaction with client-generated ids to keep per-test
 * latency down. The real `createPurpose` / `createPolicy` / `createNotice`
 * provisioning helpers are exercised directly by `consent-domain.test.ts`.
 */
export async function createConsentFixture(
  organisationId: string,
  prefix = "",
): Promise<ConsentFixture> {
  const code = (name: string) => `${prefix}${name}`;

  const purposes = [
    { id: randomUUID(), code: code("analytics"), name: "Analytics", description: "Measure how the site is used." },
    { id: randomUUID(), code: code("marketing"), name: "Marketing", description: "Personalised marketing." },
    { id: randomUUID(), code: code("undisclosed"), name: "Undisclosed", description: "A purpose no notice mentions." },
  ];
  const policyId = randomUUID();
  const policyVersionId = randomUUID();
  const noticeId = randomUUID();

  await prisma.$transaction([
    prisma.purpose.createMany({
      data: purposes.map((purpose) => ({ ...purpose, organisationId })),
    }),
    prisma.policy.create({
      data: { id: policyId, organisationId, code: code("privacy-policy"), name: "Privacy Policy" },
    }),
    prisma.policyVersion.create({
      data: {
        id: policyVersionId,
        organisationId,
        policyId,
        version: "1.0.0",
        documentUrl: "https://example.com/privacy/1.0.0",
        contentHash: "sha256:abc123",
      },
    }),
    prisma.notice.create({
      data: { id: noticeId, organisationId, policyVersionId, version: "notice-1", locale: "en" },
    }),
    // The third purpose is deliberately not linked, so a test can prove a notice
    // cannot be cited as cover for a purpose it never disclosed.
    prisma.noticePurpose.createMany({
      data: [
        { noticeId, purposeId: purposes[0].id },
        { noticeId, purposeId: purposes[1].id },
      ],
    }),
  ]);

  return {
    purposeCode: purposes[0].code,
    secondPurposeCode: purposes[1].code,
    undisclosedPurposeCode: purposes[2].code,
    policyId,
    policyVersionId,
    noticeId,
  };
}

/** Request against a site-authenticated (public key) endpoint. */
export function siteRequest(
  pathname: string,
  options: {
    key?: string;
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
    /** Consent session token, required by `POST /api/v1/consent` since 6A. */
    sessionToken?: string;
    /** Browser `Origin`. Omitted by default, as a non-browser caller would. */
    origin?: string;
  } = {},
): NextRequest {
  const url = new URL(pathname, BASE_URL);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(name, value);
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.key) headers.set("Authorization", `Bearer ${options.key}`);
  if (options.sessionToken) headers.set(CONSENT_SESSION_HEADER, options.sessionToken);
  if (options.origin) headers.set("Origin", options.origin);

  return new NextRequest(url, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

// --- Consent sessions (Phase 6A) ---------------------------------------------

export interface OpenedConsentSession {
  sessionToken: string;
  principalExternalId: string;
  principalSecret: string;
}

/**
 * Opens a consent session through the real endpoint.
 *
 * Two shapes, because both are worth exercising:
 *
 *  - no `principalExternalId` — the server mints the principal and its secret,
 *    which is what a first-time browser does;
 *  - a `principalExternalId` — the principal row is created first with no
 *    secret, and the session binds one. This is the trust-on-first-use path, and
 *    it is also what lets the pre-6A tests keep their fixed, readable principal
 *    identifiers instead of asserting against a random UUID.
 */
export async function openConsentSession(
  publicKey: string,
  options: {
    siteId?: string;
    principalExternalId?: string;
    principalSecret?: string;
    origin?: string;
  } = {},
): Promise<OpenedConsentSession> {
  const { POST } = await import("@/app/api/v1/consent/session/route");

  let body: Record<string, string> = {};
  if (options.principalExternalId) {
    if (!options.siteId) {
      throw new Error("openConsentSession: siteId is required with principalExternalId");
    }
    const secret = options.principalSecret ?? `ps_${randomUUID().replace(/-/g, "")}`;
    await prisma.principal.upsert({
      where: {
        siteId_externalId: { siteId: options.siteId, externalId: options.principalExternalId },
      },
      update: {},
      create: { siteId: options.siteId, externalId: options.principalExternalId },
    });
    body = { principal_external_id: options.principalExternalId, principal_secret: secret };
  }

  const response = await POST(
    siteRequest("/api/v1/consent/session", {
      key: publicKey,
      method: "POST",
      body,
      origin: options.origin,
    }),
  );

  if (response.status !== 201) {
    throw new Error(`openConsentSession failed: ${response.status} ${await response.text()}`);
  }

  const parsed = (await response.json()) as ConsentSessionResponse;
  return {
    sessionToken: parsed.session_token,
    principalExternalId: parsed.principal_external_id,
    principalSecret: parsed.principal_secret ?? body.principal_secret ?? "",
  };
}

/** Route context for a dynamic `[policyId]` segment. */
export function policyParams(policyId: string) {
  return { params: Promise.resolve({ policyId }) };
}

// --- Secure transfer fixtures ------------------------------------------------

export interface TransferScenario {
  orgA: Tenant;
  orgB: Tenant;
  siteA1: Site;
  siteA2: Site;
  siteB1: Site;
  consent: ConsentFixture;
  /** The mock target. Its private key exists only inside this object. */
  target: MockTargetFiduciary;
  recipientCode: string;
  /** Shown once at registration; Rift stores only its digest. */
  deliveryKey: string;
  principalExternalId: string;
}

/**
 * A tenant ready to transfer: a registered recipient, and consent in whatever
 * state the test needs.
 *
 * Consent is recorded through the real service so an authorisation is always
 * evaluated against a genuine append-only decision, never a fabricated row.
 * `"none"` records nothing at all, which is materially different from `DENIED`
 * and must be testable separately.
 */
export async function createTransferScenario(
  options: { consent?: "GRANTED" | "DENIED" | "WITHDRAWN" | "none"; prefix?: string } = {},
): Promise<TransferScenario> {
  const tree = await createOwnershipTree({ prefix: options.prefix });
  const consent = await createConsentFixture(tree.orgA.organisationId);
  const principalExternalId = "principal-transfer-1";

  const wanted = options.consent ?? "GRANTED";
  if (wanted !== "none") {
    const decision = await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId,
      purposeCode: consent.purposeCode,
      status: wanted,
      noticeId: consent.noticeId,
      source: "test",
    });
    if (!decision.ok) throw new Error(`transfer fixture failed: ${decision.message}`);
  }

  const target = new MockTargetFiduciary();
  const recipient = await createRecipient(prisma, {
    organisationId: tree.orgA.organisationId,
    code: "partner-bank",
    name: "Partner Bank",
    publicKey: target.publicKey,
  });

  return {
    ...tree,
    consent,
    target,
    recipientCode: recipient.code,
    deliveryKey: recipient.delivery_key,
    principalExternalId,
  };
}

/**
 * Drives consent -> authorisation -> sealed transfer through the real routes.
 *
 * `lifecycle.test.ts` has its own copy that also returns the raw responses,
 * because it asserts on statuses at every step. This one exists for tests that
 * need a *completed* flow as a starting point rather than as the subject -
 * `audit-immutability.test.ts` needs rows in all three tables before it can try
 * to rewrite them.
 */
export async function runTransferFlow(
  scenario: TransferScenario,
  options: { plaintext?: string; submit?: boolean } = {},
): Promise<{
  authorisation: TransferAuthorisationSummary;
  transfer: TransferRecordSummary | null;
}> {
  const { POST: authorise } = await import("@/app/api/v1/authorisations/route");
  const { POST: submitTransfer } = await import("@/app/api/v1/transfers/route");
  const { sealForAuthorisation, submissionBody } = await import("./fiduciaries");

  const authResponse = await authorise(
    managementRequest("/api/v1/authorisations", {
      key: scenario.orgA.secretKey,
      method: "POST",
      body: {
        site_id: scenario.siteA1.siteId,
        principal_external_id: scenario.principalExternalId,
        purpose_code: scenario.consent.purposeCode,
        recipient_code: scenario.recipientCode,
      },
    }),
  );
  if (authResponse.status !== 201) {
    throw new Error(`runTransferFlow: authorise failed ${authResponse.status}`);
  }
  const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;

  if (options.submit === false) {
    return { authorisation, transfer: null };
  }

  const envelope = sealForAuthorisation(authorisation, options.plaintext ?? "test payload");
  const submitted = await submitTransfer(
    managementRequest("/api/v1/transfers", {
      key: scenario.orgA.secretKey,
      method: "POST",
      body: submissionBody(authorisation, envelope),
    }),
  );
  if (submitted.status !== 201) {
    throw new Error(`runTransferFlow: submit failed ${submitted.status}`);
  }

  return { authorisation, transfer: (await submitted.json()) as TransferRecordSummary };
}
