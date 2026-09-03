// GENERATED FILE - DO NOT EDIT.
// Produced by docs/regulations/tools/build.mjs from matrix/requirements.json.
// Edit the JSON and re-run the build; edits here are overwritten.
//
// Research artifact, not legal advice. See docs/regulations/README.md.

import type {
  AuthorityLevel,
  CanonicalDataCategory,
  LegalBasis,
  Regime,
  Region,
  RequirementType,
  Topic,
} from "./vocabulary";

/**
 * Whether consent is required.
 *
 * Deliberately not a boolean. `"conditional"` is a real and common answer - the
 * requirement depends on facts the matrix does not hold - and flattening it to
 * true or false would assert something no source says. A consumer that cannot
 * handle `"conditional"` should surface it for a human, not coerce it.
 */
export type ConsentRequirement = {
  required: boolean | "conditional";
  conditions?: string[];
  withdrawal_required?: boolean;
};

export interface Applicability {
  applies: boolean;
  triggers: string[];
  covered_actors: string[];
  covered_actors_canonical?: string[];
}

export interface Requirement {
  requirement_id: string;
  regime: Regime;
  /** The regime's own term. */
  topic: string;
  /** Canonical topic, for cross-regime queries. */
  topic_canonical?: Topic;
  requirement: string;
  requirement_type?: RequirementType;
  authority_level?: AuthorityLevel;
  applicability: Applicability;
  legal_bases: string[];
  legal_bases_canonical?: LegalBasis[];
  purposes: string[];
  /** Regime terms, preserved verbatim. */
  data_categories: string[];
  data_categories_canonical?: CanonicalDataCategory[];
  contexts: string[];
  regions: Region[];
  consent?: ConsentRequirement;
  opt_out?: Record<string, unknown>;
  children?: Record<string, unknown>;
  exceptions: string[];
  /** ISO date. Null where the source states no start date. */
  effective_from: string | null;
  /** ISO date, or null where the requirement is still in force. */
  effective_to: string | null;
  policy_version: string | null;
  source_ids: string[];
  notes?: string;
}

export interface RequirementMatrix {
  schema_version: string;
  vocabulary_version?: string;
  research_status: string;
  legal_advice: false;
  requirements: Requirement[];
}

