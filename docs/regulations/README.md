# Privacy Regulations Research

## Purpose

This directory contains Rift-CMP's privacy regulation research, legal requirement modeling, source registry, comparison matrices, schemas, and documented conflicts.

This is a research and product-specification artifact. It is not legal advice.

## MVP Tier 1 Regimes

The initial research scope covers:

1. GDPR
2. EU ePrivacy
3. India Digital Personal Data Protection Act, 2023
4. India Digital Personal Data Protection Rules, 2025
5. California CCPA/CPRA
6. Brazil LGPD

A generic US state privacy model is also maintained for future state-specific research.

## Directory Structure

```text
regulations/
├── README.md
├── methodology.md
├── glossary.md
├── decision-log.md
├── regimes/
│   ├── gdpr.md
│   ├── eu-eprivacy.md
│   ├── india-dpdp-act.md
│   ├── india-dpdp-rules.md
│   ├── california-ccpa-cpra.md
│   └── brazil-lgpd.md
├── us-state-model.md
├── matrix/
│   ├── requirements.csv
│   ├── requirements.json
│   └── README.md
├── sources/
│   ├── sources.json
│   └── source-register.md
├── conflicts/
│   └── conflicts.md
├── schemas/
│   ├── requirement.schema.json
│   ├── source.schema.json
│   ├── applicability.schema.json
│   ├── policy-version.schema.json
│   └── vocabulary.json          # controlled vocabulary; every enum resolves here
├── generated/                   # GENERATED - do not edit
│   ├── requirements.ts          # typed matrix data for a future engine
│   └── vocabulary.ts            # vocabulary as TypeScript union types
└── tools/
    ├── README.md
    ├── normalise.mjs            # canonicalise + fill derived fields
    ├── build.mjs                # regenerate csv + typescript
    ├── validate.mjs             # structural + referential checks
    └── promote-csv.mjs          # one-off csv -> json reconciliation
```

## Machine-readable artifacts

`matrix/requirements.json` is the single source of truth. `matrix/requirements.csv`
and everything under `generated/` are produced from it by
[`tools/build.mjs`](tools/README.md) and must not be hand-edited.

```bash
node docs/regulations/tools/validate.mjs   # exits non-zero on any inconsistency
```

Current state, and an honest account of what has and has not been converted, is
in [`matrix/coverage.md`](matrix/coverage.md). The largest remaining gap is
**EU-ePrivacy**, which has the longest regime document and only three structured
requirements — and is the regime that actually governs cookies.