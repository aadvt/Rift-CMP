# Regulation Research Decision Log

## Purpose

Record important decisions made during regulation research and requirement normalization.

## Decisions

### 1. Primary Sources First

Official legislation, regulations, government publications, and regulator guidance are preferred.

Secondary sources are used only for context or independent cross-checking.

### 2. No Legal Requirement Guessing

If a requirement cannot be verified from authoritative sources, it must be marked as:

- Unknown
- Requires further research
- Ambiguous

It must not be presented as a confirmed requirement.

### 3. Preserve Jurisdiction-Specific Meaning

Similar legal concepts must not automatically be treated as equivalent.

Examples:

- GDPR legal basis ≠ CCPA consent
- Opt-out ≠ consent withdrawal
- Sale ≠ sharing
- Controller ≠ business
- Processor ≠ service provider

### 4. No Single Consent Flag

The regulation model must not use a single global:

`consent_required = true/false`

Requirement evaluation may depend on:

- Regulation
- Purpose
- Data category
- Processing context
- Legal basis
- User choice
- Region
- Exceptions
- Effective date
- Policy version

### 5. Multiple Regulations May Apply

A single processing activity may be subject to multiple regulations simultaneously.

The future policy engine must therefore support multiple applicable requirements.

### 6. Effective Dates Matter

Requirements must be associated with their applicable effective date and policy version.

Future amendments must not silently overwrite historical requirements.

### 7. Conflicting Sources

When authoritative sources conflict, the conflict must be documented in:

`conflicts/conflicts.md`

No conflict should be silently resolved.

### 8. Research Before Enforcement

Phase 6B is limited to:

- Legal research
- Requirement extraction
- Source verification
- Requirement normalization
- Comparison matrix design

Runtime enforcement is outside the scope of Phase 6B.

### 9. Product vs Legal Interpretation

The research documents describe regulatory requirements for product design.

They do not provide legal advice or determine whether a specific organization's processing is legally compliant.

### 10. Future Regulation Support

The data model should be extensible so additional jurisdictions and regulations can be added without redesigning the core requirement model.

## Final verification pass — 2026-09-03

The Phase 6B regulation artifacts were rechecked against current primary/official sources.

Key corrections:
- Brazil LGPD effective dates corrected to distinguish 2018-12-28 institutional provisions, 2020-09-18 substantive provisions, and 2021-08-01 Articles 52–54 sanctions.
- Brazil ANPD Resolution 32/2026 (EU/EEA adequacy recognition) added to the source register and international-transfer requirement.
- Brazil ANPD Resolutions 18/2024 (encarregado) and 15/2024 (security incidents) added to source traceability.
- India DPDP Act/Rules phased commencement is represented using provision/rule groups; computed calendar dates are explicitly marked as modeling calculations.
- EU ePrivacy final EDPB Guidelines 2/2023 version 2.0 and CJEU Planet49 were added as authoritative supporting sources.
- California 2026 regulatory requirements remain versioned separately from the historical 2023 regulations, with later compliance dates preserved for specified ADMT and audit obligations.

Runtime enforcement remains out of scope until the research requirements receive explicit product/legal approval.
