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
| Requirements | 102 |
| Regimes | 7 |
| Sources registered | 26 |
| Canonical topics | 21 |
| Vocabulary version | 1.0.0 |
| `requirement_type` populated | 102/102 |
| `authority_level` populated | 102/102 |
| `regions` populated | 102/102 |
| Requirements with a resolvable source | 102/102 |

## Topic coverage by regime

`x` = at least one requirement. `-` = none. See the next section before reading
any `-` as a defect.

| Topic | LGPD | CCPA | ePrivacy | GDPR | DPDP Act | DPDP Rules | US model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| applicability | x | x | x | x | x | - | x |
| lawful_basis | x | – | – | x | x | - | – |
| consent | - | - | x | x | x | x | - |
| withdrawal | - | - | x | - | x | - | - |
| notice | - | x | x | x | x | - | x |
| rights | x | x | – | x | x | - | x |
| sensitive_data | x | x | – | x | - | - | x |
| children | x | x | x | x | x | x | x |
| retention | x | x | x | x | - | - | - |
| international_transfer | x | - | - | x | x | - | - |
| tracking_and_storage | - | - | x | - | - | - | - |
| direct_marketing | - | - | x | - | - | - | - |
| sale_and_sharing | x | x | – | – | – | – | x |
| opt_out_signals | - | x | – | – | – | – | - |
| non_discrimination | - | x | – | – | – | – | - |
| automated_decision_making | - | x | - | - | - | - | - |
| security | x | - | - | x | x | x | - |
| vendor_relationship | x | - | x | x | x | - | x |
| accountability | x | x | - | x | x | x | - |
| enforcement | x | - | x | x | x | - | - |
| effective_dates | - | - | x | - | - | x | x |

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
- **ePrivacy has no `lawful_basis` regime and no `sensitive_data` category.**
  Article 5(3) states a consent requirement with statutory exceptions; it does
  not enumerate lawful bases the way GDPR Article 6 does, and the research
  states that special-category requirements come from the GDPR rather than from
  ePrivacy. An engine must not read either blank as "unconstrained".
- **ePrivacy has no standalone children's regime**, but that answer is now
  recorded rather than implied: `REQ-EP-023` carries
  `applicability.applies: false` and says so explicitly, so the `x` in the
  children row is a statement of absence, not a rule.

## Conversion status and remaining gaps

A conversion gap is where the prose research covers a topic and the matrix does
not yet carry a structured record for it. ePrivacy was the largest such gap
after Phase 6B and is now converted; the DPDP Rules are not.

### EU-ePrivacy — converted in Phase 6C

**24 requirements, 11 topics** (was 3 requirements, 2 topics). The prose sections
on scope, Article 5(3) technical scope, consent standards and prior activation,
both Article 5(3) exceptions, traffic data, location data, direct marketing and
its existing-customer exception, transparency, withdrawal, vendors, enforcement,
Article 15 restrictions, the GDPR relationship, national transposition and
versioning now each carry a structured record.

The prose numbers its own summary rows `EP-001`–`EP-011` (section 19 of
[`../regimes/eu-eprivacy.md`](../regimes/eu-eprivacy.md)), which does not line up
with the `REQ-EP-###` ids — those were assigned before the summary table was
converted and are not renumbered, because ids are referenced elsewhere. The
mapping is:

| Prose | Matrix record |
| --- | --- |
| EP-001 consent before terminal-equipment storage/access | `REQ-EP-002`, `REQ-EP-009` |
| EP-002 no pre-ticked consent choices | `REQ-EP-007` |
| EP-003 clear and informed consent mechanisms | `REQ-EP-008`, `REQ-EP-016` |
| EP-004 transmission-only operations without consent | `REQ-EP-010` |
| EP-005 strictly necessary requested-service operations | `REQ-EP-011` |
| EP-006 communications confidentiality | `REQ-EP-001` |
| EP-007 traffic-data restrictions | `REQ-EP-012` |
| EP-008 location-data restrictions | `REQ-EP-013` |
| EP-009 direct-marketing requirements | `REQ-EP-003`, `REQ-EP-014`, `REQ-EP-015` |
| EP-010 GDPR applies where personal data is processed | `REQ-EP-021` |
| EP-011 track national implementation separately | `REQ-EP-020` |

Scope and applicability records (`REQ-EP-004`, `REQ-EP-005`, `REQ-EP-006`,
`REQ-EP-022`), the children answer (`REQ-EP-023`), vendors (`REQ-EP-018`),
enforcement (`REQ-EP-019`), withdrawal (`REQ-EP-017`) and versioning
(`REQ-EP-024`) come from the body of the research rather than from its summary
table.

#### What remains open for ePrivacy

These are recorded on the records themselves, not resolved:

- **Article 13(1) communication types.** `REQ-EP-014` states that prior consent
  is required for *certain* electronic communications. The research does not
  enumerate which, so the record does not either. This must be resolved before
  direct marketing can be evaluated automatically.
- **National transposition is not modelled.** Every ePrivacy record is
  Directive-level. `REQ-EP-020` records the obligation to track national law
  separately; no national instrument is registered, so the matrix cannot yet
  answer a Member-State question. This is the single largest remaining ePrivacy
  gap.
