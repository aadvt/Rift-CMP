import type {
  SealedEnvelope,
  TransferAuthorisationSummary,
  TransferBindingWire,
  TransferDelivery,
  TransferEnvelopeWire,
} from "@rift-cmp/shared";
import { fromWireBinding, fromWireEnvelope, toWireEnvelope } from "@rift-cmp/shared";
import { buildTransferAad } from "@rift-cmp/secure-transfer";
import {
  generateRecipientKeyPair,
  openEnvelope,
  sealEnvelope,
} from "@rift-cmp/secure-transfer/fiduciary";

/**
 * Mock fiduciaries.
 *
 * These stand in for systems that would be operated by other parties entirely.
 * The important property is not that they are realistic, but that the target's
 * private key exists **only inside this object** — it is never registered with
 * Rift, never written to the database, and never sent over any request the API
 * handles. Everything the tests claim about Rift's inability to decrypt follows
 * from that.
 */
export class MockTargetFiduciary {
  private readonly keyPair = generateRecipientKeyPair();

  /** Safe to hand to Rift. This is what gets registered. */
  get publicKey(): string {
    return this.keyPair.publicKey;
  }

  /**
   * Exposed only so tests can assert this value never appears in Rift's database
   * or responses. Real deployments would never surface it at all.
   */
  get privateKeyForAssertionsOnly(): string {
    return this.keyPair.privateKey;
  }

  /** Decrypts a collected envelope, rebuilding the AAD from routing metadata. */
  open(delivery: TransferDelivery): string {
    return openEnvelope({
      envelope: fromWireEnvelope(delivery.envelope),
      recipientPrivateKey: this.keyPair.privateKey,
      aad: buildTransferAad(fromWireBinding(delivery.binding)),
    }).toString("utf8");
  }

  /** Attempts to open an arbitrary envelope. Used for negative tests. */
  tryOpen(envelope: TransferEnvelopeWire, binding: TransferBindingWire): string | null {
    try {
      return openEnvelope({
        envelope: fromWireEnvelope(envelope),
        recipientPrivateKey: this.keyPair.privateKey,
        aad: buildTransferAad(fromWireBinding(binding)),
      }).toString("utf8");
    } catch {
      return null;
    }
  }
}

/**
 * The source fiduciary's job: seal a payload against a granted authorisation.
 *
 * Everything needed comes from the authorisation Rift returned — the recipient's
 * public key and the binding fields — so no extra channel between source and
 * target is required.
 */
export function sealForAuthorisation(
  authorisation: TransferAuthorisationSummary,
  plaintext: string,
): SealedEnvelope {
  return sealEnvelope({
    plaintext,
    recipientPublicKey: authorisation.recipient_public_key,
    aad: buildTransferAad({
      authorisationId: authorisation.authorisation_id,
      nonce: authorisation.nonce,
      purposeCode: authorisation.purpose_code,
      recipientCode: authorisation.recipient_code,
      principalExternalId: authorisation.principal_external_id,
    }),
  });
}

/** Wire shape for submitting an envelope to `POST /api/v1/transfers`. */
export function submissionBody(
  authorisation: TransferAuthorisationSummary,
  envelope: SealedEnvelope,
) {
  return {
    authorisation_id: authorisation.authorisation_id,
    nonce: authorisation.nonce,
    envelope: toWireEnvelope(envelope),
  };
}
