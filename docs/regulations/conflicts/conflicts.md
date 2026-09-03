# Regulation Conflicts & Ambiguities

## Purpose

This document records material conflicts, ambiguities, interpretation differences, and source-level inconsistencies identified during privacy regulation research.

This is a research artifact, not legal advice.

## Status Values

- `open` — unresolved and requires further research or legal review
- `documented` — conflict or ambiguity is recorded with supporting sources
- `resolved_for_model` — a modeling decision has been made without claiming that the underlying legal issue is universally resolved
- `superseded` — the issue was based on an older legal or regulatory version

## Recording Rules

1. Do not silently resolve legal ambiguity.
2. Cite the exact source supporting each side of a conflict.
3. Record the applicable legal version and effective date.
4. Distinguish binding law from official guidance and derived interpretation.
5. Do not convert unresolved questions into boolean enforcement rules.
6. Where national implementation differs, record the jurisdiction explicitly.
7. If a later amendment, regulation, or corrigendum changes the issue, retain the historical entry and mark its status accordingly.

---

## Conflict Register

| Conflict ID | Regime | Topic | Issue | Source A | Source B | Status | Modeling Decision |
|---|---|---|---|---|---|---|---|
| CONFLICT-001 | EU-ePrivacy | Terminal equipment / cookies | Article 5(3) of Directive 2002/58/EC establishes conditions for storing or accessing information on terminal equipment, while practical implementation depends on national transposition and applicable Member State law. | SRC-EP-EURLEX | SRC-EP-EC | documented | Do not model EU ePrivacy as a single uniform national cookie rule. Store the EU Directive requirement separately from Member State implementation. |
| CONFLICT-002 | EU-ePrivacy | Analytics / tracking | Whether a particular analytics or tracking technology requires prior consent depends on the technology, purpose, implementation, and applicable national law. A blanket rule that all analytics requires consent is not supported. | SRC-EP-EURLEX | SRC-EP-EC | open | Do not create a universal `analytics_consent_required` boolean. Model the relevant technology, purpose, access/storage operation, and jurisdiction. |
| CONFLICT-003 | GDPR / EU-ePrivacy | Relationship between regimes | GDPR and Directive 2002/58/EC address related but distinct requirements. The ePrivacy Directive does not simply become a duplicate GDPR consent layer. | SRC-GDPR-EURLEX | SRC-EP-EURLEX | documented | Represent GDPR and EU ePrivacy as separate regimes that may apply simultaneously. |
| CONFLICT-004 | India-DPDP-Act | Commencement | The DPDP Act was enacted in 2023, but provisions have phased commencement under the notified commencement framework. | SRC-IN-DPDP-ACT | SRC-IN-DPDP-ACT-COMMENCEMENT | documented | Store commencement at provision/rule level rather than treating the entire Act as effective on one date. |
| CONFLICT-005 | India-DPDP-Rules | Rule commencement | The final DPDP Rules, 2025 establish phased commencement for individual Rules rather than a single universal effective date. | SRC-IN-DPDP-RULES | SRC-IN-DPDP-RULES-CORRIGENDUM | documented | Requirements must carry provision-specific effective dates where applicable. |
| CONFLICT-006 | India-DPDP-Rules | Corrigendum | The notified Rules were followed by an official corrigendum. The final research dataset must account for the corrigendum when interpreting affected provisions. | SRC-IN-DPDP-RULES | SRC-IN-DPDP-RULES-CORRIGENDUM | documented | Treat the corrigendum as part of the source/version chain and validate affected text before enforcement. |
| CONFLICT-007 | California-CCPA-CPRA | Regulatory version | California regulatory requirements changed between the March 2023 regulatory version and the framework effective January 1, 2026. | SRC-CA-CCPA-REGS-2023 | SRC-CA-CCPA-REGS-2026 | documented | Preserve historical versions and associate requirements with effective dates and policy versions. |
| CONFLICT-008 | California-CCPA-CPRA | Child-related requirements | California contains age-specific requirements that differ from the general consumer-rights model, including requirements concerning consumers under 13 and consumers aged 13–15. | SRC-CA-CCPA-STATUTE-2026 | SRC-CA-CCPA-REGS-2026 | documented | Model age bands explicitly rather than using a single `children = true/false` field. |
| CONFLICT-009 | Brazil-LGPD | Legal bases | LGPD provides multiple legal bases for ordinary personal-data processing and additional conditions for sensitive personal data. | SRC-BR-LGPD | SRC-BR-ANPD-REGULATIONS | documented | Do not reduce LGPD processing legality to consent. Represent legal bases and data categories independently. |
| CONFLICT-010 | Brazil-LGPD | International transfers | International transfers require an LGPD legal basis and an applicable transfer mechanism under the ANPD framework. | SRC-BR-LGPD | SRC-BR-ANPD-TRANSFERS-19-2024 | documented | Model transfer authorization and transfer mechanism as separate requirements. |
| CONFLICT-011 | Brazil-LGPD | Small processing agents | ANPD provides differentiated regulatory treatment for qualifying small processing agents, subject to applicable conditions and exceptions. | SRC-BR-ANPD-SMALL-AGENTS-2-2022 | SRC-BR-LGPD | documented | Model small-agent status as an applicability condition rather than a blanket exemption from LGPD. |
| CONFLICT-012 | Brazil-LGPD | Administrative sanctions | LGPD statutory sanctions operate together with ANPD's administrative sanction and dosimetry framework. | SRC-BR-LGPD | SRC-BR-ANPD-SANCTIONS-4-2023 | documented | Store statutory enforcement powers separately from regulatory penalty calculation rules. |

---

## Modeling Principles for Unresolved Issues

### 1. No Universal Consent Boolean

The research model must not use a single field such as:

```text
consent_required = true

## 2026-09-03 Verification Updates

The final verification pass identified the following source/version corrections:

- **CONFLICT-013 — Brazil LGPD effective dates:** The LGPD did not become generally effective only on 2021-08-01. ANPD's official FAQ states that the institutional provisions entered into force on 2018-12-28, the remaining provisions (excluding administrative sanctions) on 2020-09-18, and Articles 52–54 on 2021-08-01. The matrix therefore uses 2020-09-18 for substantive LGPD requirements and 2021-08-01 for administrative sanctions.
- **CONFLICT-014 — Brazil international transfers:** ANPD Resolution 19/2024 remains in force with the 2025 corrigendum, and Resolution 32/2026 now recognizes the European Union and specified EEA destinations as adequate for LGPD transfer purposes. Adequacy must remain distinct from the underlying lawful basis for processing.
- **CONFLICT-015 — EU ePrivacy technical scope:** EDPB Guidelines 2/2023 final version 2.0, published 2024-10-16, should be used as current official guidance for Article 5(3) technical scope. The guidance does not create a universal rule that every analytics implementation requires consent.
- **CONFLICT-016 — India DPDP commencement:** The Act and Rules use phased commencement periods. The matrix uses computed calendar dates (2026-11-13 and 2027-05-13) only as modeling values and preserves the authoritative commencement periods in the source notes.
