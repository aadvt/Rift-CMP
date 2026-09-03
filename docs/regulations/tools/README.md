# Regulation Matrix Tooling

Scripts that convert the regulation research into machine-readable artifacts and
keep them internally consistent. Node 18+, no dependencies.

**`matrix/requirements.json` is the single source of truth.** The CSV and the
TypeScript module are generated from it. Editing a generated file is pointless —
the next build overwrites it — and it is how the two matrix representations
drifted apart in the first place.

## Pipeline

```bash
# 1. promote any rows that exist only in the CSV (one-off; already run)
node docs/regulations/tools/promote-csv.mjs --write

# 2. canonicalise topics, fill derived fields, stabilise key order
node docs/regulations/tools/normalise.mjs --write

# 3. regenerate requirements.csv and the TypeScript module
node docs/regulations/tools/build.mjs

# 4. check structure, vocabulary, citations and dates
node docs/regulations/tools/validate.mjs
```

Run 2 → 3 → 4 after any edit to `requirements.json`. Step 4 exits non-zero on
error, so it can gate a build.

## What each script does

### `normalise.mjs`

Adds canonical fields **beside** regime-specific ones; it never overwrites a
regime's own term. A DPDP record keeps `digital_personal_data` and gains
`data_categories_canonical: ["personal_data"]`. Overwriting would assert an
equivalence between regimes that no source states.

It also fills three fields mechanically:

| Field | Derived from |
| --- | --- |
| `requirement_type` | the canonical topic |
| `authority_level` | the cited source's `source_type` in the register |
| `regions` | the regime's own jurisdiction |

None of these is a legal judgement. Anything that cannot be derived is left null
and reported, never guessed.

### `build.mjs`

Regenerates `matrix/requirements.csv` and `generated/{requirements,vocabulary}.ts`.

The TypeScript output is **data and types only**. It contains no evaluation
logic: deciding which requirements apply to a situation is the regulation
engine's job, and that is a later phase.

`ConsentRequirement.required` is typed `boolean | "conditional"` on purpose. A
consumer that cannot represent `"conditional"` should surface it for a human
rather than coerce it to a boolean.

### `validate.mjs`

Checks required fields, id uniqueness and format, controlled-vocabulary
conformance, source resolution, ISO dates, `effective_from <= effective_to`,
CSV/JSON agreement, and that `schemas/requirement.schema.json` still describes
the data.

That last check was added in Phase 6C after the schema was found to have gone
stale: it declared `additionalProperties: false` while `normalise.mjs` added
four canonical fields, and re-declared enums for `requirement_type` and
`authority_level` that had drifted from the vocabulary. Every record was invalid
against its own schema and nothing said so, because only the schema's `required`
list was ever read. The vocabulary is now the sole authority for enumerated
values, and the validator fails if the schema re-declares one or if a record
carries a field the schema does not declare.

It validates **structure and internal consistency only**. It cannot check that
the law is stated correctly; that needs a human with the sources open.

Every check exists because its failure would otherwise be silent. A dangling
source id or a typo'd topic crashes nothing — the engine just stops matching and
returns "no requirement applies", which reads exactly like a clean bill of
health.

### `promote-csv.mjs`

One-off reconciliation, already applied. Kept because it documents what was done
and would be needed again if rows are ever added to the CSV by hand.

It converts using only what the CSV states, preserves any column with no
structured counterpart verbatim in `notes`, and refuses to promote a row whose
source cannot be resolved — a requirement with an unresolvable citation is worse
than a missing one, because it looks checkable and is not.

## Adding a requirement

1. Add the record to `matrix/requirements.json`.
2. Cite at least one `source_id` that exists in `sources/sources.json`.
3. Use vocabulary terms from `schemas/vocabulary.json`; add a new canonical term
   there first if none fits, rather than inventing one inline.
4. Run steps 2 → 3 → 4 above.

Leave a field out rather than filling it with a plausible value. Absence is read
downstream as "not recorded"; a wrong value is read as fact.
