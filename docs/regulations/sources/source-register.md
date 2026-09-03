# Source Register

## Purpose

This register records the authoritative and supporting sources used for the regulation research and requirement matrix.

Each requirement in the product should be traceable to one or more registered sources.

---

## Source Record Format

| Field | Description |
|---|---|
| `source_id` | Unique stable identifier |
| `regime` | Regulation/jurisdiction |
| `source_type` | Statute, regulation, official guidance, regulator guidance, secondary authority |
| `title` | Official source title |
| `publisher` | Issuing authority |
| `identifier` | Law/regulation/document number |
| `publication_date` | Publication/adoption date |
| `effective_date` | Effective/application date |
| `version` | Version/amendment identifier |
| `authority_level` | Primary / Secondary |
| `notes` | Scope, limitations, or interpretation notes |

---

## Registered Sources

### GDPR

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-EU-GDPR-001` | General Data Protection Regulation | EU / European Parliament & Council | Regulation (EU) 2016/679 | Primary |
| `SRC-EU-GDPR-002` | European Commission — Legal Framework for EU Data Protection | European Commission | Current guidance | Secondary / Official Guidance |
| `SRC-EU-GDPR-003` | EDPB — Legal Framework | European Data Protection Board | Current guidance | Secondary / Official Guidance |

---

### EU ePrivacy

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-EU-EP-001` | Directive on privacy and electronic communications | European Parliament & Council | Directive 2002/58/EC | Primary |
| `SRC-EU-EP-002` | National implementing legislation | EU Member States | State-specific | Primary |
| `SRC-EU-EP-003` | EDPB / national DPA guidance on electronic communications and tracking | EDPB / National DPAs | Current guidance | Secondary / Official Guidance |

**Important:** ePrivacy is a Directive. National implementation must be tracked separately from the EU Directive.

---

### India — DPDP Act

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-IN-DPDP-ACT-001` | Digital Personal Data Protection Act| 2023 | Government of India / Parliament | Act No. 22 of 2023 | Primary |
| `SRC-IN-DPDP-ACT-002` | DPDP Act commencement notification | Government of India / MeitY | G.S.R. 843(E), 13 Nov 2025 | Primary |
| `SRC-IN-DPDP-ACT-003` | MeitY DPDP implementation material | MeitY | Current official material | Secondary / Official Guidance |

---

### India — DPDP Rules

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-IN-DPDP-RULES-001` | Digital Personal Data Protection Rules, 2025 | Government of India / MeitY | G.S.R. 846(E), 13 Nov 2025 | Primary |
| `SRC-IN-DPDP-RULES-002` | DPDP Rules explanatory note | MeitY | 2025 | Secondary / Official Explanation |
| `SRC-IN-DPDP-RULES-003` | DPDP Rules corrigendum | Government of India / MeitY | 16 Dec 2025 | Primary |

**Important:** The explanatory note is not itself part of the Rules and must not be treated as controlling legal text.

---

### California — CCPA / CPRA

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-CA-CCPA-001` | California Consumer Privacy Act | State of California | Cal. Civ. Code §§ 1798.100–1798.199 | Primary |
| `SRC-CA-CCPA-002` | California Privacy Rights Act | State of California / Proposition 24 | 2020 amendments | Primary |
| `SRC-CA-CCPA-003` | CCPA Regulations | California Privacy Protection Agency | Title 11, Division 6 | Primary |
| `SRC-CA-CCPA-004` | CPPA regulatory amendments | California Privacy Protection Agency | Effective Jan. 1, 2026 | Primary |
| `SRC-CA-CCPA-005` | CCPA guidance | California Attorney General | Current guidance | Secondary / Official Guidance |

---

### Brazil — LGPD

| Source ID | Source | Authority | Identifier / Version | Status |
|---|---|---|---|---|
| `SRC-BR-LGPD-001` | Lei Geral de Proteção de Dados Pessoais | Government of Brazil | Lei nº 13.709/2018 | Primary |
| `SRC-BR-LGPD-002` | ANPD regulations and resolutions | ANPD | Current regulations | Primary |
| `SRC-BR-LGPD-003` | Regulation on International Transfers | ANPD | Resolution CD/ANPD nº 19/2024 | Primary |
| `SRC-BR-LGPD-004` | Administrative Sanctions and Dosimetry Regulation | ANPD | Resolution CD/ANPD nº 4/2023 | Primary |
| `SRC-BR-LGPD-005` | EU adequacy recognition | ANPD | Resolution CD/ANPD nº 32/2026 | Primary |

---

## U.S. State Privacy Model

The generic U.S. state model must not rely on one source.

Each state should receive its own source records.

Minimum fields:

```text
state
law_name
statute_identifier
regulation_identifier
regulator
publication_date
effective_date
enforcement_date
amendment_version
official_source
guidance_sources
last_verified