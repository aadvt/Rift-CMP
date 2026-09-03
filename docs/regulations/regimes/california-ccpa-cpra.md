# California — CCPA / CPRA

## 1. Regulation Identity

- **Regulation:** California Consumer Privacy Act (CCPA)
- **Original law:** California Consumer Privacy Act of 2018
- **Amendment:** California Privacy Rights Act (CPRA), approved by voters in 2020
- **Jurisdiction:** California, United States
- **Primary regulator:** California Privacy Protection Agency (CPPA)
- **Enforcement:** CPPA and California Attorney General
- **Current regulatory framework:** CCPA as amended by CPRA, including regulations effective January 1, 2026

---

## 2. Primary Sources

- California Civil Code §§ 1798.100–1798.199
- CCPA Regulations, Title 11, Division 6
- California Privacy Protection Agency (CPPA) regulations
- CPRA / Proposition 24
- CPPA regulations effective January 1, 2026

---

## 3. Territorial / Applicability Scope

The CCPA generally applies to a **business** that does business in California and satisfies applicable statutory thresholds.

The statutory business thresholds include:

- Annual gross revenues above the applicable statutory threshold;
- Buying, selling, or sharing personal information of **100,000 or more consumers or households**;
- Deriving at least 50% of annual revenues from selling or sharing consumers' personal information.

The threshold framework has been amended over time and should be versioned in the product.

Certain entities and data types are exempt or subject to specialized treatment.

---

## 4. Covered Actors

- **Consumer:** A natural person who is a California resident, as defined by the CCPA.
- **Business:** Entity meeting the CCPA definition and applicable thresholds.
- **Service Provider:** Entity processing personal information on behalf of a business for specified business purposes.
- **Contractor:** Certain entities providing services under CCPA-defined contractual conditions.
- **Third Party:** Person/entity that is not the consumer, business, service provider, or contractor as defined by the statute.
- **Data Broker:** Business meeting the statutory definition under California law.
- **CPPA:** California Privacy Protection Agency.

---

## 5. Covered Data

The CCPA regulates **personal information**, broadly defined as information that identifies, relates to, describes, is reasonably capable of being associated with, or could reasonably be linked with a particular consumer or household.

Examples include:

- Identifiers
- Commercial information
- Internet/network activity
- Geolocation
- Professional/employment information
- Inferences
- Audio, electronic, visual, thermal, olfactory, or similar information
- Sensitive personal information

The CCPA contains statutory exclusions for certain publicly available, deidentified, aggregate, and otherwise exempt information.

---

## 6. Lawful Processing / Legal Bases

CCPA is **not structured around a GDPR-style list of lawful processing bases**.

Instead, the framework primarily establishes:

- Collection/use restrictions
- Purpose and data-minimization requirements
- Consumer rights
- Sale/sharing opt-outs
- Sensitive personal information controls
- Contractual requirements for service providers/contractors
- Consent requirements in specified circumstances

Therefore the product should **not convert CCPA into a GDPR-style legal-basis taxonomy**.

---

## 7. Consent Requirements

Consent is required in specific circumstances rather than for all processing.

Relevant requirements include:

- Consent for certain uses of personal information may be required by statute.
- Consent must satisfy CCPA/CPPA requirements and cannot be obtained through prohibited dark patterns.
- Businesses must obtain appropriate consent where required before processing that falls within a consent-specific restriction.
- Opt-in consent requirements apply in certain circumstances involving minors.
- Consent and opt-out mechanisms must be distinguished from general privacy-rights requests.

---

## 8. When Consent Is Not Required

CCPA generally does not require consent for every collection or processing activity.

Businesses may collect, use, retain, disclose, sell, or share personal information where permitted by the CCPA and applicable law, subject to:

- Notice requirements
- Purpose limitations
- Data-minimization requirements
- Consumer rights
- Sale/sharing opt-outs
- Sensitive-personal-information limitations
- Contractual restrictions
- Other statutory requirements and exceptions

---

## 9. Sensitive Personal Information

Sensitive personal information includes categories such as:

- Social Security, driver's license, state identification, passport, or similar identifiers
- Account log-in information combined with required authentication information
- Precise geolocation
- Racial or ethnic origin
- Religious or philosophical beliefs
- Union membership
- Contents of mail, email, and text messages where the business is not the intended recipient
- Genetic data
- Biometric information used for uniquely identifying a consumer
- Health information
- Information concerning sex life or sexual orientation

Consumers have a **Right to Limit** certain uses and disclosures of sensitive personal information.

---

## 10. Children

Special rules apply to minors.

- Consumers under 16 receive specific opt-in protections for sale/sharing of personal information.
- Consumers aged 13–15 must affirmatively authorize certain sales/sharing.
- Consumers under 13 require consent from a parent or guardian for those circumstances.
- Additional California children's privacy requirements may apply outside the CCPA.

The product should represent age-based rules separately rather than using one generic `child = true` condition.

---

## 11. Transparency / Notice

Businesses must provide legally required disclosures, including:

- Notice at collection
- Privacy policy
- Notice concerning sale/sharing rights where applicable
- Notice concerning limitation of sensitive personal information where applicable
- Financial incentive notices where applicable
- Other notices required by CCPA/CPPA regulations

The 2026 regulations contain detailed requirements for notices, disclosures, and communications.

---

## 12. Consumer Rights

CCPA provides rights including:

- **Right to Know**
- **Right to Delete**
- **Right to Correct**
- **Right to Opt-Out of Sale**
- **Right to Opt-Out of Sharing**
- **Right to Limit Use and Disclosure of Sensitive Personal Information**
- **Right to Non-Discrimination**
- **Right to Access Information concerning certain automated decisionmaking technology under applicable 2026 regulations**

The exact scope and exceptions vary by right.

