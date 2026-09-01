# Secure Data Routing (Phase 3 Prototype)

This document is the design for a **proof of concept**, written before the code.
It defines the trust boundary the prototype exists to demonstrate, and is explicit
about what it does *not* claim.

## The property being proved

> Rift can facilitate and record an authorised personal-data transfer without
> being able to read the plaintext personal-data payload.

Everything below is in service of that one sentence. The interesting claim is not
"the data is encrypted" — it is **who holds the capability to decrypt**, and that
Rift is provably not on that list.

## What this prototype is not

- It is **not** production-grade, and passing tests does not make it so. It has had
  no cryptographic review, no key-rotation story, no HSM, no formal threat model.
- It invents **no** cryptography. Every primitive is a standard construction from
  Node's built-in `node:crypto`.
- It is **not** a distributed data-sharing network. Source and target fiduciaries
  are mocks that run in the test process.
- It does **not** defend against a malicious Rift operator who changes the code.
  It defends against a Rift that behaves as written, and against anyone who
  compromises Rift's database or intercepts its traffic.

## Roles

| Role | In this prototype | Holds |
| --- | --- | --- |
| **Data Principal** | A `Principal` row from Phase 2 | nothing |
| **Source Fiduciary** | Mock actor + an authenticated `Organisation` | the plaintext; seals it |
| **Rift (Consent Manager)** | The API and its database | ciphertext + metadata only |
| **Target Fiduciary** | Mock actor holding an X25519 private key | the only decryption capability |

## Cryptographic construction

Standard hybrid public-key encryption — the same shape as ECIES and libsodium's
sealed boxes, assembled from `node:crypto`:

```text
Target generates          X25519 keypair. Private key NEVER leaves the target.
                          Public key is registered with Rift (it is not a secret).

Source, per transfer:     ephemeral X25519 keypair
                          shared   = ECDH(ephemeral_private, target_public)
                          key      = HKDF-SHA256(shared, salt="", info) -> 32 bytes
                          envelope = AES-256-GCM(key, iv, plaintext, aad)

                          The ephemeral private key is discarded immediately.

Target, on receipt:       shared = ECDH(target_private, ephemeral_public)
                          ... same HKDF ... then AES-256-GCM open.
```

Why each piece:

- **X25519** gives forward secrecy per transfer via the ephemeral key: recovering
  one transfer's key reveals nothing about any other.
- **HKDF-SHA256** turns the raw ECDH output into a uniform symmetric key. Using
  the ECDH result directly as an AES key is a classic mistake. The salt is
  deliberately **empty** — that is HKDF's default and is correct here, because
  the input is already a high-entropy ECDH secret rather than a low-entropy
  password. Instead, `info` carries the domain-separation label followed by both
  public keys:

  ```js
  info = utf8("rift-cmp/secure-transfer/v1") || ephemeral_public || recipient_public
  ```

  Mixing both public keys in binds the derived key to this specific pair of
  parties, so the same shared secret reproduced in another context yields a
  different key.
- **AES-256-GCM** is authenticated encryption. Its tag is what makes tampering
  detectable rather than silently producing garbage plaintext.

Rift cannot compute `shared`. It sees `target_public` and `ephemeral_public`, and
deriving the shared secret from two public keys is the Diffie-Hellman problem.

## The eight questions, answered

| Question | Answer |
| --- | --- |
| Who creates the plaintext? | The source fiduciary, in its own process. |
| Who encrypts it? | The source fiduciary, before any network call to Rift. |
| Who can decrypt? | Only the target fiduciary, which holds the X25519 private key. |
| What does Rift receive? | A sealed envelope (opaque bytes) plus routing metadata. |
| What does Rift store? | The envelope, its SHA-256 digest, size, and routing metadata. No key material. |
| What does the target receive? | The same envelope plus the routing metadata it needs to rebuild the AAD. |
| How is authorisation represented? | A single-use `TransferAuthorisation` row with a nonce and an expiry. |
| What can the platform never access? | Plaintext, target private keys, and the derived per-transfer symmetric key. |

## Binding: how tampering and misrouting are caught

The envelope is bound to its authorisation using AES-GCM's **additional
authenticated data**. Because the sender and receiver must produce *byte
identical* input, the AAD is a JSON array with a fixed field order rather than an
object, whose key order is not guaranteed. The first element is a domain
separation label:

