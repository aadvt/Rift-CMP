// GENERATED FILE - DO NOT EDIT.
// Produced by docs/regulations/tools/build.mjs from matrix/requirements.json.
// Edit the JSON and re-run the build; edits here are overwritten.
//
// Research artifact, not legal advice. See docs/regulations/README.md.

/** Canonical subject of a requirement. */
export type Topic =
  | "applicability"
  | "lawful_basis"
  | "consent"
  | "withdrawal"
  | "notice"
  | "rights"
  | "sensitive_data"
  | "children"
  | "retention"
  | "international_transfer"
  | "tracking_and_storage"
  | "direct_marketing"
  | "sale_and_sharing"
  | "opt_out_signals"
  | "non_discrimination"
  | "automated_decision_making"
  | "security"
  | "vendor_relationship"
  | "accountability"
  | "enforcement"
  | "effective_dates";

/** Canonical grounds on which processing may lawfully occur. */
export type LegalBasis =
  | "consent"
  | "contract"
  | "legal_obligation"
  | "vital_interests"
  | "public_task"
  | "legitimate_interests"
  | "legitimate_use"
  | "health"
  | "credit_protection"
  | "fraud_prevention"
  | "exercise_of_rights"
  | "research"
  | "state_specific_consent"
  | "state_specific_exception";

/** Canonical data concepts. Regime-specific terms map onto these. */
export type CanonicalDataCategory =
  | "personal_data"
  | "sensitive_data"
  | "child_data"
  | "communications_data"
  | "device_data"
  | "contact_data";

/**
 * A regime's own term for a data category.
 *
 * Kept distinct from {@link CanonicalDataCategory} on purpose: `personal_information`
 * and `digital_personal_data` are not synonyms for `personal_data`, they are
 * different legal scopes that overlap. See `data_categories.regime_terms` in the
 * vocabulary for how each relates.
 */
export type RegimeDataCategory =
  | "personal_data"
  | "personal_information"
  | "digital_personal_data"
  | "special_category_data"
  | "sensitive_personal_data"
  | "sensitive_personal_information"
  | "child_personal_data"
  | "child_or_minor_data"
  | "adolescent_personal_data"
  | "communications_content"
  | "traffic_data"
  | "location_data"
  | "terminal_equipment_information"
  | "contact_data";

export type RequirementType =
  | "scope"
  | "obligation"
  | "prohibition"
  | "condition"
  | "right"
  | "definition"
  | "enforcement"
  | "timing";

/** How directly the cited source states the requirement. */
export type AuthorityLevel =
  | "statute"
  | "delegated"
  | "regulator_guidance"
  | "derived";

export type Region =
  | "EU"
  | "India"
  | "California"
  | "US"
  | "Brazil";

export type Regime =
  | "Brazil-LGPD"
  | "California-CCPA-CPRA"
  | "EU-ePrivacy"
  | "GDPR"
  | "India-DPDP-Act"
  | "India-DPDP-Rules"
  | "US-State-Model";

/** Regime term -> canonical concept, with the relationship between them. */
export const DATA_CATEGORY_MAP: Record<string, { canonical: string; relation: string }> = {
  "personal_data": {
    "canonical": "personal_data",
    "relation": "equivalent"
  },
  "personal_information": {
    "canonical": "personal_data",
    "relation": "equivalent_in_scope_but_defined_separately"
  },
  "digital_personal_data": {
    "canonical": "personal_data",
    "relation": "narrower"
  },
  "special_category_data": {
    "canonical": "sensitive_data",
    "relation": "equivalent"
  },
  "sensitive_personal_data": {
    "canonical": "sensitive_data",
    "relation": "equivalent"
  },
  "sensitive_personal_information": {
    "canonical": "sensitive_data",
    "relation": "differs"
  },
  "child_personal_data": {
    "canonical": "child_data",
    "relation": "equivalent"
  },
  "child_or_minor_data": {
    "canonical": "child_data",
    "relation": "equivalent"
  },
  "adolescent_personal_data": {
    "canonical": "child_data",
    "relation": "narrower"
  },
  "communications_content": {
    "canonical": "communications_data",
    "relation": "narrower"
  },
  "traffic_data": {
    "canonical": "communications_data",
    "relation": "narrower"
  },
  "location_data": {
    "canonical": "communications_data",
    "relation": "narrower"
  },
  "terminal_equipment_information": {
    "canonical": "device_data",
    "relation": "equivalent"
  },
  "contact_data": {
    "canonical": "contact_data",
    "relation": "equivalent"
  }
};

/** Alias -> canonical topic, for reading historical records. */
export const TOPIC_ALIASES: Record<string, string> = {
  "scope": "applicability",
  "territorial_scope": "applicability",
  "lawful_processing": "lawful_basis",
  "notice_and_consent": "consent",
  "privacy_notice": "notice",
  "privacy_policy": "notice",
  "notice_at_collection": "notice",
  "transparency": "notice",
  "data_subject_rights": "rights",
  "consumer_rights": "rights",
  "right_to_know": "rights",
  "right_to_delete": "rights",
  "appeals": "rights",
  "special_categories": "sensitive_data",
  "sensitive_personal_information": "sensitive_data",
  "minors": "children",
  "children_and_adolescents": "children",
  "data_minimization": "retention",
  "international_transfers": "international_transfer",
  "terminal_equipment": "tracking_and_storage",
  "communications_confidentiality": "tracking_and_storage",
  "sale_opt_out": "sale_and_sharing",
  "sharing_opt_out": "sale_and_sharing",
  "sale_targeted_advertising": "sale_and_sharing",
  "opt_out_preference_signals": "opt_out_signals",
  "security_and_breach": "security",
  "processor_relationship": "vendor_relationship",
  "risk_assessments": "accountability",
  "cybersecurity_audit": "accountability",
  "significant_data_fiduciary": "accountability",
  "commencement": "effective_dates"
};
