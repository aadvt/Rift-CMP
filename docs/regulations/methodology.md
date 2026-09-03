# Regulation Research Methodology

## Purpose

This methodology defines how privacy regulations are researched, verified, normalized, and represented in the Rift CMP regulation requirement matrix.

This is a research/specification document, not legal advice.

## Research Principles

1. Do not hallucinate legal requirements.
2. Prefer official and primary legal sources.
3. Cross-check important requirements with at least one independent authoritative source.
4. Record source URLs and relevant publication, amendment, version, and effective dates.
5. Preserve legal ambiguity instead of silently resolving it.
6. Record conflicts between authoritative sources explicitly.
7. Distinguish legal requirements from product assumptions or implementation decisions.
8. Do not reduce a regulation to a single `consent_required` value.

## Source Priority

Use sources in the following order:

1. Official legislation, regulations, government publications, and regulator guidance.
2. Official regulatory authority guidance and enforcement decisions.
3. Courts or other authoritative governmental/legal sources.
4. Independent authoritative legal or standards sources.
5. Reputable secondary sources for context only.

Secondary sources must not override clear primary-source requirements.

## Requirement Extraction

For each regulation, identify:

- Applicability and territorial scope
- Covered entities and roles
- Covered data and processing
- Legal bases or authorization mechanisms
- Consent requirements
- Consent withdrawal
- Opt-out requirements
- Sensitive or special-category data
- Children's data
- Transparency and notice
- Individual rights
- Retention requirements
- International transfers
- Cookies and tracking technologies
- Sale, sharing, or targeted advertising
- Controller/processor or equivalent roles
- Vendor requirements
- Enforcement and penalties
- Effective dates and amendments

## Normalization

Legal concepts are normalized into common internal categories while preserving jurisdiction-specific meaning.

Examples:

- Legal basis
- Consent
- User choice
- User right
- Processing purpose
- Data category
- Applicability trigger
- Exception
- Condition
- Retention rule
- Transfer rule
- Tracking rule
- Vendor rule

Normalization must not imply that legally different concepts are equivalent.

## Rule Representation

Requirements should support:

- Multiple applicable regulations
- Multiple legal bases
- Multiple purposes
- Data-category-specific rules
- Context-specific rules
- Region-specific rules
- Exceptions and conditions
- Effective dates
- Policy versions

A rule may therefore be conditional rather than universally applicable.

## Evidence Requirements

Every researched requirement should have:

- Regulation
- Requirement description
- Source reference
- Source type
- Publication/version date where available
- Effective date where applicable
- Confidence level
- Notes on conditions or ambiguity

Important requirements should have independent authoritative cross-checking.

## Conflicts and Ambiguity

If authoritative sources conflict:

1. Record each interpretation.
2. Record the sources supporting each interpretation.
3. Do not silently choose one.
4. Mark the issue in `conflicts/conflicts.md`.
5. Identify what additional legal interpretation or future research is required.

## Versioning

Requirements must be associated with the relevant legal or policy version.

Changes caused by amendments, regulations, guidance, court decisions, or effective-date transitions should be recorded as separate versions where necessary.

Historical requirements must not be overwritten without preserving their previous state.

## Product Boundary

Phase 6B produces research artifacts and normalized requirements only.

It does not implement:

- Runtime consent enforcement
- Cookie blocking
- Policy evaluation
- Automated legal decisions
- User-facing legal advice

Implementation decisions should be based on the completed research matrix and explicitly documented separately.