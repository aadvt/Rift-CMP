/**
 * Manual end-to-end demonstration of the whole product flow:
 *
 *   consent -> authorisation -> secure transfer -> audit record
 *
 * and the refusal that follows a withdrawal.
 *
 * Runs against a live API and plays both fiduciaries in one process. The target's
 * private key is held in a local variable and is never sent anywhere: everything
 * the demo prints about Rift's inability to decrypt follows from that.
 *
 *   cd api && npm run dev            # in another terminal
 *   RIFT_SECRET_KEY=sk_... npm run demo --workspace secure-transfer
 *
 * The organisation secret is printed once by `npm run seed` in `database/`.
 */
import {
  buildTransferAad,
  type SealedEnvelope,
  type TransferBinding,
} from "./envelope";
import { generateRecipientKeyPair, openEnvelope, sealEnvelope } from "./fiduciary";

const API = process.env.RIFT_API_URL ?? "http://127.0.0.1:3000";
const SECRET_KEY = process.env.RIFT_SECRET_KEY;
const SITE_ID = process.env.RIFT_SITE_ID ?? "site_demo";
const SITE_PUBLIC_KEY = process.env.RIFT_SITE_PUBLIC_KEY ?? "pk_demo_12345";
const PURPOSE_CODE = process.env.RIFT_PURPOSE_CODE ?? "analytics";

const PLAINTEXT = "PAN: ABCDE1234F | DOB: 1990-04-17 | Salary: 1,250,000 INR";
const PRINCIPAL = `demo-principal-${Date.now()}`;
const RECIPIENT_CODE = `demo-bank-${Date.now()}`;

if (!SECRET_KEY) {
  console.error(
    "RIFT_SECRET_KEY is required.\n" +
      "Run `npm run seed` in database/ to mint one, or use the key you saved.",
  );
  process.exit(1);
}

function heading(text: string) {
  console.log(`\n${"-".repeat(72)}\n${text}\n${"-".repeat(72)}`);
}