export const REQUIREMENT_MATRIX = {
  "schema_version": "1.2.0",
  "vocabulary_version": "1.0.0",
  "research_status": "research",
  "legal_advice": false,
  "requirements": [
    {
      "requirement_id": "REQ-BR-LGPD-001",
      "regime": "Brazil-LGPD",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "The LGPD applies to processing of personal data by public or private natural or legal persons in the circumstances established by Article 3, subject to statutory exclusions.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_in_brazil",
          "offering_goods_or_services_to_individuals_in_brazil",
          "data_collected_in_brazil"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [
        "statutory_exclusions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-002",
      "regime": "Brazil-LGPD",
      "topic": "lawful_basis",
      "topic_canonical": "lawful_basis",
      "requirement": "Processing of personal data must rely on one of the legal hypotheses established by Article 7.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "personal_data_processing"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent",
        "legal_or_regulatory_obligation",
        "public_administration",
        "research",
        "contract",
        "exercise_of_rights",
        "life_protection",
        "physical_safety",
        "health",
        "legitimate_interest",
        "credit_protection"
      ],
      "legal_bases_canonical": [
        "consent",
        "legal_obligation",
        "public_task",
        "research",
        "contract",
        "exercise_of_rights",
        "vital_interests",
        "health",
        "legitimate_interests",
        "credit_protection"
      ],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-003",
      "regime": "Brazil-LGPD",
      "topic": "sensitive_data",
      "topic_canonical": "sensitive_data",
      "requirement": "Sensitive personal data processing is subject to the specific legal hypotheses in Article 11.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "sensitive_personal_data_processing"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent",
        "legal_or_regulatory_obligation",
        "public_administration",
        "research",
        "exercise_of_rights",
        "life_protection",
        "physical_safety",
        "health",
        "fraud_prevention",
        "security"
      ],
      "legal_bases_canonical": [
        "consent",
        "legal_obligation",
        "public_task",
        "research",
        "exercise_of_rights",
        "vital_interests",
        "health",
        "fraud_prevention"
      ],
      "purposes": [],
      "data_categories": [
        "sensitive_personal_data"
      ],
      "data_categories_canonical": [
        "sensitive_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-004",
      "regime": "Brazil-LGPD",
      "topic": "children_and_adolescents",
      "topic_canonical": "children",
      "requirement": "Processing of personal data of children and adolescents must be carried out in their best interests, with specific highlighted consent requirements for children subject to statutory exceptions.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "child_or_adolescent_data"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "child_personal_data",
        "adolescent_personal_data"
      ],
      "data_categories_canonical": [
        "child_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "specific_highlighted_consent_for_child",
          "parent_or_legal_guardian"
        ],
        "withdrawal_required": true
      },
      "children": {
        "applies": true,
        "conditions": [
          "best_interests"
        ]
      },
      "exceptions": [
        "statutory_child_processing_exceptions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-005",
      "regime": "Brazil-LGPD",
      "topic": "data_subject_rights",
      "topic_canonical": "rights",
      "requirement": "Data subjects have statutory rights including confirmation, access, correction, deletion, portability, information and review-related rights, subject to applicable conditions.",
      "requirement_type": "right",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "data_subject_request"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [
        "statutory_exceptions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-006",
      "regime": "Brazil-LGPD",
      "topic": "international_transfer",
      "topic_canonical": "international_transfer",
      "requirement": "International transfers require an LGPD-authorised transfer basis and applicable transfer mechanism under Articles 33–36 and ANPD regulation.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "international_transfer"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "international_transfer"
      ],
      "regions": [
        "Brazil"
      ],
      "exceptions": [
        "adequacy",
        "standard_contractual_clauses",
        "specific_contractual_clauses",
        "global_corporate_rules",
        "other_article_33_mechanisms"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018-with-ANPD-Resolution-19-2024",
      "source_ids": [
        "SRC-BR-LGPD",
        "SRC-BR-ANPD-TRANSFERS-19-2024",
        "SRC-BR-ANPD-ADEQUACY-32-2026"
      ],
      "notes": "Resolution 19/2024 governs specified transfer mechanisms and is amended by the 2025 corrigendum. Resolution 32/2026 recognizes the EU/EEA destination for adequacy purposes. The underlying LGPD lawful basis remains a separate concept."
    },
    {
      "requirement_id": "REQ-BR-LGPD-007",
      "regime": "Brazil-LGPD",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Controllers and processors must adopt security, technical and administrative measures capable of protecting personal data against unauthorised access and accidental or unlawful situations.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "personal_data_processing"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "security"
      ],
      "regions": [
        "Brazil"
      ],
      "exceptions": [],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD",
        "SRC-BR-ANPD-INCIDENT-15-2024"
      ],
      "notes": "LGPD provisions other than the ANPD/CNPD institutional provisions and Articles 52–54 were effective 2020-09-18."
    },
    {
      "requirement_id": "REQ-BR-LGPD-008",
      "regime": "Brazil-LGPD",
      "topic": "enforcement",
      "topic_canonical": "enforcement",
      "requirement": "The ANPD has regulatory and enforcement powers, including application of administrative sanctions under the LGPD and applicable ANPD regulations.",
      "requirement_type": "enforcement",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "regulatory_noncompliance"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [],
      "effective_from": "2021-08-01",
      "effective_to": null,
      "policy_version": "LGPD-with-ANPD-sanctions-framework",
      "source_ids": [
        "SRC-BR-LGPD",
        "SRC-BR-ANPD-SANCTIONS-4-2023",
        "SRC-BR-ANPD-DPO-18-2024"
      ],
      "notes": "Administrative sanctions in Articles 52–54 entered into force 2021-08-01; ANPD process/dosimetry regulations are separately versioned."
    },
    {
      "requirement_id": "REQ-BR-LGPD-009",
      "regime": "Brazil-LGPD",
      "topic": "retention",
      "topic_canonical": "retention",
      "requirement": "Processing must end in statutory circumstances and deletion rules apply",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Where LGPD applies"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Legal retention exceptions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Articles 15-16 | Basis/permission as stated in CSV: Storage/termination obligations | Right/control as stated in CSV: Deletion | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-010",
      "regime": "Brazil-LGPD",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Controllers and processors must adopt technical and administrative security measures",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Where LGPD applies"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Article 46 conditions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Article 46 | Basis/permission as stated in CSV: Security obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-011",
      "regime": "Brazil-LGPD",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Security incidents may require notification to ANPD and affected data subjects",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Qualifying incident"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "LGPD and ANPD regulatory conditions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Article 48 | Basis/permission as stated in CSV: Breach notification | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-012",
      "regime": "Brazil-LGPD",
      "topic": "vendor_relationship",
      "topic_canonical": "vendor_relationship",
      "requirement": "Processor/controller responsibilities must be distinguished",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Processor relationship"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Articles 39-42 conditions"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Articles 39-42 | Basis/permission as stated in CSV: Processor obligations | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-013",
      "regime": "Brazil-LGPD",
      "topic": "international_transfer",
      "topic_canonical": "international_transfer",
      "requirement": "International transfers require a statutory transfer mechanism",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "International transfer"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": "conditional"
      },
      "exceptions": [
        "ANPD regulation applies"
      ],
      "effective_from": "2024-09-04",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-ANPD-TRANSFERS-19-2024"
      ],
      "notes": "Provision: Resolution CD/ANPD nº 19/2024 | Basis/permission as stated in CSV: Adequacy;appropriate safeguards;other Article 33 mechanisms | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-014",
      "regime": "Brazil-LGPD",
      "topic": "accountability",
      "topic_canonical": "accountability",
      "requirement": "Controller may need an Encarregado and governance measures",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Applicable controllers"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "LGPD and ANPD rules"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Articles 41;50 | Basis/permission as stated in CSV: Accountability obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-015",
      "regime": "Brazil-LGPD",
      "topic": "enforcement",
      "topic_canonical": "enforcement",
      "requirement": "ANPD may impose administrative sanctions",
      "requirement_type": "enforcement",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "Violations"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [
        "Articles 52-54 and ANPD dosimetry rules"
      ],
      "effective_from": "2021-08-01",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-ANPD-SANCTIONS-4-2023"
      ],
      "notes": "Provision: Resolution CD/ANPD nº 4/2023 | Basis/permission as stated in CSV: Administrative enforcement | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-BR-LGPD-016",
      "regime": "Brazil-LGPD",
      "topic": "sale_and_sharing",
      "topic_canonical": "sale_and_sharing",
      "requirement": "LGPD does not create a CCPA-style universal sale/sharing opt-out",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "LGPD processing"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "Brazil"
      ],
      "exceptions": [
        "Do not map directly to CCPA sale/sharing"
      ],
      "effective_from": "2020-09-18",
      "effective_to": null,
      "policy_version": "LGPD-13-709-2018",
      "source_ids": [
        "SRC-BR-LGPD"
      ],
      "notes": "Provision: Article 18 | Basis/permission as stated in CSV: Applicable legal basis and rights | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-CA-CCPA-001",
      "regime": "California-CCPA-CPRA",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "The CCPA applies to covered businesses and other regulated actors meeting the statutory applicability requirements and thresholds, subject to exemptions.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "covered_business",
          "statutory_threshold",
          "doing_business_in_california"
        ],
        "covered_actors": [
          "business",
          "service_provider",
          "contractor",
          "third_party"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction",
          "third_party"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [
        "statutory_exemptions"
      ],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-002",
      "regime": "California-CCPA-CPRA",
      "topic": "notice_at_collection",
      "topic_canonical": "notice",
      "requirement": "Businesses must provide required notice at or before collection of personal information.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "collection_of_personal_information"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "collection"
      ],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-003",
      "regime": "California-CCPA-CPRA",
      "topic": "privacy_policy",
      "topic_canonical": "notice",
      "requirement": "Covered businesses must make required disclosures in their privacy policy, including categories of information, purposes and applicable consumer rights and methods.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "covered_business"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-004",
      "regime": "California-CCPA-CPRA",
      "topic": "right_to_know",
      "topic_canonical": "rights",
      "requirement": "Consumers have rights to request information about collection, use, disclosure and other statutory categories of personal information.",
      "requirement_type": "right",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consumer_request_to_know"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [
        "statutory_exceptions"
      ],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-005",
      "regime": "California-CCPA-CPRA",
      "topic": "right_to_delete",
      "topic_canonical": "rights",
      "requirement": "Consumers have a right to request deletion of personal information, subject to statutory exceptions.",
      "requirement_type": "right",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consumer_deletion_request"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [
        "statutory_exceptions"
      ],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-006",
      "regime": "California-CCPA-CPRA",
      "topic": "sale_opt_out",
      "topic_canonical": "sale_and_sharing",
      "requirement": "Consumers have the right to opt out of the sale of their personal information, subject to statutory definitions and exceptions.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "sale_of_personal_information"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "sale"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "opt_out": {
        "available": true,
        "conditions": [
          "sale_definition_applies"
        ],
        "signals": [
          "consumer_opt_out",
          "opt_out_preference_signal"
        ]
      },
      "exceptions": [],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-007",
      "regime": "California-CCPA-CPRA",
      "topic": "sharing_opt_out",
      "topic_canonical": "sale_and_sharing",
      "requirement": "Consumers have the right to opt out of sharing of personal information for cross-context behavioural advertising where the statutory definition applies.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "sharing_for_cross_context_behavioural_advertising"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "cross_context_behavioural_advertising"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "advertising"
      ],
      "regions": [
        "California"
      ],
      "opt_out": {
        "available": true,
        "conditions": [
          "sharing_definition_applies"
        ],
        "signals": [
          "consumer_opt_out",
          "global_privacy_control"
        ]
      },
      "exceptions": [],
      "effective_from": "2023-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-008",
      "regime": "California-CCPA-CPRA",
      "topic": "sensitive_personal_information",
      "topic_canonical": "sensitive_data",
      "requirement": "Consumers have a right to limit certain uses and disclosures of sensitive personal information, subject to statutory conditions and exceptions.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "sensitive_personal_information"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "sensitive_personal_information"
      ],
      "data_categories_canonical": [
        "sensitive_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "opt_out": {
        "available": true,
        "conditions": [
          "statutory_sensitive_information_conditions"
        ],
        "signals": []
      },
      "exceptions": [],
      "effective_from": "2023-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-009",
      "regime": "California-CCPA-CPRA",
      "topic": "minors",
      "topic_canonical": "children",
      "requirement": "California law imposes enhanced consent requirements for certain sales or sharing involving minors, with age-specific rules.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consumer_under_16",
          "sale_or_sharing"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [
        "sale",
        "sharing"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "sale",
        "sharing"
      ],
      "regions": [
        "California"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "age_specific_opt_in_requirements"
        ],
        "withdrawal_required": true
      },
      "children": {
        "applies": true,
        "conditions": [
          "under_13_parental_consent",
          "age_13_to_15_consumer_opt_in"
        ]
      },
      "exceptions": [],
      "effective_from": "2023-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-010",
      "regime": "California-CCPA-CPRA",
      "topic": "non_discrimination",
      "topic_canonical": "non_discrimination",
      "requirement": "A business generally may not discriminate against a consumer for exercising CCPA rights, subject to statutory exceptions.",
      "requirement_type": "prohibition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "exercise_of_consumer_right"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [
        "statutory_exceptions"
      ],
      "effective_from": "2020-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-011",
      "regime": "California-CCPA-CPRA",
      "topic": "opt_out_preference_signals",
      "topic_canonical": "opt_out_signals",
      "requirement": "Covered businesses must process qualifying opt-out preference signals as required by California law and regulations.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "qualifying_opt_out_preference_signal"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "sale",
        "sharing"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "online"
      ],
      "regions": [
        "California"
      ],
      "opt_out": {
        "available": true,
        "conditions": [
          "qualifying_signal"
        ],
        "signals": [
          "global_privacy_control"
        ]
      },
      "exceptions": [],
      "effective_from": "2023-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-REGS-2026",
        "SRC-CA-OAG-CCPA"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-012",
      "regime": "California-CCPA-CPRA",
      "topic": "data_minimization",
      "topic_canonical": "retention",
      "requirement": "Collection, use, retention and sharing of personal information are subject to purpose and minimization restrictions under California law.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "collection",
          "use",
          "retention",
          "sharing"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2023-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-STATUTE-2026",
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-013",
      "regime": "California-CCPA-CPRA",
      "topic": "risk_assessments",
      "topic_canonical": "accountability",
      "requirement": "The current California regulatory framework establishes requirements concerning risk assessments for covered processing activities.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "covered_processing_activity",
          "risk_assessment_requirement"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2026-01-01",
      "effective_to": null,
      "policy_version": "CCPA-Regulations-2026",
      "source_ids": [
        "SRC-CA-CCPA-REGS-2026"
      ]
    },
    {
      "requirement_id": "REQ-CA-CCPA-014",
      "regime": "California-CCPA-CPRA",
      "topic": "cybersecurity_audit",
      "topic_canonical": "accountability",
      "requirement": "The current California regulatory framework establishes cybersecurity audit requirements for covered businesses meeting applicable conditions.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "covered_business",
          "applicable_audit_threshold"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "security"
      ],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2026-01-01",
      "effective_to": null,
      "policy_version": "CCPA-Regulations-2026",
      "source_ids": [
        "SRC-CA-CCPA-REGS-2026"
      ],
      "notes": "Specific certification deadlines are phased by applicable business size and begin in later years."
    },
    {
      "requirement_id": "REQ-CA-CCPA-015",
      "regime": "California-CCPA-CPRA",
      "topic": "automated_decision_making",
      "topic_canonical": "automated_decision_making",
      "requirement": "The current California regulatory framework establishes requirements concerning automated decisionmaking technology for covered uses, including specified significant-decision contexts.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "automated_decisionmaking_technology",
          "significant_decision"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "automated_decisionmaking"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "automated_decisionmaking"
      ],
      "regions": [
        "California"
      ],
      "exceptions": [],
      "effective_from": "2026-01-01",
      "effective_to": null,
      "policy_version": "CCPA-Regulations-2026",
      "source_ids": [
        "SRC-CA-CCPA-REGS-2026"
      ],
      "notes": "Certain significant-decision requirements have later compliance dates. Do not treat all ADMT obligations as immediately operative on the same date."
    },
    {
      "requirement_id": "REQ-CA-CCPA-016",
      "regime": "California-CCPA-CPRA",
      "topic": "automated_decision_making",
      "topic_canonical": "automated_decision_making",
      "requirement": "Additional requirements apply to specified automated decisionmaking technology",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "Specified businesses and processing"
        ],
        "covered_actors": [
          "business"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "California"
      ],
      "consent": {
        "required": "conditional"
      },
      "exceptions": [
        "Scope and implementation dates vary"
      ],
      "effective_from": "2026-01-01",
      "effective_to": null,
      "policy_version": "CCPA-2026",
      "source_ids": [
        "SRC-CA-CCPA-REGS-2026"
      ],
      "notes": "Provision: 2025 CPPA amendments | Basis/permission as stated in CSV: 2026 CPPA regulations | Right/control as stated in CSV: Consumer controls and disclosures | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-EP-001",
      "regime": "EU-ePrivacy",
      "topic": "communications_confidentiality",
      "topic_canonical": "tracking_and_storage",
      "requirement": "Member States must ensure confidentiality of communications and related traffic data through national implementation of the ePrivacy Directive.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "electronic_communications"
        ],
        "covered_actors": [
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "communications_content",
        "traffic_data"
      ],
      "data_categories_canonical": [
        "communications_data"
      ],
      "contexts": [
        "electronic_communications"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EDPB-TECHNICAL-SCOPE"
      ],
      "notes": "Directive-level requirement. National transposition must be evaluated."
    },
    {
      "requirement_id": "REQ-EP-002",
      "regime": "EU-ePrivacy",
      "topic": "terminal_equipment",
      "topic_canonical": "tracking_and_storage",
      "requirement": "Storage of information or access to information already stored in a subscriber or user's terminal equipment is subject to consent unless a statutory exception under Article 5(3) applies.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "service_provider",
          "website_operator"
        ],
        "covered_actors_canonical": [
          "acts_on_instruction",
          "service_operator"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "cookies",
        "tracking",
        "terminal_equipment"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "subject_to_national_transposition",
          "article_5_3_exceptions"
        ],
        "withdrawal_required": true
      },
      "exceptions": [
        "communication_transmission",
        "strictly_necessary_service"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EDPB-TECHNICAL-SCOPE"
      ],
      "notes": "Do not treat this as a universal rule that all analytics or all cookies require consent; classification depends on the activity and applicable national implementation."
    },
    {
      "requirement_id": "REQ-EP-003",
      "regime": "EU-ePrivacy",
      "topic": "direct_marketing",
      "topic_canonical": "direct_marketing",
      "requirement": "Direct marketing by electronic communications is subject to the conditions established by Article 13 and applicable national implementation.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "electronic_direct_marketing"
        ],
        "covered_actors": [
          "marketer",
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "direct_marketing"
      ],
      "data_categories": [
        "contact_data"
      ],
      "data_categories_canonical": [
        "contact_data"
      ],
      "contexts": [
        "electronic_marketing"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "existing_customer_similar_products_conditions"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-CURIA-PLANET49"
      ],
      "notes": "National implementation must be checked."
    },
    {
      "requirement_id": "REQ-GDPR-001",
      "regime": "GDPR",
      "topic": "territorial_scope",
      "topic_canonical": "applicability",
      "requirement": "GDPR applies to processing within its territorial scope, including specified processing activities connected with offering goods or services to, or monitoring the behaviour of, individuals in the Union.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_in_union",
          "offering_goods_or_services_to_individuals_in_union",
          "monitoring_behaviour_in_union"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-002",
      "regime": "GDPR",
      "topic": "lawful_basis",
      "topic_canonical": "lawful_basis",
      "requirement": "Processing must have a lawful basis under Article 6.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_of_personal_data"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent",
        "contract",
        "legal_obligation",
        "vital_interests",
        "public_task",
        "legitimate_interests"
      ],
      "legal_bases_canonical": [
        "consent",
        "contract",
        "legal_obligation",
        "vital_interests",
        "public_task",
        "legitimate_interests"
      ],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX",
        "SRC-GDPR-EDPB-LAWFUL-BASIS"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-003",
      "regime": "GDPR",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "Where consent is relied upon, consent must satisfy GDPR requirements including being freely given, specific, informed and unambiguous, with a clear affirmative action.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consent_used_as_legal_basis"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "freely_given",
          "specific",
          "informed",
          "unambiguous",
          "clear_affirmative_action"
        ],
        "withdrawal_required": true
      },
      "exceptions": [],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-004",
      "regime": "GDPR",
      "topic": "special_categories",
      "topic_canonical": "sensitive_data",
      "requirement": "Processing of special categories of personal data is prohibited unless an Article 9 exception applies.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "special_category_data"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "special_category_data"
      ],
      "data_categories_canonical": [
        "sensitive_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "article_9_conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-005",
      "regime": "GDPR",
      "topic": "children",
      "topic_canonical": "children",
      "requirement": "For information-society services offered directly to a child, consent-based processing is subject to Article 8 age and parental-authorisation requirements, subject to Member State variation within the permitted range.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "child",
          "information_society_service",
          "consent_based_processing"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "online_service"
      ],
      "regions": [
        "EU"
      ],
      "children": {
        "applies": true,
        "conditions": [
          "article_8_age_threshold",
          "parental_authorisation_where_required"
        ]
      },
      "exceptions": [],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-006",
      "regime": "GDPR",
      "topic": "transparency",
      "topic_canonical": "notice",
      "requirement": "Controllers must provide required information to data subjects in a concise, transparent, intelligible and easily accessible form.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "collection_of_personal_data"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX",
        "SRC-GDPR-EC"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-007",
      "regime": "GDPR",
      "topic": "data_subject_rights",
      "topic_canonical": "rights",
      "requirement": "Data subjects have rights including access, rectification, erasure, restriction, portability and objection, subject to applicable conditions and exceptions.",
      "requirement_type": "right",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "data_subject_request"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "gdpr_right_specific_exceptions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX",
        "SRC-GDPR-EC"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-008",
      "regime": "GDPR",
      "topic": "international_transfers",
      "topic_canonical": "international_transfer",
      "requirement": "Transfers of personal data to third countries or international organisations require an applicable GDPR transfer mechanism.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "third_country_transfer",
          "international_organisation_transfer"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "international_transfer"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "adequacy_decision",
        "appropriate_safeguards",
        "derogations"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX",
        "SRC-GDPR-EC"
      ]
    },
    {
      "requirement_id": "REQ-GDPR-009",
      "regime": "GDPR",
      "topic": "retention",
      "topic_canonical": "retention",
      "requirement": "Personal data should not be kept longer than necessary for identified purposes",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Where GDPR applies"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Legal obligations and statutory exceptions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Article 5(1)(e) | Basis/permission as stated in CSV: Storage limitation | Right/control as stated in CSV: Erasure where applicable | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-010",
      "regime": "GDPR",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Implement appropriate technical and organisational measures",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Where GDPR applies"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Risk-based measures"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Article 32 | Basis/permission as stated in CSV: Security obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-011",
      "regime": "GDPR",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Personal-data breaches may trigger supervisory-authority and data-subject notification duties",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Where breach requirements apply"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "72-hour supervisory notification subject to Article 33 conditions; Article 34 risk threshold"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Articles 33-34 | Basis/permission as stated in CSV: Breach obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-012",
      "regime": "GDPR",
      "topic": "vendor_relationship",
      "topic_canonical": "vendor_relationship",
      "requirement": "Controller-processor relationships require Article 28 compliance",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Controller uses processor"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Article 28 conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Article 28 | Basis/permission as stated in CSV: Processor contract requirements | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-013",
      "regime": "GDPR",
      "topic": "international_transfer",
      "topic_canonical": "international_transfer",
      "requirement": "Transfers outside EEA require Chapter V mechanism",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Restricted transfer context"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": "conditional"
      },
      "exceptions": [
        "Chapter V conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Articles 44-49 | Basis/permission as stated in CSV: Adequacy;appropriate safeguards;derogations | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-014",
      "regime": "GDPR",
      "topic": "accountability",
      "topic_canonical": "accountability",
      "requirement": "DPO requirements apply in specified circumstances",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Specified controllers/processors"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Article 37 conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Articles 37-39 | Basis/permission as stated in CSV: Governance obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-015",
      "regime": "GDPR",
      "topic": "accountability",
      "topic_canonical": "accountability",
      "requirement": "DPIA required for processing likely to result in high risk in specified circumstances",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "High-risk processing"
        ],
        "covered_actors": [
          "controller"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Article 35 conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Article 35 | Basis/permission as stated in CSV: DPIA obligation | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-GDPR-016",
      "regime": "GDPR",
      "topic": "enforcement",
      "topic_canonical": "enforcement",
      "requirement": "Supervisory authorities may impose corrective measures and administrative fines",
      "requirement_type": "enforcement",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "GDPR violations"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "Articles 83-84 conditions"
      ],
      "effective_from": "2018-05-25",
      "effective_to": null,
      "policy_version": "GDPR-2016-679",
      "source_ids": [
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Provision: Articles 58;83-84 | Basis/permission as stated in CSV: Enforcement | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-001",
      "regime": "India-DPDP-Act",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "The Act applies to digital personal data processed in India where the personal data is collected digitally or collected in non-digital form and subsequently digitised, and to certain processing outside India connected with offering goods or services to Data Principals in India.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "digital_personal_data_processing_in_india",
          "offering_goods_or_services_to_data_principals_in_india"
        ],
        "covered_actors": [
          "data_fiduciary",
          "data_processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-002",
      "regime": "India-DPDP-Act",
      "topic": "lawful_processing",
      "topic_canonical": "lawful_basis",
      "requirement": "A Data Fiduciary may process personal data for a lawful purpose on the basis of consent or specified legitimate uses under the Act.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_of_digital_personal_data"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent",
        "legitimate_use"
      ],
      "legal_bases_canonical": [
        "consent",
        "legitimate_use"
      ],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [
        "specified_legitimate_uses"
      ],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-003",
      "regime": "India-DPDP-Act",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "Consent must be free, specific, informed and unambiguous, with a clear affirmative action, and must be capable of withdrawal.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consent_used_as_basis"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "free",
          "specific",
          "informed",
          "unambiguous",
          "clear_affirmative_action"
        ],
        "withdrawal_required": true
      },
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-004",
      "regime": "India-DPDP-Act",
      "topic": "notice",
      "topic_canonical": "notice",
      "requirement": "The Data Fiduciary must give notice containing required information concerning the personal data and purpose of processing.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "collection_or_processing_of_personal_data"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-005",
      "regime": "India-DPDP-Act",
      "topic": "withdrawal",
      "topic_canonical": "withdrawal",
      "requirement": "Withdrawal of consent must be as easy as giving consent, and processing must cease unless otherwise authorised under the Act.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "withdrawal_of_consent"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "withdrawal_mechanism_as_easy_as_consent"
        ],
        "withdrawal_required": true
      },
      "exceptions": [
        "other_authorisation_under_act"
      ],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-006",
      "regime": "India-DPDP-Act",
      "topic": "data_subject_rights",
      "topic_canonical": "rights",
      "requirement": "Data Principals have rights including access to information, correction and erasure, grievance redressal and nomination, subject to the Act.",
      "requirement_type": "right",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "data_principal_request"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-007",
      "regime": "India-DPDP-Act",
      "topic": "children",
      "topic_canonical": "children",
      "requirement": "Processing personal data of children requires verifiable parental consent and is subject to restrictions on detrimental processing, tracking or behavioural monitoring, and targeted advertising, subject to statutory exemptions.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "child_data"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "child_personal_data"
      ],
      "data_categories_canonical": [
        "child_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "children": {
        "applies": true,
        "conditions": [
          "verifiable_parental_consent",
          "child_restrictions"
        ]
      },
      "exceptions": [
        "notified_exemptions"
      ],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-008",
      "regime": "India-DPDP-Act",
      "topic": "security",
      "topic_canonical": "security",
      "requirement": "Data Fiduciaries must implement reasonable security safeguards to prevent personal data breaches.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_of_digital_personal_data"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-009",
      "regime": "India-DPDP-Act",
      "topic": "international_transfer",
      "topic_canonical": "international_transfer",
      "requirement": "The Central Government may restrict transfer of personal data by a Data Fiduciary for processing outside India to notified countries or territories.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "processing_outside_india"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "international_transfer"
      ],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-010",
      "regime": "India-DPDP-Act",
      "topic": "significant_data_fiduciary",
      "topic_canonical": "accountability",
      "requirement": "A Significant Data Fiduciary is subject to additional governance obligations including appointment of a Data Protection Officer and independent data auditor and specified impact assessment and audit requirements.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "significant_data_fiduciary_designation"
        ],
        "covered_actors": [
          "significant_data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT",
        "SRC-IN-DPDP-ACT-COMMENCEMENT"
      ],
      "notes": "Calendar date is computed from the eighteen-month commencement period in G.S.R. 843(E), published 2025-11-13; retain the source period as authoritative and treat the calendar date as a computed modeling value."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-011",
      "regime": "India-DPDP-Act",
      "topic": "vendor_relationship",
      "topic_canonical": "vendor_relationship",
      "requirement": "Data Fiduciary remains responsible for processing performed by processors on its behalf",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Processor relationship"
        ],
        "covered_actors": [
          "processor",
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Section 8 conditions"
      ],
      "effective_from": "2023-08-11",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT"
      ],
      "notes": "Provision: Section 8 | Basis/permission as stated in CSV: Contractual/processor controls | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-012",
      "regime": "India-DPDP-Act",
      "topic": "international_transfer",
      "topic_canonical": "international_transfer",
      "requirement": "Central Government may restrict transfer of personal data outside India to notified countries or territories",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "International processing"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": "conditional"
      },
      "exceptions": [
        "Government notification restrictions"
      ],
      "effective_from": "2023-08-11",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT"
      ],
      "notes": "Provision: Section 16 | Basis/permission as stated in CSV: Section 16 transfer framework | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-013",
      "regime": "India-DPDP-Act",
      "topic": "accountability",
      "topic_canonical": "accountability",
      "requirement": "Significant Data Fiduciaries have enhanced governance obligations",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Notified SDFs"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Different requirements under Section 10"
      ],
      "effective_from": "2023-08-11",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT"
      ],
      "notes": "Provision: Section 10 | Basis/permission as stated in CSV: Enhanced accountability | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-ACT-014",
      "regime": "India-DPDP-Act",
      "topic": "enforcement",
      "topic_canonical": "enforcement",
      "requirement": "Data Protection Board may impose statutory penalties",
      "requirement_type": "enforcement",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "Violations"
        ],
        "covered_actors": [
          "processor",
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [
        "Schedule and Act conditions"
      ],
      "effective_from": "2023-08-11",
      "effective_to": null,
      "policy_version": "DPDP-Act-2023",
      "source_ids": [
        "SRC-IN-DPDP-ACT"
      ],
      "notes": "Provision: Sections 33-34 and Schedule | Basis/permission as stated in CSV: Enforcement | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-001",
      "regime": "India-DPDP-Rules",
      "topic": "commencement",
      "topic_canonical": "effective_dates",
      "requirement": "The Rules commence in phases specified by Rule 1.",
      "requirement_type": "timing",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "rule_specific_commencement"
        ],
        "covered_actors": [
          "data_fiduciary",
          "data_processor",
          "consent_manager",
          "significant_data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction",
          "intermediary"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2025-11-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES",
        "SRC-IN-DPDP-RULES-CORRIGENDUM"
      ],
      "notes": "Rules 1, 2 and 17–21 commence on publication; Rule 4 one year after publication; Rules 3, 5–16 and 22–23 eighteen months after publication."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-002",
      "regime": "India-DPDP-Rules",
      "topic": "notice_and_consent",
      "topic_canonical": "consent",
      "requirement": "The Rules provide implementation requirements concerning notices and consent mechanisms under the Act.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "notice",
          "consent"
        ],
        "covered_actors": [
          "data_fiduciary",
          "consent_manager"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "intermediary"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES",
        "SRC-IN-DPDP-RULES-CORRIGENDUM"
      ],
      "notes": "Calendar date is computed from Rule 1's eighteen-month commencement period; the notified period is authoritative."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-003",
      "regime": "India-DPDP-Rules",
      "topic": "security_and_breach",
      "topic_canonical": "security",
      "requirement": "The Rules specify security safeguards and personal data breach-related obligations under the Act.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "security_safeguards",
          "personal_data_breach"
        ],
        "covered_actors": [
          "data_fiduciary",
          "data_processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "security",
        "data_breach"
      ],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES",
        "SRC-IN-DPDP-RULES-CORRIGENDUM"
      ],
      "notes": "Calendar date is computed from Rule 1's eighteen-month commencement period; the notified period is authoritative."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-004",
      "regime": "India-DPDP-Rules",
      "topic": "children",
      "topic_canonical": "children",
      "requirement": "The Rules provide implementation details concerning verifiable parental consent and specified exemptions for processing children's personal data.",
      "requirement_type": "condition",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "child_data"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "child_personal_data"
      ],
      "data_categories_canonical": [
        "child_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "children": {
        "applies": true,
        "conditions": [
          "verifiable_parental_consent",
          "specified_rule_exemptions"
        ]
      },
      "exceptions": [
        "specified_rule_exemptions"
      ],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES",
        "SRC-IN-DPDP-RULES-CORRIGENDUM"
      ],
      "notes": "Calendar date is computed from Rule 1's eighteen-month commencement period; the notified period is authoritative."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-005",
      "regime": "India-DPDP-Rules",
      "topic": "significant_data_fiduciary",
      "topic_canonical": "accountability",
      "requirement": "The Rules specify implementation requirements for Significant Data Fiduciaries, including governance, assessment and audit-related obligations.",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "significant_data_fiduciary"
        ],
        "covered_actors": [
          "significant_data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [],
      "effective_from": "2027-05-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES",
        "SRC-IN-DPDP-RULES-CORRIGENDUM"
      ],
      "notes": "Calendar date is computed from Rule 1's eighteen-month commencement period; the notified period is authoritative."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-006",
      "regime": "India-DPDP-Rules",
      "topic": "accountability",
      "topic_canonical": "accountability",
      "requirement": "Rules prescribe additional requirements for Significant Data Fiduciaries",
      "requirement_type": "obligation",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "Notified SDFs"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "consent": {
        "required": false
      },
      "exceptions": [
        "Rule-specific conditions"
      ],
      "effective_from": "2025-11-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES"
      ],
      "notes": "Provision: Applicable Rules | Basis/permission as stated in CSV: Enhanced governance | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-IN-DPDP-RULES-007",
      "regime": "India-DPDP-Rules",
      "topic": "effective_dates",
      "topic_canonical": "effective_dates",
      "requirement": "Rules have phased commencement dates",
      "requirement_type": "timing",
      "authority_level": "delegated",
      "applicability": {
        "applies": true,
        "triggers": [
          "All entities subject to Rules"
        ],
        "covered_actors": [
          "data_fiduciary"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "digital_personal_data"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "India"
      ],
      "exceptions": [
        "Rules 1-2 and 17-21 on publication; Rule 4 after one year; Rules 3;5-16;22-23 after eighteen months"
      ],
      "effective_from": "2025-11-13",
      "effective_to": null,
      "policy_version": "DPDP-Rules-2025",
      "source_ids": [
        "SRC-IN-DPDP-RULES"
      ],
      "notes": "Provision: Rule 1 | Basis/permission as stated in CSV: Applicable rule requirements | Research status: verified | Promoted from requirements.csv; structured fields derived only from that row."
    },
    {
      "requirement_id": "REQ-US-STATE-001",
      "regime": "US-State-Model",
      "topic": "applicability",
      "topic_canonical": "applicability",
      "requirement": "US state privacy regimes may use jurisdiction-specific entity, revenue, consumer, data-volume or business-activity thresholds.",
      "requirement_type": "scope",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "state_specific_threshold"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "US"
      ],
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only. Not a statement of any individual state's law."
    },
    {
      "requirement_id": "REQ-US-STATE-002",
      "regime": "US-State-Model",
      "topic": "consumer_rights",
      "topic_canonical": "rights",
      "requirement": "State privacy regimes may provide combinations of access, correction, deletion, portability, appeal and other consumer rights.",
      "requirement_type": "right",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "state_specific_consumer_right"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "US"
      ],
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-003",
      "regime": "US-State-Model",
      "topic": "sale_targeted_advertising",
      "topic_canonical": "sale_and_sharing",
      "requirement": "Some state privacy regimes provide opt-out rights concerning sale of personal data, targeted advertising or similar activities.",
      "requirement_type": "obligation",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "state_specific_sale_definition",
          "targeted_advertising"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "sale",
        "targeted_advertising"
      ],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "advertising"
      ],
      "regions": [
        "US"
      ],
      "opt_out": {
        "available": true,
        "conditions": [
          "state_specific_conditions"
        ],
        "signals": [
          "state_specific_preference_signal"
        ]
      },
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only; individual state definitions and requirements must be sourced separately."
    },
    {
      "requirement_id": "REQ-US-STATE-004",
      "regime": "US-State-Model",
      "topic": "sensitive_data",
      "topic_canonical": "sensitive_data",
      "requirement": "Some state regimes impose heightened requirements for sensitive personal data, including consent or other restrictions.",
      "requirement_type": "condition",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "sensitive_data"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "state_specific_consent",
        "state_specific_exception"
      ],
      "legal_bases_canonical": [
        "state_specific_consent",
        "state_specific_exception"
      ],
      "purposes": [],
      "data_categories": [
        "sensitive_personal_data"
      ],
      "data_categories_canonical": [
        "sensitive_data"
      ],
      "contexts": [],
      "regions": [
        "US"
      ],
      "consent": {
        "required": false,
        "conditions": [
          "state_specific_requirement"
        ],
        "withdrawal_required": false
      },
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-005",
      "regime": "US-State-Model",
      "topic": "children",
      "topic_canonical": "children",
      "requirement": "State regimes may impose additional requirements for processing data of children or minors, with age thresholds and consent mechanisms varying by jurisdiction.",
      "requirement_type": "condition",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "minor_or_child_data"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "state_specific_consent"
      ],
      "legal_bases_canonical": [
        "state_specific_consent"
      ],
      "purposes": [],
      "data_categories": [
        "child_or_minor_data"
      ],
      "data_categories_canonical": [
        "child_data"
      ],
      "contexts": [],
      "regions": [
        "US"
      ],
      "children": {
        "applies": true,
        "conditions": [
          "state_specific_age_threshold",
          "state_specific_consent_requirement"
        ]
      },
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-006",
      "regime": "US-State-Model",
      "topic": "privacy_notice",
      "topic_canonical": "notice",
      "requirement": "State privacy regimes may require notices describing categories of personal data, purposes, rights and other jurisdiction-specific information.",
      "requirement_type": "obligation",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "state_specific_notice_requirement"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [],
      "regions": [
        "US"
      ],
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-007",
      "regime": "US-State-Model",
      "topic": "processor_relationship",
      "topic_canonical": "vendor_relationship",
      "requirement": "State privacy regimes may distinguish controllers and processors and impose contractual or operational obligations on processor relationships.",
      "requirement_type": "obligation",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "controller_processor_relationship"
        ],
        "covered_actors": [
          "controller",
          "processor"
        ],
        "covered_actors_canonical": [
          "determines_purpose",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "vendor_processing"
      ],
      "regions": [
        "US"
      ],
      "exceptions": [
        "state_specific_exemptions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-008",
      "regime": "US-State-Model",
      "topic": "appeals",
      "topic_canonical": "rights",
      "requirement": "Some state privacy regimes provide consumers with an appeal mechanism following denial of a privacy request.",
      "requirement_type": "right",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "denied_consumer_request"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "personal_information"
      ],
      "data_categories_canonical": [
        "personal_data"
      ],
      "contexts": [
        "consumer_request"
      ],
      "regions": [
        "US"
      ],
      "exceptions": [
        "state_specific_conditions"
      ],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only."
    },
    {
      "requirement_id": "REQ-US-STATE-009",
      "regime": "US-State-Model",
      "topic": "effective_dates",
      "topic_canonical": "effective_dates",
      "requirement": "State privacy requirements must be evaluated using jurisdiction-specific effective and compliance dates.",
      "requirement_type": "timing",
      "authority_level": "derived",
      "applicability": {
        "applies": false,
        "triggers": [
          "state_specific_effective_date"
        ],
        "covered_actors": [
          "state_specific_covered_entity"
        ],
        "covered_actors_canonical": [
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [],
      "regions": [
        "US"
      ],
      "exceptions": [],
      "effective_from": null,
      "effective_to": null,
      "policy_version": "GENERIC-MODEL-1.0",
      "source_ids": [
        "SRC-US-STATE-MODEL"
      ],
      "notes": "Model only. Individual state laws must be separately sourced."
    },
    {
      "requirement_id": "REQ-EP-004",
      "regime": "EU-ePrivacy",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "Directive 2002/58/EC applies to the processing of personal data in connection with the provision of publicly available electronic communications services in public communications networks in the Union.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "publicly_available_electronic_communications_service",
          "public_communications_network"
        ],
        "covered_actors": [
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "electronic_communications"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "Article 3. Directive-level scope; the applicable Member State transposition determines the operative national rule."
    },
    {
      "requirement_id": "REQ-EP-005",
      "regime": "EU-ePrivacy",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "Article 5(3) concerns storing information in, or gaining access to information already stored in, the terminal equipment of a subscriber or user, and is technology-neutral. Applicability must be assessed from what information is involved, where it is stored, whose terminal equipment is involved, whether information is being stored or accessed, whether an Article 5(3) exception applies, and which Member State's transposition law applies.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "third_party"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "third_party"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "terminal_equipment",
        "cookies",
        "tracking"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136",
        "SRC-EP-EDPB-TECHNICAL-SCOPE"
      ],
      "notes": "Article 5(3) is not limited to information that qualifies as personal data under the GDPR. The current Article 5(3) wording is that introduced by Directive 2009/136/EC."
    },
    {
      "requirement_id": "REQ-EP-006",
      "regime": "EU-ePrivacy",
      "topic": "terminal_equipment",
      "topic_canonical": "tracking_and_storage",
      "requirement": "Article 5(3) is not limited to HTTP cookies. Depending on their technical operation, mechanisms including local storage, session storage, IndexedDB, tracking pixels, URL-based tracking, local processing, device or unique identifiers, some IoT mechanisms and some IP-based tracking techniques may fall within Article 5(3). Each technology must be assessed on how it actually operates and must not be automatically classified as requiring consent.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "third_party"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "third_party"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "cookies",
        "tracking",
        "terminal_equipment"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136",
        "SRC-EP-EDPB-TECHNICAL-SCOPE"
      ],
      "notes": "EDPB Guidelines 2/2023 provide the technical analysis for determining whether a particular mechanism falls within Article 5(3). Cookie compliance cannot be reduced to a cookie-name list."
    },
    {
      "requirement_id": "REQ-EP-007",
      "regime": "EU-ePrivacy",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "Consent for storage of, or access to, information on terminal equipment cannot be obtained through a pre-ticked checkbox; valid consent requires active user participation.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "cookies",
        "consent_interface"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "pre_ticked_boxes_invalid",
          "active_user_participation_required"
        ]
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-CURIA-PLANET49"
      ],
      "notes": "CJEU C-673/17 Planet49, judgment of 1 October 2019. The same judgment holds that information relevant to informed consent includes the duration of cookies and whether third parties may access them. FLAG: the authority_levels vocabulary has no value for binding judicial interpretation, so this record derives 'statute' from the cited Directive rather than recording the judgment's own status."
    },
    {
      "requirement_id": "REQ-EP-008",
      "regime": "EU-ePrivacy",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "Where GDPR consent standards apply to an ePrivacy operation, consent must be freely given, specific, informed, unambiguous and based on a clear affirmative action.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consent_relied_on"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "consent_interface"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "freely_given",
          "specific",
          "informed",
          "unambiguous",
          "clear_affirmative_action"
        ]
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-GDPR-EURLEX"
      ],
      "notes": "GDPR consent requirements are relevant when consent is the legal condition for an ePrivacy operation. The GDPR must not be treated as replacing Article 5(3). EDPB Guidelines 05/2020 on consent are named by the research but are not registered in the source register."
    },
    {
      "requirement_id": "REQ-EP-009",
      "regime": "EU-ePrivacy",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "For technologies requiring Article 5(3) consent, the consent decision must occur before the relevant storage or access operation.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "cookies",
        "consent_interface"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "conditions": [
          "prior_to_storage_or_access"
        ]
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136"
      ]
    },
    {
      "requirement_id": "REQ-EP-010",
      "regime": "EU-ePrivacy",
      "topic": "terminal_equipment",
      "topic_canonical": "tracking_and_storage",
      "requirement": "Consent is not required under Article 5(3) where the storage or access is used for the sole purpose of carrying out the transmission of a communication over an electronic communications network.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "communication_transmission"
      ],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "terminal_equipment"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false,
        "conditions": [
          "sole_purpose_communication_transmission"
        ]
      },
      "exceptions": [
        "communication_transmission"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136"
      ]
    },
    {
      "requirement_id": "REQ-EP-011",
      "regime": "EU-ePrivacy",
      "topic": "terminal_equipment",
      "topic_canonical": "tracking_and_storage",
      "requirement": "Consent is not required under Article 5(3) where the storage or access is strictly necessary for the provider to provide an information society service explicitly requested by the subscriber or user.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "terminal_equipment"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": false,
        "conditions": [
          "strictly_necessary",
          "explicitly_requested_information_society_service"
        ]
      },
      "exceptions": [
        "strictly_necessary_requested_service"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136",
        "SRC-EP-EDPB-TECHNICAL-SCOPE"
      ],
      "notes": "The research lists user authentication, session management, shopping-cart functionality, security and user-requested functionality as mechanisms that may potentially be exempt; each must be assessed against its actual purpose and technical necessity. It also states explicitly that no EU-wide rule may be encoded making every analytics technology either exempt or consent-requiring: analytics must be assessed against Article 5(3), the applicable national implementation and relevant national regulator guidance."
    },
    {
      "requirement_id": "REQ-EP-012",
      "regime": "EU-ePrivacy",
      "topic": "retention",
      "topic_canonical": "retention",
      "requirement": "Traffic data must generally be erased or made anonymous when it is no longer needed for the transmission of a communication. Additional processing is permitted only under the conditions specified in the Directive, including billing, interconnection payments, certain value-added services, and marketing of electronic communications services subject to the Directive's conditions.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "traffic_data_processing"
        ],
        "covered_actors": [
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "traffic_data"
      ],
      "data_categories_canonical": [
        "communications_data"
      ],
      "contexts": [
        "electronic_communications"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "Article 6."
    },
    {
      "requirement_id": "REQ-EP-013",
      "regime": "EU-ePrivacy",
      "topic": "consent",
      "topic_canonical": "consent",
      "requirement": "Location data other than traffic data may generally be processed where it is anonymised, or with consent for the duration necessary for a value-added service. Users must be informed of the type of location data, the purposes and the duration of processing, and must be able to withdraw consent or temporarily suspend processing easily and free of charge.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "location_data_processing"
        ],
        "covered_actors": [
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "location_data"
      ],
      "data_categories_canonical": [
        "communications_data"
      ],
      "contexts": [
        "electronic_communications",
        "value_added_service"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": "conditional",
        "conditions": [
          "anonymisation_alternative",
          "value_added_service_duration"
        ],
        "withdrawal_required": true
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "Article 9."
    },
    {
      "requirement_id": "REQ-EP-014",
      "regime": "EU-ePrivacy",
      "topic": "direct_marketing",
      "topic_canonical": "direct_marketing",
      "requirement": "Article 13 establishes rules for unsolicited communications for direct marketing. For certain electronic communications, prior consent is required.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "electronic_direct_marketing"
        ],
        "covered_actors": [
          "marketer"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [
        "direct_marketing"
      ],
      "data_categories": [
        "contact_data"
      ],
      "data_categories_canonical": [
        "contact_data"
      ],
      "contexts": [
        "electronic_marketing"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": "conditional",
        "conditions": [
          "depends_on_communication_type",
          "subject_to_national_transposition"
        ]
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "GAP: the research does not enumerate which communication types under Article 13(1) require prior consent. That must be resolved against the Directive text and applicable national implementation before this is turned into a technical rule."
    },
    {
      "requirement_id": "REQ-EP-015",
      "regime": "EU-ePrivacy",
      "topic": "direct_marketing",
      "topic_canonical": "direct_marketing",
      "requirement": "Article 13(2) provides a limited exception where the contact details were obtained in the context of a sale of a product or service, the marketing concerns the provider's own similar products or services, and the customer was given a clear and free opportunity to object when the details were collected and with each subsequent communication.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "electronic_direct_marketing",
          "existing_customer_relationship"
        ],
        "covered_actors": [
          "marketer"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [
        "direct_marketing"
      ],
      "data_categories": [
        "contact_data"
      ],
      "data_categories_canonical": [
        "contact_data"
      ],
      "contexts": [
        "electronic_marketing"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": "conditional",
        "conditions": [
          "contact_details_obtained_in_sale",
          "own_similar_products_or_services",
          "opportunity_to_object_at_collection_and_each_communication"
        ]
      },
      "exceptions": [
        "existing_customer_similar_products_conditions"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "Member State law may contain additional implementation details."
    },
    {
      "requirement_id": "REQ-EP-016",
      "regime": "EU-ePrivacy",
      "topic": "notice",
      "topic_canonical": "notice",
      "requirement": "Users must receive the information required by the applicable ePrivacy and GDPR provisions. For Article 5(3), the information should allow users to understand the relevant storage or access operations and their purpose.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "terminal_equipment_storage",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "terminal_equipment",
        "consent_interface"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136"
      ],
      "notes": "Where the GDPR applies it may additionally require information such as controller identity, processing purposes, legal basis, recipients, retention and data-subject rights, and international-transfer information where applicable. A GDPR Article 13/14 disclosure must not be represented as itself being an ePrivacy Directive requirement."
    },
    {
      "requirement_id": "REQ-EP-017",
      "regime": "EU-ePrivacy",
      "topic": "withdrawal",
      "topic_canonical": "withdrawal",
      "requirement": "Where storage, access or processing is based on consent, withdrawal must be possible under the applicable consent rules. Under GDPR Article 7(3), withdrawal of GDPR consent must be as easy as giving consent.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "consent_relied_on"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [
        "consent"
      ],
      "legal_bases_canonical": [
        "consent"
      ],
      "purposes": [],
      "data_categories": [
        "terminal_equipment_information"
      ],
      "data_categories_canonical": [
        "device_data"
      ],
      "contexts": [
        "consent_interface"
      ],
      "regions": [
        "EU"
      ],
      "consent": {
        "required": true,
        "withdrawal_required": true
      },
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-GDPR-EURLEX"
      ],
      "notes": "ePrivacy consent, GDPR consent, GDPR objection, marketing opt-out and withdrawal of consent are distinct concepts and must not be treated as interchangeable; the applicable rule depends on the processing operation and legal framework. GDPR Article 21 provides an unconditional right to object to processing for direct marketing."
    },
    {
      "requirement_id": "REQ-EP-018",
      "regime": "EU-ePrivacy",
      "topic": "vendor_relationship",
      "topic_canonical": "vendor_relationship",
      "requirement": "Third-party technologies must be assessed on their actual role, which may be processor, controller, joint controller or independent third party. The ePrivacy Directive itself must not be interpreted as automatically making every cookie or vendor relationship a processor relationship.",
      "requirement_type": "obligation",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "third_party_technology"
        ],
        "covered_actors": [
          "third_party",
          "processor",
          "controller"
        ],
        "covered_actors_canonical": [
          "third_party",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "vendors",
        "cookies"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "Where the GDPR applies and a provider is a processor, GDPR Article 28 requirements may apply."
    },
    {
      "requirement_id": "REQ-EP-019",
      "regime": "EU-ePrivacy",
      "topic": "enforcement",
      "topic_canonical": "enforcement",
      "requirement": "Because the ePrivacy Directive is implemented through national law, enforcement powers and penalties are primarily determined through Member State implementation. Where the GDPR applies, national supervisory authorities may enforce applicable GDPR requirements, and CJEU judgments must be considered when interpreting EU-law requirements.",
      "requirement_type": "enforcement",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "national_transposition"
        ],
        "covered_actors": [
          "electronic_communications_provider",
          "website_operator",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "enforcement"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-EP-020",
      "regime": "EU-ePrivacy",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "Because the ePrivacy Directive applies through national transposition, national implementing laws and national regulator guidance must be recorded and evaluated separately from EU-level requirements, rather than assuming that one EU-wide technical rule answers every national-law question.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "national_transposition"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "electronic_communications_provider"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "national_implementation"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ],
      "notes": "The research names CNIL and the German data protection authorities as examples of national regulators whose rules would be recorded separately. National regulator guidance must not automatically be generalised across the EU."
    },
    {
      "requirement_id": "REQ-EP-021",
      "regime": "EU-ePrivacy",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "The ePrivacy Directive and the GDPR operate together. ePrivacy contains specific rules for electronic communications and access to information stored on terminal equipment; where information obtained through an ePrivacy-covered technology is personal data, GDPR obligations may additionally apply. The GDPR does not replace Article 5(3).",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "personal_data_processing",
          "terminal_equipment_access"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "terminal_equipment",
        "electronic_communications"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Implementation rule from the research: ePrivacy compliance must not be represented as a single GDPR consent_required flag."
    },
    {
      "requirement_id": "REQ-EP-022",
      "regime": "EU-ePrivacy",
      "topic": "scope",
      "topic_canonical": "applicability",
      "requirement": "Member States may adopt restrictions under Article 15 for specified purposes. Those restrictions, and other provisions concerning emergency, security, law-enforcement and regulatory requirements, must be checked against national implementation before being converted into a technical rule.",
      "requirement_type": "scope",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "national_transposition",
          "article_15_restriction"
        ],
        "covered_actors": [
          "electronic_communications_provider",
          "website_operator"
        ],
        "covered_actors_canonical": [
          "service_operator"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "national_implementation"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [
        "article_15_member_state_restrictions",
        "emergency_security_law_enforcement_regulatory"
      ],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX"
      ]
    },
    {
      "requirement_id": "REQ-EP-023",
      "regime": "EU-ePrivacy",
      "topic": "children",
      "topic_canonical": "children",
      "requirement": "The ePrivacy Directive does not establish a standalone general children's-data regime equivalent to GDPR Article 8. Where personal data is processed, GDPR children's-data and special-category requirements may apply, and these must not be represented as independent ePrivacy rules.",
      "requirement_type": "condition",
      "authority_level": "statute",
      "applicability": {
        "applies": false,
        "triggers": [
          "child_data_processing"
        ],
        "covered_actors": [
          "website_operator",
          "service_provider",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "acts_on_instruction",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [
        "child_or_minor_data"
      ],
      "data_categories_canonical": [
        "child_data"
      ],
      "contexts": [
        "children"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-GDPR-EURLEX"
      ],
      "notes": "Recorded with applicability.applies = false so that an engine reads the absence of an ePrivacy children's rule as an answer rather than as a missing requirement."
    },
    {
      "requirement_id": "REQ-EP-024",
      "regime": "EU-ePrivacy",
      "topic": "commencement",
      "topic_canonical": "effective_dates",
      "requirement": "The EU Directive, its amendments, national transposition and regulator guidance must be stored as separate versioned sources.",
      "requirement_type": "timing",
      "authority_level": "statute",
      "applicability": {
        "applies": true,
        "triggers": [
          "source_versioning"
        ],
        "covered_actors": [
          "website_operator",
          "controller"
        ],
        "covered_actors_canonical": [
          "service_operator",
          "determines_purpose"
        ]
      },
      "legal_bases": [],
      "purposes": [],
      "data_categories": [],
      "contexts": [
        "versioning"
      ],
      "regions": [
        "EU"
      ],
      "exceptions": [],
      "effective_from": "2002-07-31",
      "effective_to": null,
      "policy_version": "Directive-2002-58-EC",
      "source_ids": [
        "SRC-EP-EURLEX",
        "SRC-EP-EURLEX-2009-136"
      ],
      "notes": "Dates recorded by the research: Directive 2002/58/EC adopted 12 July 2002 and published 31 July 2002; national transposition from 2003 onward; Directive 2009/136/EC of 25 November 2009 amended Article 5(3) with a Member-State transposition deadline of 25 May 2011; CJEU Planet49 (C-673/17) decided 1 October 2019; EDPB Guidelines 2/2023 final version adopted 16 October 2024."
    }
  ]
} as const satisfies RequirementMatrix;

export const REQUIREMENTS: readonly Requirement[] = REQUIREMENT_MATRIX.requirements;
