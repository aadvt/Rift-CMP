# Matrix Coverage

What the machine-readable matrix currently contains, what it does not, and which
absences are real gaps rather than correct answers.

Research artifact, not legal advice.

Regenerate the table with:

```bash
node docs/regulations/tools/validate.mjs
```

## Status

| | |
| --- | --- |
| Requirements | 81 |
| Regimes | 7 |
| Sources registered | 25 |
| Canonical topics | 21 |
| Vocabulary version | 1.0.0 |
| `requirement_type` populated | 81/81 |
| `authority_level` populated | 81/81 |
| `regions` populated | 81/81 |
| Requirements with a resolvable source | 81/81 |

## Topic coverage by regime

`x` = at least one requirement. `-` = none. See the next section before reading
any `-` as a defect.

| Topic | LGPD | CCPA | ePrivacy | GDPR | DPDP Act | DPDP Rules | US model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| applicability | x | x | - | x | x | - | x |
| lawful_basis | x | – | - | x | x | - | – |
| consent | - | - | - | x | x | x | - |
| withdrawal | - | - | - | - | x | - | - |
| notice | - | x | - | x | x | - | x |
| rights | x | x | – | x | x | - | x |
| sensitive_data | x | x | - | x | - | - | x |
| children | x | x | - | x | x | x | x |
| retention | x | x | - | x | - | - | - |
| international_transfer | x | - | - | x | x | - | - |
| tracking_and_storage | - | - | x | - | - | - | - |
| direct_marketing | - | - | x | - | - | - | - |
| sale_and_sharing | x | x | - | – | – | – | x |
| opt_out_signals | - | x | - | – | – | – | - |
| non_discrimination | - | x | - | – | – | – | - |
| automated_decision_making | - | x | - | - | - | - | - |
| security | x | - | - | x | x | x | - |
| vendor_relationship | x | - | - | x | x | - | x |
| accountability | x | x | - | x | x | x | - |
| enforcement | x | - | - | x | x | - | - |
| effective_dates | - | - | - | - | - | x | x |

`–` marks an absence that is expected rather than missing; see below.

## Absences that are answers, not gaps

A blank cell can mean the regime has no such concept. Recording these as gaps
would push a future engine toward inventing requirements to fill them.

- **CCPA has no `lawful_basis`.** It does not operate a lawful-basis regime of
  the GDPR kind. A future engine must not look for one, and must not treat its
  absence as "consent required by default".
- **GDPR, DPDP and the US model have no `sale_and_sharing`,
  `opt_out_signals` or `non_discrimination` in the CCPA sense.** These are
  California constructs. The generic US state model carries its own
  sale/sharing analogue, which is why that column is marked.
- **ePrivacy has no `rights` of its own.** Individual rights for the underlying
  personal data come from the GDPR; ePrivacy adds confidentiality and consent
  requirements on top. Its interaction with GDPR is recorded in
  [`../conflicts/conflicts.md`](../conflicts/conflicts.md).

## Real gaps

These are conversion gaps: the prose research covers the topic, the matrix does
not yet carry a structured record for it.

### EU-ePrivacy — the largest gap

**3 requirements, 2 topics**, from the longest regime document in the set
(511 lines). Sections on confidentiality of communications, traffic and location
data, transparency, withdrawal, vendors, enforcement and exceptions are all
written up and none has a matrix record.

This gap matters more than its size suggests: ePrivacy is the regime that
actually governs cookies and terminal-equipment storage, which is the core of
what a consent management platform does.

### India DPDP Rules — 7 requirements, 5 topics

Consent managers, data-principal rights procedures, grievance redressal, breach
notification, DPIA and audit obligations are documented in prose without
structured records.

### Uncited registered sources

Five sources are registered but no requirement cites them, which usually means
the material they cover has not been converted:

| Source | Regime |
| --- | --- |
| `SRC-EP-EC` | EU-ePrivacy |
| `SRC-IN-DPDP-RULES-MEITY` | India-DPDP-Rules |
| `SRC-CA-CCPA-REGS-2023` | California-CCPA-CPRA |
| `SRC-BR-ANPD-REGULATIONS` | Brazil-LGPD |
| `SRC-BR-ANPD-SMALL-AGENTS-2-2022` | Brazil-LGPD |

`SRC-CA-CCPA-REGS-2023` is the exception: the register marks it historical, so
having no current requirement cite it is expected.

`SRC-US-STATE-MODEL` has no URL because it is not a published instrument. It is
a model assembled during research, and every requirement resting on it carries
`authority_level: "derived"`.

## Fields still thinly populated

Present on some records, absent on most. A future engine must treat absence as
"not recorded" and never as "not required".

| Field | Populated |
| --- | --- |
| `consent` | 25/81 |
| `legal_bases` | 16/81 |
| `contexts` | 18/81 |
| `purposes` | 7/81 |
| `opt_out` | 5/81 |
| `children` | 6/81 |

`consent` rose from 7 to 25 during conversion because the CSV carried a
`consent_required` column that the JSON had never absorbed. The rest are only
populated where the underlying research stated them explicitly; they were not
inferred, because inferring a legal basis is exactly the judgement this phase is
not supposed to make.

## What was reconciled during conversion

- The CSV and JSON had diverged: 81 rows against 58 records. The 23 CSV-only
  rows are now promoted into the JSON.
- **Every source id in the CSV was dangling.** It used a superseded identifier
  scheme (`SRC-EU-GDPR-001`) against a register that had moved to descriptive
  ids (`SRC-GDPR-EURLEX`). Nothing failed, because nothing read the CSV
  programmatically. Reconciled through
  [`../sources/source-id-aliases.json`](../sources/source-id-aliases.json), where
  one mapping is flagged as needing human confirmation.
- `topic` was free text with 45 values containing synonym clusters
  (`international_transfer`/`international_transfers`,
  `children`/`minors`/`children_and_adolescents`, and others). It is now
  constrained to 21 canonical topics, with the original term preserved.
- The CSV is now generated from the JSON, so the two cannot diverge again.