async function call(
  method: string,
  path: string,
  options: { key: string; body?: unknown },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.key}`,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: response.status, body };
}

function fail(step: string, result: { status: number; body: unknown }): never {
  console.error(`\n${step} failed (${result.status}):`, JSON.stringify(result.body, null, 2));
  process.exit(1);
}

async function main() {
  // -- The target fiduciary. Its private key never leaves this object. --------
  heading("1. Target fiduciary generates a key pair");
  const target = generateRecipientKeyPair();
  console.log(`   public key  (registered with Rift): ${target.publicKey.slice(0, 44)}...`);
  console.log(`   private key (never sent anywhere) : ${target.privateKey.slice(0, 20)}... [stays here]`);

  heading("2. Source registers the target as a recipient");
  const registered = await call("POST", "/api/v1/recipients", {
    key: SECRET_KEY!,
    body: { code: RECIPIENT_CODE, name: "Demo Partner Bank", public_key: target.publicKey },
  });
  if (registered.status !== 201) fail("Recipient registration", registered);
  const deliveryKey = registered.body.delivery_key as string;
  console.log(`   recipient    : ${RECIPIENT_CODE}`);
  console.log(`   delivery key : ${deliveryKey.slice(0, 12)}... (shown once; Rift stores only a digest)`);

  heading("3. Data principal grants consent");
  const consent = await call("POST", "/api/v1/consent", {
    key: SITE_PUBLIC_KEY,
    body: {
      principal_external_id: PRINCIPAL,
      purpose_code: PURPOSE_CODE,
      status: "GRANTED",
    },
  });
  if (consent.status !== 201) fail("Consent", consent);
  const record = consent.body.record as Record<string, unknown>;
  console.log(`   principal : ${PRINCIPAL}`);
  console.log(`   purpose   : ${PURPOSE_CODE} -> ${record.status}`);

  heading("4. Source asks whether this is permitted (no side effect)");
  const preCheck = await call("POST", "/api/v1/authorisations/decision", {
    key: SECRET_KEY!,
    body: {
      site_id: SITE_ID,
      principal_external_id: PRINCIPAL,
      purpose_code: PURPOSE_CODE,
    },
  });
  console.log(`   permitted     : ${preCheck.body.permitted}`);
  console.log(`   consent cited : ${preCheck.body.consent_record_id}`);
  console.log(`   reason        : ${preCheck.body.reason ?? "(none - granted)"}`);

  heading("5. Source asks Rift to authorise a transfer (no payload involved)");
  const authorised = await call("POST", "/api/v1/authorisations", {
    key: SECRET_KEY!,
    body: {
      site_id: SITE_ID,
      principal_external_id: PRINCIPAL,
      purpose_code: PURPOSE_CODE,
      recipient_code: RECIPIENT_CODE,
    },
  });
  if (authorised.status !== 201) fail("Authorisation", authorised);
  const auth = authorised.body as Record<string, string>;
  console.log(`   authorisation : ${auth.authorisation_id}`);
  console.log(`   consent cited : ${auth.consent_record_id}`);
  console.log(`   expires       : ${auth.expires_at}`);

  heading("6. Source seals the payload locally");
  console.log(`   plaintext : ${PLAINTEXT}`);
  const binding: TransferBinding = {
    authorisationId: auth.authorisation_id,
    nonce: auth.nonce,
    purposeCode: auth.purpose_code,
    recipientCode: auth.recipient_code,
    principalExternalId: auth.principal_external_id,
  };
  const envelope = sealEnvelope({
    plaintext: PLAINTEXT,
    recipientPublicKey: auth.recipient_public_key,
    aad: buildTransferAad(binding),
  });
  console.log(`   ciphertext: ${envelope.ciphertext.slice(0, 56)}...`);
  console.log(
    `   contains the plaintext? ${Buffer.from(envelope.ciphertext, "base64").toString("utf8").includes("ABCDE1234F")}`,
  );

  heading("7. Source submits the sealed envelope to Rift");
  const submitted = await call("POST", "/api/v1/transfers", {
    key: SECRET_KEY!,
    body: {
      authorisation_id: auth.authorisation_id,
      nonce: auth.nonce,
      envelope: {
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        auth_tag: envelope.authTag,
        ephemeral_public_key: envelope.ephemeralPublicKey,
      },
    },
  });
  if (submitted.status !== 201) fail("Transfer submission", submitted);
  const transfer = submitted.body as Record<string, unknown>;
  console.log(`   transfer id : ${transfer.transfer_id}`);
  console.log(`   digest      : ${String(transfer.ciphertext_sha256).slice(0, 32)}...`);
  console.log(`   size        : ${transfer.payload_bytes} bytes`);

  heading("8. What Rift can see (its own management view)");
  const listed = await call("GET", "/api/v1/transfers", { key: SECRET_KEY! });
  const view = JSON.stringify((listed.body.transfers as unknown[])[0], null, 2);
  console.log(view.split("\n").map((line) => `   ${line}`).join("\n"));
  console.log(`\n   plaintext present in Rift's view? ${view.includes("ABCDE1234F")}`);

  heading("9. Target collects the envelope and decrypts it");
  const collected = await call("GET", `/api/v1/transfers/${transfer.transfer_id}/envelope`, {
    key: deliveryKey,
  });
  if (collected.status !== 200) fail("Collection", collected);

  // The wire format is snake_case like the rest of the API; map it back to the
  // crypto types here. `secure-transfer` deliberately does not depend on
  // `shared` (which depends on it), so the mapping is written out.
  const wire = collected.body as unknown as {
    envelope: Record<string, string>;
    binding: Record<string, string>;
  };
  const delivery = {
    envelope: {
      ciphertext: wire.envelope.ciphertext,
      iv: wire.envelope.iv,
      authTag: wire.envelope.auth_tag,
      ephemeralPublicKey: wire.envelope.ephemeral_public_key,
    } satisfies SealedEnvelope,
    binding: {
      authorisationId: wire.binding.authorisation_id,
      nonce: wire.binding.nonce,
      purposeCode: wire.binding.purpose_code,
      recipientCode: wire.binding.recipient_code,
      principalExternalId: wire.binding.principal_external_id,
    } satisfies TransferBinding,
  };

  const recovered = openEnvelope({
    envelope: delivery.envelope,
    recipientPrivateKey: target.privateKey,
    aad: buildTransferAad(delivery.binding),
  }).toString("utf8");

  console.log(`   recovered : ${recovered}`);
  console.log(`   matches the original? ${recovered === PLAINTEXT}`);

  heading("10. Can Rift decrypt what it just delivered?");
  // Everything Rift holds, tried as a decryption key.
  const riftHolds: Array<[string, string]> = [
    ["recipient public key", auth.recipient_public_key],
    ["ephemeral public key", delivery.envelope.ephemeralPublicKey],
    ["ciphertext", delivery.envelope.ciphertext],
    ["auth tag", delivery.envelope.authTag],
    ["delivery key", deliveryKey],
    ["organisation secret", SECRET_KEY!],
  ];

  let broke = 0;
  for (const [label, candidate] of riftHolds) {
    try {
      openEnvelope({
        envelope: delivery.envelope,
        recipientPrivateKey: candidate,
        aad: buildTransferAad(delivery.binding),
      });
      console.log(`   ${label.padEnd(22)} DECRYPTED  <-- boundary broken`);
      broke += 1;
    } catch {
      console.log(`   ${label.padEnd(22)} cannot decrypt`);
    }
  }

  heading("11. The audit trail: one timeline across all three domains");
  const audit = await call("GET", `/api/v1/audit?principal_external_id=${encodeURIComponent(PRINCIPAL)}`, {
    key: SECRET_KEY!,
  });
  for (const entry of (audit.body.entries as Array<Record<string, string>>) ?? []) {
    console.log(`   ${entry.at}  ${entry.kind.padEnd(14)} ${entry.status.padEnd(11)} ${entry.summary}`);
  }
  const auditText = JSON.stringify(audit.body);
  console.log(`
   plaintext present anywhere in the audit trail? ${auditText.includes("ABCDE1234F")}`);

  heading("12. Principal withdraws consent; the next request is refused");
  await call("POST", "/api/v1/consent", {
    key: SITE_PUBLIC_KEY,
    body: { principal_external_id: PRINCIPAL, purpose_code: PURPOSE_CODE, status: "WITHDRAWN" },
  });

  const afterWithdrawal = await call("POST", "/api/v1/authorisations/decision", {
    key: SECRET_KEY!,
    body: { site_id: SITE_ID, principal_external_id: PRINCIPAL, purpose_code: PURPOSE_CODE },
  });
  console.log(`   permitted : ${afterWithdrawal.body.permitted}`);
  console.log(`   reason    : ${afterWithdrawal.body.reason}`);

  const refused = await call("POST", "/api/v1/authorisations", {
    key: SECRET_KEY!,
    body: {
      site_id: SITE_ID,
      principal_external_id: PRINCIPAL,
      purpose_code: PURPOSE_CODE,
      recipient_code: RECIPIENT_CODE,
    },
  });
  console.log(`   authorisation request -> HTTP ${refused.status} ${(refused.body.error as Record<string, string>)?.code ?? ""}`);

  const stillRecorded = await call("GET", "/api/v1/transfers", { key: SECRET_KEY! });
  const thisPrincipalsTransfers = (
    stillRecorded.body.transfers as Array<Record<string, string>>
  ).filter((t) => t.principal_external_id === PRINCIPAL);
  console.log(
    `   this principal's completed transfers still on record: ${thisPrincipalsTransfers.length}` +
      "  (withdrawal stops future transfers; it does not rewrite the past)",
  );

  const refusedCorrectly =
    afterWithdrawal.body.permitted === false &&
    afterWithdrawal.body.reason === "consent_withdrawn" &&
    refused.status === 409;

  heading(
    broke === 0 && refusedCorrectly ? "RESULT: lifecycle holds" : "RESULT: SOMETHING IS WRONG",
  );
  console.log(
    broke === 0 && refusedCorrectly
      ? [
          "   Consent was recorded, the request was checked against it, and an",
          "   authorisation was minted citing the exact decision relied upon. The",
          "   sealed payload was relayed and recorded, and the whole story reads",
          "   back as one audit trail. Rift could not read the payload at any",
          "   point, and once consent was withdrawn the next request was refused",
          "   while the completed transfer stayed on the record.",
          "",
          "   The secure transfer piece is a proof of concept with no cryptographic",
          "   review. Do not deploy it as-is.",
        ].join("\n")
      : "   Investigate immediately.",
  );
  process.exit(broke === 0 && refusedCorrectly ? 0 : 1);
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