```js
// secure-transfer/envelope.ts
aad = utf8(JSON.stringify([
  "rift-cmp/transfer/v1",
  authorisationId,
  nonce,
  purposeCode,
  recipientCode,
  principalExternalId,
]))
```

AAD is authenticated but not encrypted, and both sides derive it from metadata
they already have. The consequences are what matter:

- **Modified ciphertext** — GCM tag check fails. Decryption throws; it does not
  return corrupted plaintext.
- **Envelope replayed under a different authorisation** — the AAD no longer
  matches, so the tag check fails even though the ciphertext is byte-identical.
- **Envelope redirected to a different recipient** — wrong `recipient_code` in the
  AAD *and* the wrong private key. Two independent failures.
- **Rift altering metadata in flight** — changes the AAD the target reconstructs,
  so decryption fails. Rift cannot silently re-target a transfer.

## Replay prevention

Three independent mechanisms, because each covers a different case:

1. **Single-use authorisation.** An authorisation is `AUTHORISED` until a transfer
   consumes it, then `CONSUMED`. Submitting against a consumed authorisation is
   rejected. Enforced by a unique constraint on `transfer_records.authorisation_id`,
   so the database refuses a second transfer even under a race.
2. **Expiry.** `expires_at` bounds the window. Expired authorisations are rejected.
3. **Nonce.** A high-entropy value, unique per authorisation, that is part of the
   AAD. An envelope sealed for one authorisation cannot be reused under another.

## Data model

Three new models. Nothing here holds plaintext or private keys.

**`DataRecipient`** — a target fiduciary a source organisation may send to.

| Field | Notes |
| --- | --- |
| `organisationId` | tenant owner (the source registers who it may send to) |
| `code`, `name` | stable identifier, unique per organisation |
| `publicKey` | the target's X25519 public key, base64. Public by definition. |
| `algorithm` | `"X25519-HKDF-SHA256-AES256GCM"`, so the construction can evolve |
| `deliveryKeyHash` | SHA-256 of the `rk_...` credential the target uses to collect envelopes. Same hashed-token pattern as organisation secrets. |
| `isActive` | recipients can be switched off without deleting history |

**`TransferAuthorisation`** — permission to make one specific transfer.

| Field | Notes |
| --- | --- |
| `organisationId`, `siteId` | tenant scope, as everywhere else |
| `principalId`, `purposeId`, `recipientId` | who, why, to whom |
| `consentRecordId` | **the exact consent decision relied upon**, not a boolean |
| `nonce` | single-use, unique, part of the AAD |
| `status` | `AUTHORISED` / `CONSUMED` / `EXPIRED` |
| `expiresAt`, `createdAt` | |

Referencing `consentRecordId` rather than storing "consent was granted" means an
auditor can later see precisely which decision justified the transfer — and,
because Phase 2's log is append-only, that decision can never be rewritten. That
reference is what `GET /api/v1/audit` follows to present the decision, the
authorisation and the transfer as one story; a withdrawal afterwards stops future
authorisations without altering this row. See [lifecycle.md](lifecycle.md).

**`TransferRecord`** — what actually happened, and the sealed payload in transit.

| Field | Notes |
| --- | --- |
| `organisationId` | tenant scope; composite FK to `(authorisation_id, organisation_id)` so a transfer's tenant must match its authorisation's |
| `authorisationId` | **unique** — one transfer per authorisation |
| `ciphertext`, `iv`, `authTag`, `ephemeralPublicKey` | the sealed envelope, opaque to Rift |
| `ciphertextSha256`, `payloadBytes` | integrity and accounting without inspecting content |
| `status` | `RECORDED` / `DELIVERED` / `FAILED` |
| `failureReason` | nullable; set when a transfer is marked `FAILED` |
| `recordedAt`, `deliveredAt` | |

Rift stores the envelope because it acts as the relay. That is the strongest form
of the demonstration: *here is everything Rift has, including the ciphertext — it
still cannot read it.*

## Authorisation flow