- **`authority_level` has no value for a binding CJEU judgment.** The vocabulary
  offers `statute`, `delegated`, `regulator_guidance` and `derived`, and the
  derivation maps the register's `independent_authoritative` type onto
  `regulator_guidance` — which understates a CJEU judgment. `REQ-EP-007`
  (Planet49) therefore derives `statute` from the Directive it cites and carries
  a `FLAG:` note. Adding a vocabulary value is a schema change and was left for
  review rather than made unilaterally.
- **EDPB Guidelines 05/2020 on consent are not registered.** The research names
  them (section 2.3) but gives no URL or adoption date, so no source entry was
  created and `REQ-EP-008` cites the Directive and the GDPR instead.
- **`SRC-EP-EC` remains uncited by design.** The European Commission page is
  registered as `official_information` and the research does not rest any
  proposition on it. Citing it to clear the validator warning would fabricate a
  citation; the warning is left standing and explained here.
- The seven open questions in section 20 of the regime document (emerging
  tracking technologies, analytics under the exceptions, which Member State's
  transposition applies, divergent national interpretation, browser/device-level
  preference signals, new technical mechanisms, consent-or-pay) are unresolved
  in the research and are unresolved in the matrix.

### India DPDP Rules — 7 requirements, 5 topics

Consent managers, data-principal rights procedures, grievance redressal, breach
notification, DPIA and audit obligations are documented in prose without
structured records.

### Uncited registered sources

Five sources are registered but no requirement cites them, which usually means
the material they cover has not been converted:

| Source | Regime | Why |
| --- | --- | --- |
| `SRC-EP-EC` | EU-ePrivacy | Contextual only; nothing rests on it. Expected. |
| `SRC-IN-DPDP-RULES-MEITY` | India-DPDP-Rules | Not converted. |
| `SRC-CA-CCPA-REGS-2023` | California-CCPA-CPRA | Register marks it historical. Expected. |
| `SRC-BR-ANPD-REGULATIONS` | Brazil-LGPD | Not converted. |
| `SRC-BR-ANPD-SMALL-AGENTS-2-2022` | Brazil-LGPD | Not converted. |

`SRC-EP-EURLEX-2009-136` was added to the register in Phase 6C and carries no
`retrieved_date`, which the validator warns about. The entry records a reference
the research had already made; the document was not re-retrieved during
conversion, and claiming a retrieval date would be false.

`SRC-US-STATE-MODEL` has no URL because it is not a published instrument. It is
a model assembled during research, and every requirement resting on it carries
`authority_level: "derived"`.

## Fields still thinly populated

Present on some records, absent on most. A future engine must treat absence as
"not recorded" and never as "not required".

| Field | Populated |
| --- | --- |
| `consent` | 34/102 |
| `legal_bases` | 22/102 |
| `contexts` | 39/102 |
| `purposes` | 10/102 |
| `opt_out` | 5/102 |
| `children` | 6/102 |

`consent` rose from 7 to 25 in Phase 6B because the CSV carried a
`consent_required` column that the JSON had never absorbed, and to 34 in Phase
6C from the ePrivacy records. The rest are only populated where the underlying
research stated them explicitly; they were not inferred, because inferring a
legal basis is exactly the judgement these phases are not supposed to make.

`opt_out` is still empty for every ePrivacy record. The research treats
withdrawal, GDPR objection and marketing opt-out as distinct concepts and warns
against conflating them, so `REQ-EP-017` records withdrawal and no ePrivacy
record asserts an opt-out.

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

## What was reconciled in Phase 6C

- **The requirement schema had gone stale and nothing noticed.**
  `schemas/requirement.schema.json` declared `additionalProperties: false` while
  `normalise.mjs` was adding `topic_canonical`, `legal_bases_canonical`,
  `data_categories_canonical` and `applicability.covered_actors_canonical`, and
  it carried its own enums for `requirement_type`
  (`statutory`/`regulatory`/`official_guidance`/`derived_model`) and
  `authority_level` (`binding_law`/`regulation`/`official_guidance`/`research_model`)
  that had drifted away from the values the vocabulary actually defines and the
  data actually uses. `consent.required` was typed `boolean` while the design
  and the generated TypeScript both allow `"conditional"`. Every one of the 81
  records was invalid against its own schema, and no error was ever produced
  because `validate.mjs` read only the schema's `required` list.

  Fixed by making the vocabulary the single authority for enumerated values —
  the schema no longer re-declares them — declaring the four canonical fields,
  and widening `consent.required`. `validate.mjs` gained a check (section 8)
  that fails if a record carries a field the schema does not declare, or if the
  schema re-introduces an enum the vocabulary owns, so the two cannot drift
  apart silently again. No requirement data was changed by this.

- **`location_data` added to the vocabulary** as an `EU-ePrivacy` regime term
  mapping to `communications_data` with relation `narrower`. Article 9 governs
  location data other than traffic data under different conditions from Article
  6, and the existing `traffic_data` term could not carry `REQ-EP-013` without
  asserting they are the same thing.

- **`SRC-EP-EURLEX-2009-136` registered.** The research names Directive
  2009/136/EC as a primary source and as the origin of the current Article 5(3)
  wording, but the register did not carry it, so Article 5(3) records could not
  cite the instrument whose text they restate.
