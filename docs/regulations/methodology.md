# Phase 6B — Regulatory Research Methodology

## 1. Purpose

This document defines the methodology used for Phase 6B — Global Regulation Research.

The purpose of Phase 6B is to create a:

- verified
- source-backed
- versioned
- auditable
- machine-oriented

regulatory specification for the privacy regimes selected for the MVP.

Phase 6B is **research and specification only**.

The output of this phase will be used as an input to future engineering phases, including the Policy / Regulation Engine.

No runtime regulatory enforcement should be implemented from these documents during Phase 6B.

---

## 2. Scope

The MVP research scope currently includes:

### Tier 1

1. EU General Data Protection Regulation (GDPR)
2. EU ePrivacy / electronic communications privacy and cookie-related requirements
3. India Digital Personal Data Protection Act
4. India Digital Personal Data Protection Rules
5. California Consumer Privacy Act (CCPA), as amended by the CPRA
6. Brazil Lei Geral de Proteção de Dados Pessoais (LGPD)

### Generic US State Model

Selected additional US state privacy regimes may be reviewed to identify common structural concepts.

The purpose is **not** to hard-code every US state individually during Phase 6B.

The goal is to determine which regulatory concepts can be represented generically and which remain jurisdiction-specific.

---

## 3. Product Research, Not Legal Advice

The materials in this directory are product research and technical specification artifacts.

They are not legal advice, legal opinions, compliance certifications, or guarantees of compliance.

The research should describe what authoritative sources state and how those requirements may be represented in a software system.

Where legal interpretation is uncertain, the uncertainty must be recorded rather than presented as a definitive legal conclusion.

---

## 4. Core Principle

A regulation must not be reduced to a single consent flag.

The regulatory model must be capable of representing:

- multiple applicable regimes
- multiple legal bases or equivalent authorization mechanisms
- purpose-specific requirements
- data-category-specific requirements
- processing-context-specific requirements
- actor-specific requirements
- territorial applicability
- user choices
- consent
- withdrawal
- objection
- opt-out
- rights
- exceptions
- conditions
- retention requirements
- transfer requirements
- tracking requirements
- vendor / processor requirements
- enforcement consequences
- effective dates
- amendments
- policy versions
- source evidence
- unresolved ambiguity

The following model is therefore preferred:

```text
Jurisdiction
    ↓
Applicability
    ↓
Actor / Role
    ↓
Data Category
    ↓
Processing Context
    ↓
Purpose
    ↓
Legal Basis / Legal Authorization / Applicable Mechanism
    ↓
User Choice or User Right
    ↓
Conditions
    ↓
Exceptions
    ↓
Required Action
    ↓
Effective Version
    ↓
Source Evidence