```text
1. Source authenticates                Organisation secret key (sk_...)
2. Identify the Data Principal         principal_external_id on a site the org owns
3. Identify the purpose                purpose_code, resolved within the org
4. Verify consent                      newest decision for (principal, purpose)
5. Verify it is applicable and current  must resolve to GRANTED; DENIED and
                                        WITHDRAWN are both refusals
6. Create the authorisation             nonce + expiry, referencing the consent row
7. Perform the transfer                 source seals, submits; Rift consumes the
                                        authorisation and records the envelope
8. Record the result                    TransferRecord, then DELIVERED on collection
```

Steps 1-6 involve no payload at all. **Authorisation and payload are separate
requests**: Rift decides whether a transfer may happen before any ciphertext
exists, and the ciphertext is never an input to the authorisation decision.

Steps 2 to 5 are not transfer-specific, and since Phase 4 they are not
implemented here. `authoriseTransfer` delegates them to `evaluateAuthorisation`
in `database/authorisation.ts` — a side-effect-free orchestration layer that owns
"is this action permitted?" and contains no cryptography — and then does the one
thing that *is* transfer-specific: minting a single-use permission to move a
payload. That layer is also reachable on its own, at
`POST /api/v1/authorisations/decision`, for a fiduciary that needs the answer
without committing to it. The flow end to end, the refusal vocabulary and the
audit trail over it are in [lifecycle.md](lifecycle.md).

The endpoint that mints an authorisation is `POST /api/v1/authorisations`. It was
`POST /api/v1/transfers/authorisations` in Phase 3; authorisation is its own
concern rather than a sub-resource of transfers, since a transfer is merely one
action that needs permission.

## Credential planes

Phase 1 established two; this adds a third. Each is prefix-checked before any
database lookup, so no plane can be probed with another's credential.

| Plane | Credential | Can |
| --- | --- | --- |
| Ingestion | `pk_` site public key | write events, record consent |
| Management | `sk_` organisation secret | manage sites, purposes, recipients; ask whether an action is permitted; authorise and submit transfers; read own transfer metadata and audit trail |
| **Delivery** | `rk_` recipient delivery key | collect envelopes addressed to that recipient, and nothing else |

## Where the keys live

This is the part that carries the whole claim, so it is stated bluntly:

| Key | Lives in | In Rift's database? |
| --- | --- | --- |
| Target X25519 **private** key | The target fiduciary process only | **No** |
| Target X25519 **public** key | Registered with Rift | Yes — it is public |
| Ephemeral **private** key | Source process, discarded after sealing | **No** |
| Derived AES key | Never persisted anywhere | **No** |
| Recipient delivery key | Shown once at registration | Only a SHA-256 digest |

Encrypting data and then storing the decryption key in the same database would
make the whole exercise theatre. A test therefore scans every column of every
table for private-key material and for the plaintext.

## The security boundary in code

All cryptography lives in one workspace package, `secure-transfer/`, split so that
the boundary is **structural rather than a matter of discipline**:

```text
secure-transfer/
  envelope.ts   types, canonical AAD, digest, shape validation   <- Rift may import
  fiduciary.ts  generateRecipientKeyPair, seal, open             <- fiduciaries only
```

`api/` imports only `envelope.ts`. A test asserts that no file under `api/` imports
the fiduciary module — so Rift does not merely decline to decrypt, it does not
have the code to.

## Known limitations

Stated plainly, because an unstated limitation is a lie by omission:

- **No recipient key authentication.** A source trusts the public key it registered.
  There is no PKI, no certificate, no key transparency. A malicious source could
  register a key it controls and read its own data — which it already has.
- **Rift is trusted for availability and metadata integrity**, not confidentiality.
  It can refuse to deliver, or lie about metadata — but the AAD binding means
  altered metadata breaks decryption rather than silently misrouting plaintext.
- **Metadata is not private.** Rift learns who sent what, to whom, for which
  purpose, when, and how large it was. Only the payload is protected.
- **No key rotation or revocation.** `isActive` disables a recipient; it does not
  re-key past envelopes.
- **Envelopes are retained** until deleted. There is no retention policy yet.
- **Mock fiduciaries run in-process.** A real deployment would put the target's
  private key in separate infrastructure Rift has no access to; the prototype
  demonstrates the boundary, not the deployment.
- **No cryptographic review.** Do not deploy this as-is.
