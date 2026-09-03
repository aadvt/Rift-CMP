# United States — State Privacy Law Model

## 1. Regulation Identity

- **Model:** Generic U.S. State Comprehensive Privacy Law Model
- **Jurisdiction:** United States — State level
- **Purpose:** Represent common and state-specific requirements across U.S. comprehensive privacy laws.
- **Status:** Product research/modeling framework, not a standalone law.
- **Primary regimes:** State comprehensive consumer privacy statutes and applicable regulations.

---

## 2. Primary Sources

For each state, maintain:

- State statute and amendments
- State administrative regulations
- Attorney General guidance
- State privacy authority guidance, where applicable
- Official legislative history where relevant
- Effective-date and enforcement provisions

Each state implementation must reference its exact statutory/regulatory source.

---

## 3. Territorial / Applicability Scope

State privacy laws commonly apply based on combinations of:

- Doing business in the state;
- Targeting residents of the state;
- Processing personal data of residents;
- Revenue thresholds;
- Consumer/data-volume thresholds;
- Percentage-of-revenue tests;
- Specific business activities.

Thresholds and applicability tests differ by state.

The model must therefore support:

- `jurisdiction`
- `resident_scope`
- `business_scope`
- `revenue_threshold`
- `consumer_threshold`
- `data_threshold`
- `activity_threshold`
- `effective_date`

---

## 4. Covered Actors

Common concepts include:

- Business / Controller
- Consumer
- Processor
- Service provider / contractor
- Third party
- Data broker
- Authorized agent

Terminology differs by state.

Do not assume **controller = business** or **processor = service provider** across all states.

---

## 5. Covered Data

Commonly covered:

- Personal data
- Personal information
- Consumer information
- Sensitive data / sensitive personal information

Common exclusions include:

- Publicly available information
- Deidentified information
- Aggregate information
- Certain employee/applicant data
- Data governed by sector-specific federal laws
- Certain business-to-business data

The model must support state-specific definitions and exclusions.

---

## 6. Lawful Processing / Legal Bases

Most U.S. state privacy laws do **not** use the GDPR's complete legal-basis framework.

Common processing permissions/restrictions include:

- Consumer consent
- Contract necessity
- Legal obligations
- Compliance with laws
- Security/fraud prevention
- Legitimate business purposes
- Internal operational purposes
- Public-interest or statutory purposes
- Other state-specific permitted purposes

The engine must not automatically map these concepts to GDPR Article 6 legal bases.

---

## 7. Consent Requirements

Consent requirements vary by state and processing activity.

The model should support:

- Explicit consent
- Affirmative consent
- Consent for sensitive data
- Consent for specified secondary uses
- Consent for certain children's/minors' processing
- Consent withdrawal
- Consent expiration/re-consent where applicable
- Prohibited dark patterns

Do not represent consent as a universal requirement.

---

## 8. When Consent Is Not Required

Depending on the state, processing may be permitted without consent for purposes such as:

- Contract performance
- Compliance with legal obligations
- Security
- Fraud prevention
- Internal operations
- Service provision
- Certain legitimate/business purposes
- Exercising or defending legal claims
- Public-interest purposes
- Other statutory exceptions

Every state implementation must preserve its own exceptions.

---

## 9. Sensitive / Special Data

Many state laws establish additional restrictions for sensitive data.

Common categories include:

- Racial/ethnic origin
- Religious beliefs
- Mental or physical health information
- Sexual orientation
- Precise geolocation
- Genetic data
- Biometric data
- Citizenship/immigration information
- Financial information
- Authentication credentials
- Children's data

Treatment varies significantly by state.

The model must represent:

- `sensitive_category`
- `consent_required`
- `purpose_restriction`
- `processing_restriction`
- `state_specific_exception`

---

## 10. Children / Minors

State laws vary considerably.

Requirements may depend on:

- Age
- Child/minor definition
- Type of processing
- Sale/sharing/targeted advertising
- Sensitive-data processing
- Parental consent
- Age-verification obligations

The model should use configurable age bands rather than one universal child threshold.

---

## 11. Transparency / Notice

Common requirements include a privacy notice describing:

- Categories of personal data collected
- Purposes of processing
- Categories of data disclosed
- Categories of third parties
- Consumer rights
- How rights may be exercised
- Appeal procedures where applicable
- Sale/targeted-advertising disclosures where applicable
- Sensitive-data disclosures where applicable
- Retention information where required

