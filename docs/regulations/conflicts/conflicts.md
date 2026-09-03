# Regulatory Conflicts and Ambiguities

This document records areas where regulatory requirements, interpretations, implementations, or effective dates may differ or remain ambiguous.

## Purpose

Conflicts must be recorded explicitly rather than silently resolved in the requirement matrix or decision engine.

## Conflict Record Format

Each conflict should document:

- Conflict ID
- Regime
- Topic
- Sources involved
- Conflicting or differing positions
- Scope of the conflict
- Effective dates
- Current research status
- Product impact
- Resolution status
- Notes

## Known Conflicts and Ambiguities

### CONFLICT-001 — GDPR and EU ePrivacy Interaction

**Regimes:** GDPR, EU ePrivacy

The GDPR and ePrivacy Directive operate together but address different legal layers.

The ePrivacy Directive contains specific rules concerning confidentiality of communications and access to or storage of information on terminal equipment. GDPR may separately apply to personal-data processing resulting from those activities.

Do not model ePrivacy requirements as a replacement for GDPR legal-basis analysis.

**Status:** Open / requires context-specific assessment.

---

### CONFLICT-002 — EU ePrivacy National Transposition

**Regime:** EU ePrivacy

The ePrivacy Directive is an EU Directive and is implemented through national legislation.

Requirements concerning cookies, terminal equipment, electronic communications, and related activities may therefore depend on the applicable Member State implementation.

**Status:** Open.

**Product impact:** The engine must support jurisdiction-specific implementations rather than treating the Directive as a single uniformly implemented national rule.

---

### CONFLICT-003 — India DPDP Act Commencement

**Regime:** India DPDP Act

The Act contains phased commencement provisions. Different provisions become operative at different times under the commencement notification dated 13 November 2025.

**Status:** Versioned.

**Product impact:** Requirement records must preserve provision-level effective dates rather than assigning one effective date to the entire Act.

---

### CONFLICT-004 — India DPDP Rules Commencement

**Regime:** India DPDP Rules

The final DPDP Rules, 2025 use phased commencement. Rules 1, 2 and 17–21 commence on publication; Rule 4 commences one year later; Rules 3, 5–16 and 22–23 commence eighteen months after publication.

**Status:** Versioned.

**Product impact:** Rule-level requirements must retain their individual effective dates.

---

### CONFLICT-005 — Generic US State Privacy Model

**Regime:** US State Model

US state privacy laws differ in applicability thresholds, covered entities, consumer rights, sensitive-data treatment, opt-out mechanisms, children's provisions, exemptions, and effective dates.

A generic model cannot be treated as a statement of any individual state's law.

**Status:** Open / intentionally abstracted.

**Product impact:** Individual state implementations must be added as separately sourced regimes before production enforcement.

---

### CONFLICT-006 — California CCPA/CPRA Versioning

**Regime:** California CCPA/CPRA

California privacy requirements have changed through statutory amendments and regulations with different effective and compliance dates.

Requirements must therefore be evaluated against the applicable statutory and regulatory version rather than a single undated "CCPA" rule set.

**Status:** Versioned.

**Product impact:** Preserve policy version, effective date, and source references for each requirement.

---

### CONFLICT-007 — International Transfer Mechanisms

**Regimes:** GDPR, Brazil LGPD, India DPDP

International-transfer requirements are not equivalent across regimes.

Each regime uses its own statutory mechanisms, safeguards, adequacy concepts, restrictions, or regulatory powers.

**Status:** Open / regime-specific.

**Product impact:** Do not normalize international transfers into a single global `transfer_allowed` flag.

---

## Resolution Policy

When a conflict exists:

1. Preserve both positions.
2. Identify the controlling jurisdiction and effective date where determinable.
3. Prefer primary legal text over explanatory material.
4. Record authoritative guidance separately from binding law.
5. Do not infer a universal rule from one jurisdiction.
6. Escalate unresolved legal ambiguity for legal review before enforcement.

## Research Status

This document is part of the research/specification layer.

It does not constitute legal advice or a final legal interpretation.