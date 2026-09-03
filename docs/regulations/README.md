# Regulation Research

This directory contains the research and specification layer for privacy and data-protection regulations used by Rift-CMP.

## Status

**Phase:** 6B — Global Regulation Research & Requirement Matrix

**Status:** Research/specification only.

The contents of this directory are not legal advice and must not be treated as final legal determinations.

## MVP Regimes

- GDPR
- EU ePrivacy
- India DPDP Act
- India DPDP Rules
- California CCPA/CPRA
- Brazil LGPD
- Generic US State Privacy Model

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
└── schemas/
    ├── requirement.schema.json
    ├── source.schema.json
    ├── applicability.schema.json
    └── policy-version.schema.json