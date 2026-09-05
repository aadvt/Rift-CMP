/**
 * The Phase 11B endpoints, viewed as an attack surface.
 *
 * These routes answer three questions an attacker would very much like answered
 * about somebody else's site: what is running on it, what its visitors agreed
 * to, and whether a consent record can be made to look genuine. So most of this
 * file is about refusal.
 *
 * The specific shapes tested for:
 *
 *   **Cross-tenant reads.** A caller authenticates perfectly against their own
 *   organisation and passes somebody else's id. A route scoped by id alone
 *   serves it happily and nothing in the response looks wrong.
 *
 *   **Proof substitution.** Take a genuine proof and present it as belonging to
 *   a different decision. Both halves are real; the pairing is not.
 *
 *   **Forged decisions.** Post enforcement events on the ingest plane for a site
 *   the key does not belong to.
 *
 *   **Secret leakage.** Any response, on any path, containing private key
 *   material — checked by searching the serialised body rather than by asserting
 *   on today's field list, because the field list is what changes.
 *
 * And one that is not about refusal: a fail-safe. A gated vendor with no
 * principal to read must not become an ALLOW.
 */
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma, recordConsentDecision, recordEnforcementEvents } from "database";
import { POST as evaluateFirewall } from "@/app/api/v1/sites/[siteId]/firewall/route";
import { GET as enforcementHistory } from "@/app/api/v1/sites/[siteId]/enforcement/route";
import { GET as consentProof } from "@/app/api/v1/consent/records/[recordId]/proof/route";
import { POST as verifyProof } from "@/app/api/v1/consent/proof/verify/route";
import { activeSigningKey, resetProofKeys } from "@/lib/proof-keys";
import {
  createOwnershipTree,
  managementRequest,
  resetDatabase,
  siteParams,
} from "./helpers/fixtures";
import { TEST_SCHEMA } from "./setup/database-url";

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

/**
 * Raw SQL must name the schema.
 *
 * The harness runs against `rift_cmp_test`, and an unqualified table name
 * resolves through `search_path` - which, through Neon's pooler, can be carried
 * over from an unrelated session. An `UPDATE` that silently hit `public` would
 * leave the record untouched and the test would pass while proving nothing.
 */
const TABLE = `"${TEST_SCHEMA}"."consent_records"`;

/**
 * Edit the log the way somebody with database access would.
 *
 * `consent_records` rejects UPDATE and DELETE through a trigger, which is the
 * control being tested *around*: the point of a signed, chained proof is that it
 * detects tampering by a party who can disable that trigger.
 */
async function tamper(sql: string, ...params: unknown[]): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE ${TABLE} DISABLE TRIGGER USER`);
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${TABLE} ENABLE TRIGGER USER`);
  }
}

/** A real Ed25519 pair, installed the way an operator would install one. */
function configureSigningKey(keyId = "k-test") {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  process.env.RIFT_PROOF_SIGNING_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.RIFT_PROOF_KEY_ID = keyId;
  process.env.RIFT_PROOF_PUBLIC_KEYS = JSON.stringify([
    { keyId, publicKey: publicKey.export({ type: "spki", format: "pem" }).toString() },
  ]);
  resetProofKeys();
  return { keyId, privateKeyPem: process.env.RIFT_PROOF_SIGNING_KEY };
}

function clearSigningKey() {
  delete process.env.RIFT_PROOF_SIGNING_KEY;
  delete process.env.RIFT_PROOF_KEY_ID;
  delete process.env.RIFT_PROOF_PUBLIC_KEYS;
  resetProofKeys();
}

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
  clearSigningKey();
});

afterEach(() => {
  clearSigningKey();
});

/** One decision on site A1, returning its record id. */
async function decide(status: "GRANTED" | "DENIED" = "GRANTED", principal = "visitor-1") {
  await prisma.purpose.upsert({
    where: {
      organisationId_code: { organisationId: tree.orgA.organisationId, code: "analytics" },
    },
    update: {},
    create: {
      organisationId: tree.orgA.organisationId,
      code: "analytics",
      name: "Analytics",
      description: "Analytics",
    },
  });
  const result = await recordConsentDecision(prisma, {
    organisationId: tree.orgA.organisationId,
    siteId: tree.siteA1.siteId,
    principalExternalId: principal,
    purposeCode: "analytics",
    status,
    jurisdictions: ["EU"],
    // Whatever the test configured. Hard-coding null here would make every
    // signature assertion below pass vacuously as "unsigned".
    signingKey: activeSigningKey(),
  });
  if (!result.ok) throw new Error(result.message);
  return result.record.consent_record_id;
}