---

## 13. Withdrawal / Objection / Opt-Out

CCPA provides specific opt-out mechanisms rather than a general GDPR-style objection right.

Key controls include:

- Opt-out of sale of personal information
- Opt-out of sharing of personal information
- Opt-out through qualifying **Global Privacy Control (GPC)** signals
- Right to limit certain uses/disclosures of sensitive personal information
- Opt-in requirements for certain minors

Businesses must provide legally compliant mechanisms for exercising these rights.

---

## 14. Retention / Erasure

Businesses must disclose retention information and may not retain personal information longer than reasonably necessary and proportionate for disclosed purposes under applicable CCPA requirements.

Consumers may request deletion, subject to statutory exceptions.

Deletion exceptions may include circumstances involving:

- Completing transactions
- Security
- Debugging/repair
- Legal compliance
- Certain research
- Internal uses reasonably aligned with consumer expectations
- Other statutory exceptions

Retention should therefore be modeled by purpose, category, legal exception, and applicable policy version.

---

## 15. Security / Breach

Businesses must maintain reasonable security procedures and practices appropriate to the nature of the personal information.

CCPA also provides a limited private right of action for certain data breaches involving specified categories of personal information when statutory conditions are satisfied.

Security, incident-response, and breach-notification obligations may also arise under other California or federal laws.

The 2026 CPPA regulations additionally establish cybersecurity-audit requirements for certain businesses.

---

## 16. Vendors / Service Providers

CCPA distinguishes between:

- Businesses
- Service providers
- Contractors
- Third parties

Contracts are important to preserve service-provider/contractor status and must contain required restrictions and obligations.

A service provider or contractor generally cannot use, retain, or disclose personal information outside the purposes and conditions permitted by the CCPA and its contract.

---

## 17. International Transfers

CCPA does not create a GDPR-style adequacy/transfer-mechanism regime.

International processing may still be subject to:

- CCPA contractual requirements
- Disclosure requirements
- Consumer rights
- Service-provider/contractor restrictions
- Other applicable California, U.S., and foreign laws

International location should therefore be modeled as a **context/risk attribute**, not as a CCPA legal-basis mechanism.

---

## 18. Governance / Accountability

Applicable businesses may need:

- Privacy governance processes
- Privacy-policy management
- Consumer-request procedures
- Vendor/service-provider contracts
- Recordkeeping
- Data inventory and mapping
- Risk assessments
- Cybersecurity audits
- Procedures for opt-out preference signals
- Procedures for sensitive-personal-information limitations

The 2026 regulations introduce additional requirements concerning risk assessments and cybersecurity audits for businesses within specified scopes.

---

## 19. Enforcement / Penalties

Enforcement may be undertaken by:

- California Privacy Protection Agency
- California Attorney General

Administrative penalties can apply for violations.

The CCPA provides enhanced protections concerning minors and certain violations involving consumers under 16.

A limited private right of action applies to certain data-security breaches involving specified personal information.

---

## 20. Exemptions / Exceptions

CCPA contains numerous exemptions and exclusions, including certain:

- Publicly available information
- Deidentified information
- Aggregate consumer information
- Employee/applicant-related information subject to statutory treatment
- Business-to-business communications subject to statutory treatment
- Medical information
- Certain financial information
- Certain information regulated by other federal/state laws

Exemptions must be evaluated by data type, actor, purpose, and statutory provision.

---

## 21. Effective Dates / Versioning

- CCPA enacted: **2018**
- CCPA effective: **January 1, 2020**
- CPRA approved: **November 2020**
- CPRA amendments effective: **January 1, 2023**
- CPPA regulations originally effective: **March 29, 2023**
- Current CCPA/CPPA regulations include amendments effective: **January 1, 2026**
- 2025 CPPA regulations concerning risk assessments, cybersecurity audits, and ADMT became effective **January 1, 2026**
- Certain new ADMT requirements begin **January 1, 2027**
- Certain cybersecurity-audit compliance deadlines are phased through **2028–2030**

The product must version CCPA requirements by statute/regulation version and effective date.

---

## 22. Requirement Summary / Ambiguities

### Product-relevant requirements

- Do not model CCPA as `consent_required = true/false`.
- Model **sale**, **sharing**, and ordinary disclosure separately.
- Model **sensitive personal information** separately.
- Model **opt-out preference signals**, including GPC.
- Model age-specific opt-in requirements.
- Model consumer rights individually.
- Model business/service-provider/contractor/third-party relationships.
- Model purpose and data-category restrictions.
- Track CCPA statute separately from CPPA regulations.
- Track effective dates and phased compliance deadlines.
- Support risk-assessment and cybersecurity-audit requirements where applicable.
- Support ADMT requirements as a separately versioned regulatory capability.

### Important interpretation boundaries

- CCPA "sale" is a statutory concept and should not be equated automatically with a commercial purchase transaction.
- CCPA "sharing" has a specific statutory meaning and should not be treated as synonymous with every disclosure.
- CCPA does not use the GDPR legal-basis model.
- Opt-out rights are not equivalent to GDPR withdrawal of consent.
- Sensitive personal information restrictions are not equivalent to GDPR special-category processing.
- CCPA/CPRA requirements must be evaluated together with applicable CPPA regulations.

---

## 23. Exact Source References

- **California Consumer Privacy Act — California Civil Code §§ 1798.100–1798.199**
- **California Privacy Rights Act / Proposition 24**
- **California Privacy Protection Agency — CCPA Regulations**
- **CCPA Regulations effective January 1, 2026**
- **CPPA 2025 regulations on CCPA updates, cybersecurity audits, risk assessments, and ADMT**
- **California Attorney General — CCPA information and guidance**

**Research status:** Research/specification input for the compliance product. Not legal advice.