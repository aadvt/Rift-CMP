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
import type { AnalyticsEvent } from "@rift-cmp/shared";
import { TEST_SCHEMA } from "../setup/database-url";
import { MockTargetFiduciary } from "./fiduciaries";

const BASE_URL = "http://localhost:3000";

/**
 * Removes every row in a single round trip. Table names are schema-qualified
 * rather than relying on `search_path`, which the connection pooler can carry
 * over from an unrelated session.
 */
export async function resetDatabase() {
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
    "data_recipients",
    "transfer_authorisations",
    "transfer_records",
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
export async function createOwnershipTree() {
  const organisations = [
    { id: randomUUID(), name: "Organisation A", slug: "org-a", secretKey: generateSecretKey() },
    { id: randomUUID(), name: "Organisation B", slug: "org-b", secretKey: generateSecretKey() },
  ];

  const sites = [
    { id: randomUUID(), organisationId: organisations[0].id, name: "Site A1", domain: "a1.example.com" },
    { id: randomUUID(), organisationId: organisations[0].id, name: "Site A2", domain: "a2.example.com" },
    { id: randomUUID(), organisationId: organisations[1].id, name: "Site B1", domain: "b1.example.com" },
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
  options: { key?: string; queryKey?: string } = {},
): NextRequest {
  const url = new URL("/api/v1/events", BASE_URL);
  if (options.queryKey) url.searchParams.set("pk", options.queryKey);

  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.key) headers.set("Authorization", `Bearer ${options.key}`);

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
 * A tenant that is ready to transfer: consent granted, recipient registered.
 *
 * Consent is recorded through the real service so the transfer is authorised
 * against a genuine append-only decision, not a fabricated row.
 */
export async function createTransferScenario(
  options: { grant?: boolean } = {},
): Promise<TransferScenario> {
  const tree = await createOwnershipTree();
  const consent = await createConsentFixture(tree.orgA.organisationId);
  const principalExternalId = "principal-transfer-1";

  const decision = await recordConsentDecision(prisma, {
    organisationId: tree.orgA.organisationId,
    siteId: tree.siteA1.siteId,
    principalExternalId,
    purposeCode: consent.purposeCode,
    status: options.grant === false ? "DENIED" : "GRANTED",
    noticeId: consent.noticeId,
    source: "test",
  });
  if (!decision.ok) throw new Error(`transfer fixture failed: ${decision.message}`);

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