Notice requirements vary by state.

---

## 12. Consumer Rights

Common state privacy rights include:

- Right to access
- Right to confirm processing
- Right to correct
- Right to delete
- Right to data portability
- Right to opt out of sale
- Right to opt out of targeted advertising
- Right to opt out of profiling/automated decision-making in specified circumstances
- Right to appeal
- Right to limit/restrict certain processing
- Right to non-discrimination

Not every state provides every right.

---

## 13. Withdrawal / Objection / Opt-Out

The model must separately represent:

- Consent withdrawal
- Sale opt-out
- Targeted-advertising opt-out
- Profiling opt-out
- Sensitive-data processing controls
- Universal opt-out mechanisms
- Global Privacy Control or other recognized signals

A consumer may have an opt-out right even where processing does not depend on consent.

---

## 14. Retention / Erasure

State laws increasingly require data minimization and/or reasonable retention practices.

Common requirements include:

- Collect only data reasonably necessary for disclosed purposes
- Avoid retaining data longer than reasonably necessary
- Delete personal data when legally required
- Honor deletion requests subject to exceptions
- Maintain statutory retention exceptions

Retention must be modeled by:

- State
- Data category
- Purpose
- Retention period/rule
- Deletion exception
- Effective date

---

## 15. Security / Breach

Controllers/businesses generally have obligations to maintain reasonable security measures.

State privacy statutes may address:

- Security safeguards
- Access controls
- Data minimization
- Risk reduction
- Processor security
- Incident response

Separate state data-breach notification laws may also apply.

The product must therefore distinguish:

1. Privacy-law security obligations
2. Data-breach notification obligations

---

## 16. Vendors / Processors

Common contractual requirements include:

- Processing only on documented instructions
- Confidentiality
- Appropriate security
- Assistance with consumer requests
- Assistance with security incidents
- Deletion/return of data
- Audit or compliance support
- Restrictions on secondary use

State terminology varies.

Some laws distinguish processors, service providers, and contractors.

---

## 17. International Transfers

Most U.S. state comprehensive privacy laws do not create a GDPR-style international-transfer mechanism.

International processing may nevertheless be relevant to:

- Notice/transparency
- Vendor contracts
- Security
- Government-access risk
- State-specific requirements

International transfer should therefore be represented as a processing context rather than a universal transfer legal basis.

---

## 18. Governance / Accountability

Depending on the state and business, requirements may include:

- Privacy program
- Data inventories
- Data protection assessments
- Risk assessments
- Processor contracts
- Privacy notices
- Consumer-request procedures
- Security controls
- Profiling/automated-decision documentation
- Records supporting compliance

Some newer state laws impose detailed assessment requirements for high-risk processing.

---

## 19. Enforcement / Penalties

Enforcement varies by state.

Possible enforcement authorities include:

- State Attorney General
- State privacy regulator/agency
- Other designated state authorities

Potential remedies include:

- Civil penalties
- Administrative enforcement
- Injunctive relief
- Consumer restitution
- Corrective measures

Private rights of action vary and should be represented explicitly per state.

Do not assume every state law permits private lawsuits.

---

## 20. Exemptions / Exceptions

Common exemptions include:

- Government entities
- Certain nonprofits
- Financial institutions/data covered by GLBA
- Health-care entities/data covered by HIPAA
- Certain employment data
- Certain publicly available data
- Deidentified/aggregate data
- Certain educational records
- Certain legal/compliance activities
- Other sector-specific or entity-specific exemptions

Exemptions may be:

- Entity-level
- Data-level
- Purpose-level
- Context-specific

The model must distinguish these types.

---

## 21. Effective Dates / Versioning

Every state regime must be versioned using:

- `state`
- `law_name`
- `statute_version`
- `amendment`
- `regulation_version`
- `publication_date`
- `effective_date`
- `enforcement_date`
- `sunset_date`, if applicable

Do not assume enactment date = effective date = enforcement date.

The model must support multiple overlapping effective dates.

---

## 22. Requirement Summary / Ambiguities

### Common state-law capability model

```text
jurisdiction
applicability
covered_actor
data_category
sensitive_data
purpose
processing_activity
legal_basis_or_permission
consent
opt_out
consumer_right
children_rule
notice_requirement
retention_rule
security_requirement
processor_requirement
transfer_context
assessment_requirement
exception
penalty
effective_date
policy_version
source