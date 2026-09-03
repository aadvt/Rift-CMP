# Regulation Requirement Matrix

This directory contains the machine-readable privacy regulation requirement matrix used by Rift-CMP.

## Files

- `requirements.csv` — tabular representation for review and analysis.
- `requirements.json` — structured representation for application and validation.

## Purpose

The matrix maps privacy requirements across multiple regimes without reducing regulatory obligations to a single consent flag.

Each requirement may depend on:

- Regulation or regime
- Applicability triggers
- Covered actors
- Region
- Legal basis
- Processing purpose
- Data category
- Processing context
- Consent requirements
- Opt-out requirements
- Exceptions and conditions
- Effective dates
- Policy versions
- Source references

## MVP Regimes

- GDPR
- EU ePrivacy
- India DPDP Act
- India DPDP Rules
- California CCPA/CPRA
- Generic US State Privacy Model
- Brazil LGPD

## Research Rules

1. Requirements must be traceable to source IDs.
2. Primary sources should be preferred.
3. Important requirements should be cross-checked with authoritative independent sources where available.
4. Legal ambiguity must not be silently resolved.
5. National implementation differences must remain distinguishable from EU-level requirements.
6. Effective dates and policy versions must be preserved.
7. Generic US-state entries are modeling abstractions, not statements of individual state law.
8. The matrix is research/specification data and is not legal advice.

## Architectural Constraint

Do not implement regulatory logic as:

```text
consent_required = true|false