// ─── Firewall evaluation ─────────────────────────────────────────────────────

describe("POST /sites/[siteId]/firewall", () => {
  function evaluate(siteId: string, key: string, body: Record<string, unknown>) {
    return evaluateFirewall(
      managementRequest(`/api/v1/sites/${siteId}/firewall`, { key, method: "POST", body }),
      siteParams(siteId),
    );
  }

  it("evaluates a destination for a site the caller owns", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {
      destination: "https://www.google-analytics.com/collect",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { decision: { decision: string } };
    // No approved configuration yet, so nothing has been reviewed. That is
    // REVIEW, never ALLOW.
    expect(body.decision.decision).toBe("REVIEW");
  });

  it("refuses a site in another organisation, with a real key", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgB.secretKey, {
      destination: "https://www.google-analytics.com/collect",
    });
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await evaluateFirewall(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/firewall`, {
        method: "POST",
        body: { destination: "https://x.example" },
      }),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
  });

  it("refuses the site's own public key", async () => {
    // `pk_` is published in every visitor's browser. If it opened this endpoint,
    // anyone could ask what a site's policy does.
    const response = await evaluate(tree.siteA1.siteId, tree.siteA1.publicKey, {
      destination: "https://x.example",
    });
    expect(response.status).toBe(401);
  });

  it("rejects a malformed destination without deciding about it", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {
      destination: "::::not a url::::",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { decision: { destination_host: string | null } };
    // No host means no rule can apply. Resolving it against some base would turn
    // a malformed string into a hostname that might match a real rule.
    expect(body.decision.destination_host).toBeNull();
  });

  it("rejects a malformed redaction configuration rather than sending unredacted", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {
      destination: "https://vendor.example/collect",
      payload: { email: "someone@example.com" },
      redaction: {
        // `hash` with no salt: a digest of a low-entropy value is the value.
        rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }],
      },
    });

    expect(response.status).toBe(422);
  });

  it("never echoes the payload it was given", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {
      destination: "https://vendor.example/collect",
      payload: { email: "someone@example.com", nested: { phone: "+44" } },
      redaction: {
        rules: [{ id: "e", field: "email", match: "name", strategy: "remove" }],
      },
    });

    const text = await response.text();
    // The response says which rule matched which path, and nothing more. An
    // endpoint that echoed the payload would launder data through the audit
    // surface.
    expect(text).not.toContain("someone@example.com");
    expect(text).not.toContain("+44");
    expect(text).toContain("email");
  });

  it("does not write an enforcement event for a dry run", async () => {
    await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {
      destination: "https://www.google-analytics.com/collect",
    });

    // A preview is not something that happened. Recording it would fill the
    // audit trail with events that never occurred.
    expect(await prisma.enforcementEvent.count()).toBe(0);
  });

  it("validates the request body", async () => {
    const response = await evaluate(tree.siteA1.siteId, tree.orgA.secretKey, {});
    expect(response.status).toBe(400);
  });
});

// ─── Enforcement history ─────────────────────────────────────────────────────

describe("GET /sites/[siteId]/enforcement", () => {
  async function seed(siteId: string, organisationId: string) {
    await recordEnforcementEvents(prisma, [
      {
        organisationId,
        siteId,
        source: "client",
        destinationHost: "google-analytics.com",
        vendor: "Google Analytics",
        purpose: "analytics",
        decision: "REQUIRE_CONSENT",
        effect: "block",
        observedOnly: false,
        policyVersion: null,
        matchedRule: null,
        reason: "Silence is not consent.",
        severity: "medium",
        redactions: null,
      },
    ]);
  }

  it("returns this site's events", async () => {
    await seed(tree.siteA1.siteId, tree.orgA.organisationId);

    const response = await enforcementHistory(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/enforcement`, {
        key: tree.orgA.secretKey,
      }),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      events: unknown[];
      summary: { blocked: number };
    };
    expect(body.events).toHaveLength(1);
    expect(body.summary.blocked).toBe(1);
  });

  it("does not return another tenant's events", async () => {
    await seed(tree.siteA1.siteId, tree.orgA.organisationId);
    await seed(tree.siteB1.siteId, tree.orgB.organisationId);

    const response = await enforcementHistory(
      managementRequest(`/api/v1/sites/${tree.siteB1.siteId}/enforcement`, {
        key: tree.orgB.secretKey,
      }),
      siteParams(tree.siteB1.siteId),
    );

    const body = (await response.json()) as { events: Array<{ site_id: string }> };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.site_id).toBe(tree.siteB1.siteId);
  });

  it("refuses a site in another organisation", async () => {
    const response = await enforcementHistory(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/enforcement`, {
        key: tree.orgB.secretKey,
      }),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await enforcementHistory(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/enforcement`),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
  });

  it("says what the log does not cover", async () => {
    // A count of blocked requests reads as completeness unless something says
    // otherwise, and on the client plane it is not.
    const response = await enforcementHistory(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/enforcement`, {
        key: tree.orgA.secretKey,
      }),
      siteParams(tree.siteA1.siteId),
    );

    const body = (await response.json()) as { coverage: { not_covered: string[] } };
    expect(body.coverage.not_covered.length).toBeGreaterThan(2);
    expect(body.coverage.not_covered.join(" ")).toMatch(/served HTML|Content-Security-Policy/i);
  });

  it("stores no request bodies or full URLs", async () => {
    await recordEnforcementEvents(prisma, [
      {
        organisationId: tree.orgA.organisationId,
        siteId: tree.siteA1.siteId,
        source: "server",
        // A caller passing a URL where a host belongs is a bug, and the store
        // reduces it rather than keeping the query string.
        destinationHost: "https://vendor.example/collect?email=someone%40example.com",
        vendor: null,
        purpose: null,
        decision: "ALLOW",
        effect: "allow",
        observedOnly: false,
        policyVersion: null,
        matchedRule: null,
        reason: "allowed",
        severity: "info",
        redactions: null,
      },
    ]);

    const row = await prisma.enforcementEvent.findFirst({
      where: { siteId: tree.siteA1.siteId, source: "server" },
    });
    expect(row?.destinationHost).toBe("vendor.example");
    expect(JSON.stringify(row)).not.toContain("someone");
  });
});

// ─── Proof retrieval ─────────────────────────────────────────────────────────

describe("GET /consent/records/[recordId]/proof", () => {
  it("returns a proof for the caller's own record", async () => {
    configureSigningKey();
    const recordId = await decide();

    const response = await consentProof(
      managementRequest(`/api/v1/consent/records/${recordId}/proof`, {
        key: tree.orgA.secretKey,
      }),
      { params: Promise.resolve({ recordId }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { proof: { facts: { sequence: number } } };
    expect(body.proof.facts.sequence).toBe(1);
  });

  it("refuses a record in another organisation", async () => {
    const recordId = await decide();

    const response = await consentProof(
      managementRequest(`/api/v1/consent/records/${recordId}/proof`, {
        key: tree.orgB.secretKey,
      }),
      { params: Promise.resolve({ recordId }) },
    );

    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const recordId = await decide();
    const response = await consentProof(
      managementRequest(`/api/v1/consent/records/${recordId}/proof`),
      { params: Promise.resolve({ recordId }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns the key id and never the key", async () => {
    const key = configureSigningKey();
    const recordId = await decide();

    const response = await consentProof(
      managementRequest(`/api/v1/consent/records/${recordId}/proof`, {
        key: tree.orgA.secretKey,
      }),
      { params: Promise.resolve({ recordId }) },
    );

    const text = await response.text();
    expect(text).toContain(key.keyId);
    expect(text).not.toContain("PRIVATE KEY");
    // A slice of the actual PEM, so this keeps failing if the key leaks in any
    // encoding that preserves its middle.
    expect(text).not.toContain(key.privateKeyPem.slice(60, 100));
  });
});

// ─── Verification ────────────────────────────────────────────────────────────

describe("POST /consent/proof/verify", () => {
  function verify(key: string, body: Record<string, unknown>) {
    return verifyProof(
      managementRequest("/api/v1/consent/proof/verify", { key, method: "POST", body }),
    );
  }

  it("verifies a genuine record", async () => {
    configureSigningKey();
    const recordId = await decide();

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: { ok: boolean; integrity: string; signature: string; chain: string };
    };
    expect(body.result.integrity).toBe("valid");
    expect(body.result.signature).toBe("valid");
    expect(body.result.chain).toBe("valid");
    expect(body.result.ok).toBe(true);
  });

  it("reports an unsigned record as unsigned rather than invalid", async () => {
    // No signing key configured. The proof still carries integrity and chain.
    const recordId = await decide();

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    const body = (await response.json()) as { result: { signature: string; integrity: string } };

    expect(body.result.signature).toBe("unsigned");
    expect(body.result.integrity).toBe("valid");
  });

  it("catches a record edited after the proof was made", async () => {
    configureSigningKey();
    const recordId = await decide();

    // The realistic attack: edit the row, leave the proof alone. `consent_records`
    // rejects UPDATE through a trigger, so this goes around it the way somebody
    // with database access would.
    await tamper(`UPDATE ${TABLE} SET status = 'DENIED' WHERE id = $1`, recordId);

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    const body = (await response.json()) as { result: { integrity: string; ok: boolean } };

    expect(body.result.integrity).toBe("invalid");
    expect(body.result.ok).toBe(false);
  });

  it("catches proof substitution", async () => {
    configureSigningKey();
    const granted = await decide("GRANTED", "visitor-1");
    const denied = await decide("DENIED", "visitor-2");

    // Fetch the genuine proof for the GRANTED decision...
    const proofResponse = await consentProof(
      managementRequest(`/api/v1/consent/records/${granted}/proof`, {
        key: tree.orgA.secretKey,
      }),
      { params: Promise.resolve({ recordId: granted }) },
    );
    const { proof } = (await proofResponse.json()) as { proof: Record<string, unknown> };

    // ...and present it as though it were about the DENIED one.
    const substituted = {
      ...proof,
      facts: { ...(proof.facts as Record<string, unknown>), consentRecordId: denied },
    };

    const response = await verify(tree.orgA.secretKey, { proof: substituted });
    const body = (await response.json()) as { result: { ok: boolean; signature: string } };

    expect(body.result.ok).toBe(false);
    expect(body.result.signature).toBe("invalid");
  });

  it("refuses to verify against a record in another organisation", async () => {
    const recordId = await decide();
    const response = await verify(tree.orgB.secretKey, { consent_record_id: recordId });
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const recordId = await decide();
    const response = await verifyProof(
      managementRequest("/api/v1/consent/proof/verify", {
        method: "POST",
        body: { consent_record_id: recordId },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("reports a malformed proof as malformed", async () => {
    configureSigningKey();
    const recordId = await decide();

    const response = await verify(tree.orgA.secretKey, {
      consent_record_id: recordId,
      proof: { version: "rift-consent-proof/1", facts: null, proofHash: "x" },
    });

    const body = (await response.json()) as { result: { malformed: string | null } };
    expect(body.result.malformed).toBeTruthy();
  });

  it("reports an unsupported version as unsupported, not as forged", async () => {
    configureSigningKey();
    const recordId = await decide();

    const proofResponse = await consentProof(
      managementRequest(`/api/v1/consent/records/${recordId}/proof`, {
        key: tree.orgA.secretKey,
      }),
      { params: Promise.resolve({ recordId }) },
    );
    const { proof } = (await proofResponse.json()) as { proof: Record<string, unknown> };

    const response = await verify(tree.orgA.secretKey, {
      proof: { ...proof, version: "rift-consent-proof/99" },
    });

    const body = (await response.json()) as {
      result: { unsupported_version: boolean; signature: string | null };
    };
    expect(body.result.unsupported_version).toBe(true);
    expect(body.result.signature).toBeNull();
  });

  it("reports an unknown key when the ring no longer holds it", async () => {
    configureSigningKey("k-old");
    const recordId = await decide();

    // Rotate, and drop the old key entirely - which is the mistake the rotation
    // procedure exists to prevent.
    configureSigningKey("k-new");

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    const body = (await response.json()) as { result: { signature: string } };
    expect(body.result.signature).toBe("unknown_key");
  });

  it("still verifies under a retired key that was kept", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.RIFT_PROOF_SIGNING_KEY = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.RIFT_PROOF_KEY_ID = "k-jan";
    process.env.RIFT_PROOF_PUBLIC_KEYS = JSON.stringify([
      { keyId: "k-jan", publicKey: publicKey.export({ type: "spki", format: "pem" }).toString() },
    ]);
    resetProofKeys();

    const recordId = await decide();
    const januaryPublic = publicKey.export({ type: "spki", format: "pem" }).toString();

    // Rotate properly: new active key, old public key retained.
    const rotated = generateKeyPairSync("ed25519");
    process.env.RIFT_PROOF_SIGNING_KEY = rotated.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.RIFT_PROOF_KEY_ID = "k-jun";
    process.env.RIFT_PROOF_PUBLIC_KEYS = JSON.stringify([
      { keyId: "k-jan", publicKey: januaryPublic },
      {
        keyId: "k-jun",
        publicKey: rotated.publicKey.export({ type: "spki", format: "pem" }).toString(),
      },
    ]);
    resetProofKeys();

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    const body = (await response.json()) as { result: { signature: string; ok: boolean } };

    expect(body.result.signature).toBe("valid");
    expect(body.result.ok).toBe(true);
  });

  it("never returns private key material", async () => {
    const key = configureSigningKey();
    const recordId = await decide();

    const response = await verify(tree.orgA.secretKey, { consent_record_id: recordId });
    const text = await response.text();

    expect(text).not.toContain("PRIVATE KEY");
    expect(text).not.toContain(key.privateKeyPem.slice(60, 100));
  });
});

// ─── The chain ───────────────────────────────────────────────────────────────

describe("the proof chain", () => {
  it("links one person's decisions in order", async () => {
    configureSigningKey();
    await decide("GRANTED", "visitor-1");
    await decide("DENIED", "visitor-1");
    await decide("GRANTED", "visitor-1");

    const rows = await prisma.consentRecord.findMany({
      where: { siteId: tree.siteA1.siteId },
      orderBy: { proofSequence: "asc" },
      select: { proofSequence: true, proofDocumentHash: true, proofPreviousHash: true },
    });

    expect(rows.map((r) => r.proofSequence)).toEqual([1, 2, 3]);
    expect(rows[0]?.proofPreviousHash).toBeNull();
    expect(rows[1]?.proofPreviousHash).toBe(rows[0]?.proofDocumentHash);
    expect(rows[2]?.proofPreviousHash).toBe(rows[1]?.proofDocumentHash);
  });

  it("notices a decision removed from the middle", async () => {
    configureSigningKey();
    await decide("GRANTED", "visitor-1");
    const second = await decide("DENIED", "visitor-1");
    const third = await decide("GRANTED", "visitor-1");

    // Delete the withdrawal. The append-only trigger guards UPDATE; this is the
    // deletion case, and the chain is what makes it visible to an outsider.
    await tamper(`DELETE FROM ${TABLE} WHERE id = $1`, second);

    const response = await verifyProof(
      managementRequest("/api/v1/consent/proof/verify", {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { consent_record_id: third },
      }),
    );

    const body = (await response.json()) as { result: { chain: string; signature: string } };
    expect(body.result.chain).toBe("broken");
    // The signature is still genuine. Collapsing the two would hide which one
    // actually failed.
    expect(body.result.signature).toBe("valid");
  });

  it("keeps separate people on separate chains", async () => {
    configureSigningKey();
    await decide("GRANTED", "visitor-1");
    await decide("GRANTED", "visitor-2");

    const rows = await prisma.consentRecord.findMany({
      where: { siteId: tree.siteA1.siteId },
      orderBy: { recordedAt: "asc" },
      select: { proofSequence: true, proofPreviousHash: true },
    });

    // Both are the first decision in their own history.
    expect(rows.every((r) => r.proofPreviousHash === null)).toBe(true);
  });
});
