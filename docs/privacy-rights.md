# Consent Proof and Privacy Rights

What a decision has to carry to be provable later, and which controls a person
should be offered.

Research artifact, not legal advice.

## There is no universal rights workflow

The brief's hardest instruction, and the matrix agrees with it emphatically.
The regimes do not offer the same rights:

| Regime | What its rights requirement records |
| --- | --- |
| GDPR | access, rectification, erasure, restriction, portability, objection |
| CCPA/CPRA | know, deletion, opt out of **sale**, opt out of **sharing**, non-discrimination |
| India DPDP | access, correction, erasure, **grievance redressal** |
| Brazil LGPD | confirmation, access, correction, deletion, portability — and `REQ-BR-LGPD-016` says outright that it creates **no** CCPA-style universal sale opt-out |

So a fixed list of buttons would be wrong somewhere on its first day. Available
controls are derived per request from the jurisdictions in play, and the
derivation in `api/lib/rights.ts` is keyed on **canonical topic, never on a
regime** — the same guarantee `policy/disposition.ts` holds, for the same
reason.

## Three answers, not two

| | Means |
| --- | --- |
| `always` | The platform guarantees it regardless of regime |
| `indicated` | A requirement of that family applies. Its text is carried so a person can read what was cited |
| `unknown` | The matrix says nothing — **not** a finding that the control does not apply |

`unknown` says so in the note on every such row, because `matrix/coverage.md` is
explicit that silence means "not converted". Leaving a caller to infer a denial
from an absence is exactly how a research artifact turns into a wrong answer.

`indicated` is deliberately weaker than "this right exists". The matrix can say
a regime *has* a rights obligation and cite it; it cannot say which specific
rights, because the requirement records them in prose — `REQ-GDPR-007` names six
in one sentence — and no structured field enumerates them. Parsing that sentence
would invent structure the research does not have; hard-coding "GDPR grants
portability" would move legal content into code where no lawyer reads it.

**`review` and `withdraw` are `always`**, and that is a claim about Rift rather
than about law: the consent log is append-only and readable back, and a
withdrawal has always been accepted. Reporting them as `unknown` for want of a
citation would understate what the product actually does.

## A bug this found in the matrix

Deriving controls from topic exposed an inconsistency in the Phase 6B data, and
it is worth recording because the failure was silent.

`REQ-BR-LGPD-016` and `REQ-EP-023` are structurally identical: each states that
a regime creates **no** such right. But `REQ-EP-023` carried
`applicability.applies: false` — which `matrix/coverage.md` describes as "a
statement of absence, not a rule" — while `REQ-BR-LGPD-016` carried
`applies: true` on the `sale_and_sharing` topic, the same topic the CCPA records
that *do* create the right carry.

Nothing could tell them apart, so a Brazilian visitor was offered a sale opt-out
the LGPD does not confer. Fixed on both sides:

- the record now carries `applies: false` and `requirement_type: definition`,
  with the reasoning in its `notes`. **No legal proposition was changed** — the
  requirement text is untouched;
- `Citation` now carries `applies`, so any consumer can distinguish a
  requirement from a recorded absence without re-reading the matrix.

## Consent evidence

A decision now records what it was taken under:

| Column | Why |
| --- | --- |
| `jurisdictions` | A snapshot. The operator's markets change; a record must keep meaning what it meant |
| `mechanism` | `banner`, `preference_centre`, `api` — operator vocabulary, unpoliced |
| `policy_config_version` | The configuration actually being served, so a record reads against what the visitor saw |
| `vendors` | Display names the surface showed. No hosts, nothing about the person |
| `proof_hash` | The receipt, below |

All nullable. Every record written before this has none, and backfilling a value
nobody observed would manufacture the evidence the columns exist to provide.

### The receipt, and what it is not

`proof_hash` is SHA-256 over a canonical serialisation, computed at write time.
Being precise about its standing matters more than the cryptography, because
"proof" is a word that does work it has not earned:

- **It is a receipt.** A principal who kept the digest can check that a record
  they are later shown is byte-for-byte the one issued. That is real, and it is
  why the field exists.
- **It is not a signature.** Nothing is signed, so it evidences integrity
  against accident and against third parties — not against the fiduciary.
- **It is not a chain.** Records are not linked; removing one leaves no gap.
- **It proves nothing against someone who can write the table**, who would
  recompute it. The append-only trigger is what guards that.

`RECEIPT_CAVEAT` states this on every receipt, so the limits travel with it.
`canonicalEvidence()` is exported so a principal can recompute it themselves — a
verification procedure only this repository can perform is not one.

## Rights requests

`POST /api/v1/rights/requests` is on the **browser plane and requires a consent
session**, for the reason recording a decision has since 6A: a public key ships
in page source and evidences nothing about who is asking. Without the session
anyone could file a deletion request naming somebody else's principal — a more
damaging forgery than a consent record.

A request is **accepted even where the matrix indicated nothing**. Refusing
because no requirement was found would turn an incomplete research artifact into
a reason to deny somebody a request, which is exactly backwards; that it was
accepted unsupported is visible in an empty `rule_references`.

The rules cited at the time are **snapshotted onto the request**. Which rules
were cited when somebody asked is part of the record; re-deriving later would
answer under a matrix that has since moved.

### Rift records; it does not fulfil

Nothing reaches into the customer's systems. Access and deletion touch data Rift
does not hold, and marking a request "completed" from its own tables would be
certifying something it cannot see. `resolution_note` is the operator's account
of what actually happened, and is the only record of it.

The request's **status is mutable** — it is a fact about what the operator has
done, and freezing it would mean a request could never be answered. What cannot
change is `kind`, the principal and `received_at`: what was asked, by whom, when.

## Retention is declared, never computed

`purposes.retention_note` and `purposes.retention_period` hold what the operator
writes. There is no default and no derivation: retention turns on the
processing, the regime and facts only the fiduciary holds. Null means *not
stated*, which a response reports as such rather than as "none".

`retention_period` is never parsed out of `retention_note` — a parser inferring
a period from prose would invent the number the field exists to avoid inventing.

## Limitations

- **No automated fulfilment.** No export bundle is produced, nothing is deleted,
  nothing is corrected. The workflow is recorded; the work is the operator's.
- **No identity verification beyond the consent session.** A session proves
  possession of a principal secret, not that a human is who they say — the same
  limit `docs/security.md` records for consent itself.
- **No statutory deadlines.** `due_at` is operator-declared. Response periods
  differ by regime and Rift does not compute one.
- **No dashboard screen yet.** Requests are visible over the API; a queue UI is
  not built.
- **`indicated` is not "this right exists"**, as above. It is a prompt to offer
  a control and read the citation.
- **The receipt is not a chain.** Per-record integrity only.
- **Old records carry no evidence**, and are distinguishable from new ones with
  none only by their age.

## Verification

```bash
npm run test:unit         # 570 tests; 29 are rights availability and receipts
npm run test:integration  # includes rights-requests.test.ts (22 tests)
```
