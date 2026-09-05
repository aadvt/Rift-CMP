# Consent proof

Three separate claims, three separate mechanisms, and a careful line around what
none of them establish.

## The three claims

`shared/consent-proof.ts` computes a receipt digest and has always been careful
about what that digest is worth. Phase 11B adds the two claims it could never
make, in `shared/consent-signature.ts`. They are reported separately and must
never be collapsed into one boolean.

### Integrity — "the record still matches the proof"

SHA-256 over a canonical serialisation of the decision's evidence, computed at
write time. Recompute it from the record and compare.

Detects modification by anyone who cannot recompute it: accident, and a third
party. It proves nothing against someone who can write the table — they would
simply recompute it.

### Authenticity — "a named key produced this"

An Ed25519 signature over a canonical proof document, made by a private key that
never leaves the server. This is the claim the digest could not make, and the one
that matters against the fiduciary: recomputing a hash is free, forging a
signature is not.

**A hash is not a signature.** The receipt digest was never described as one, and
this document does not start now.

### Ordering — "this decision sits where it says it does"

Each proof names the digest of the previous proof for the same principal on the
same site, plus a 1-based sequence number. Removing a decision from the middle of
somebody's history leaves a hole that verification finds.

This is the property an append-only trigger cannot demonstrate to an outsider.
The trigger stops an `UPDATE`; it cannot prove to an auditor that nothing was
deleted by someone who could disable it.

Chains are per `(site, principal)`. The sequence column is `UNIQUE` on
`(site_id, principal_id, proof_sequence)`, so two concurrent decisions cannot
land on the same position — the second fails and retries rather than silently
forking the chain, and a forked chain is indistinguishable from tampering after
the fact.

## What a valid proof does *not* establish

A valid signature shows this proof was produced by the holder of the named key
and has not been altered since. It does **not** show:

* that the consent was lawfully obtained;
* that the notice was adequate or intelligible;
* that the policy was configured correctly;
* that the person understood what they agreed to;
* that you comply with any particular regulation.

Those are questions about the world, and no amount of cryptography reaches them.
`PROOF_CAVEAT` travels on every proof and every verification response for exactly
this reason.

## What a proof binds

```
rift-consent-proof/1
consentRecordId
siteId
principalExternalId      ← the opaque per-site id the visitor already holds
purposeCode
status
decidedAt                ← normalised to ISO 8601
policyVersionId
policyConfigVersion
jurisdictions            ← sorted
receiptHash              ← the integrity digest
sequence
previousProofHash
```

Field order is fixed and explicit, never object iteration order. Every value is
normalised before hashing or signing, so the same logical receipt produces the
same bytes in any runtime — otherwise a signature made on one machine fails to
verify on another and the failure means nothing.

Nothing beyond the opaque principal id identifies the person. A signature over
extra personal data would make the proof itself a disclosure risk.

`canonicalProof` and `verifySignedProof` are exported so anyone holding a proof
and the public key can verify it without us. A verification procedure only we can
carry out is not a verification procedure.

## Keys

| Variable | Holds |
| --- | --- |
| `RIFT_PROOF_SIGNING_KEY` | Ed25519 private key, PKCS#8 PEM (or base64 of it) |
| `RIFT_PROOF_KEY_ID` | The id recorded on proofs this key signs |
| `RIFT_PROOF_PUBLIC_KEYS` | JSON array of `{ keyId, publicKey, revoked? }` |

Base64 is accepted for the PEMs because a PEM has newlines and newlines do not
survive most secret managers or any `.env` file.

Generate a pair:

```bash
openssl genpkey -algorithm ed25519 -out rift-proof-2026-09.pem
openssl pkey -in rift-proof-2026-09.pem -pubout -out rift-proof-2026-09.pub
```

### Rules

The private key:

* stays server-side — this module is never reachable from a browser bundle, and
  `shared/index.ts` excludes `consent-signature` for that reason;
* is never committed;
* is never written to a log;
* is never returned by an API.

The last is enforced twice: routes only ever read `proofKeyId`, and
`assertNoPrivateMaterial` scans the finished response body before it is sent. A
test asserting "the route does not return the key" passes until somebody adds a
field; a check on the body itself keeps passing when they do.

### Unconfigured is a supported state

With no key, proofs are still issued and still carry integrity and chain links —
they say `signature: null`, and every surface reports them as **unsigned**, never
as invalid. Refusing to record a consent decision because an optional hardening
feature was not configured would make it load-bearing for the product's core
function.

### Rotation

1. Generate a new pair.
2. **Append** the new public key to `RIFT_PROOF_PUBLIC_KEYS`, keeping every
   existing entry.
3. Point `RIFT_PROOF_KEY_ID` and `RIFT_PROOF_SIGNING_KEY` at the new pair.
4. Deploy.

Old proofs stay verifiable. Dropping a retired public key silently converts every
proof it signed from `valid` to `unknown_key` — which is why step 2 says append.

### Revocation

Mark the entry `"revoked": true` rather than deleting it. Verification then
reports `revoked_key`: the signature is genuine, and the key is no longer
trusted. Those are different facts from `unknown_key`, and an auditor needs to
tell them apart. A revoked key is refused as an active signer.

## Verification

`POST /api/v1/consent/proof/verify` — management plane.

Two ways to call it:

* `{ "consent_record_id": "…" }` — the auditor's question: has anything about
  this decision changed since it was recorded?
* `{ "proof": { … } }` — the holder's question: is the thing I was handed
  genuine? The proof is resolved against the record it *names*, which is what
  makes proof substitution detectable.

Verification uses public material only.

| Field | Values |
| --- | --- |
| `integrity` | `valid`, `invalid` |
| `signature` | `valid`, `invalid`, `unsigned`, `unknown_key`, `revoked_key` |
| `chain` | `valid`, `broken`, `unverifiable` |
| `malformed` | a reason, or `null` |
| `unsupported_version` | `true` when this build cannot read the scheme |

`unverifiable` is not a pass. It means the preceding proof was not supplied, so
ordering was not checked.

An unsupported version is reported as unsupported, not as forged — a proof from a
future scheme may be perfectly valid, and calling it invalid would be a false
statement about somebody's evidence.

`GET /api/v1/consent/records/{recordId}/proof` returns the proof, the evidence it
covers, and the key id. Never key material.

## Storage

Proof columns live on `consent_records` rather than in a parallel table, because
there is exactly one proof per decision. A separate table would be the same row
written twice, with an opportunity for the two copies to disagree and no way to
tell which was right.

Nothing was backfilled. A signature computed today over a decision taken in March
would evidence nothing except that we can still run the signer. Records from
before this migration report `signature: unsigned` and keep their receipt digest.
