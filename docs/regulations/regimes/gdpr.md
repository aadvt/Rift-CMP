# GDPR

## 1. Regulation Identity

- **Name:** General Data Protection Regulation
- **Official Name:** Regulation (EU) 2016/679
- **Regulation ID:** 2016/679
- **Jurisdiction:** European Union
- **EEA Relevance:** Yes
- **Adopted:** 27 April 2016
- **Entered into force:** 24 May 2016
- **Applies since:** 25 May 2018
- **Primary Legal Source:** EUR-Lex
- **Current Legal Text:** Consolidated GDPR text
- **Last Reviewed:** 2026-09-03

## 2. Sources

### Primary Sources

- EUR-Lex — Regulation (EU) 2016/679:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj

- European Commission — GDPR:
  https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en

### Authoritative Guidance

- European Data Protection Board (EDPB):
  https://www.edpb.europa.eu/

- EDPB Guidelines 05/2020 on consent:
  https://www.edpb.europa.eu/

- EDPB Guidelines 07/2020 on controller and processor:
  https://www.edpb.europa.eu/our-work-tools/documents/guidelines/guidelines-072020-concepts-controller-and_en

## 3. Territorial Scope / Applicability

### Article 3

The GDPR applies where:

1. Processing occurs in the context of the activities of an establishment of a controller or processor in the Union.
2. A controller or processor not established in the Union processes personal data in connection with offering goods or services to individuals in the Union.
3. A controller or processor not established in the Union monitors the behaviour of individuals where that behaviour takes place in the Union.

### Applicability Conditions

| Condition | Article | Requirement |
|---|---|---|
| EU establishment | 3(1) | Processing in the context of activities of an EU establishment |
| Offering goods/services | 3(2)(a) | Targeting individuals in the Union with goods or services |
| Behaviour monitoring | 3(2)(b) | Monitoring behaviour taking place in the Union |
| Non-EU organisation | 3(2), 27 | Additional representative obligations may apply |

## 4. Covered Actors

### Controller

Determines the purposes and means of processing personal data.

### Joint Controller

Two or more controllers jointly determine the purposes and means of processing.

### Processor

Processes personal data on behalf of a controller.

### Data Protection Officer

Required in the circumstances specified by Article 37.

### Third Party

A person or organisation other than the data subject, controller, processor, or persons authorised to process data under the direct authority of the controller or processor.

### Recipient

A person or organisation to whom personal data are disclosed.

## 5. Covered Data

### Personal Data

Information relating to an identified or identifiable natural person.

### Processing

Any operation performed on personal data, including collection, storage, use, disclosure, alteration, retrieval, restriction, erasure, or destruction.

### Special Categories

Article 9 covers:

- Racial or ethnic origin
- Political opinions
- Religious or philosophical beliefs
- Trade union membership
- Genetic data
- Biometric data used for uniquely identifying a person
- Health data
- Sex life
- Sexual orientation

### Criminal Conviction and Offence Data

Covered separately by Article 10.

### Pseudonymous Data

Pseudonymised data remains personal data where an individual can still be identified using additional information.

### Anonymous Data

Data that no longer relates to an identified or identifiable natural person is outside the GDPR.

## 6. Legal Bases

Article 6 provides six legal bases.

| Legal Basis | Article | Key Condition |
|---|---|---|
| Consent | 6(1)(a) | Valid consent has been given |
| Contract | 6(1)(b) | Processing is necessary for a contract or requested pre-contractual steps |
| Legal obligation | 6(1)(c) | Processing is necessary to comply with a legal obligation |
| Vital interests | 6(1)(d) | Processing is necessary to protect vital interests |
| Public task | 6(1)(e) | Processing is necessary for a public-interest task or official authority |
| Legitimate interests | 6(1)(f) | Legitimate interest is not overridden by the individual's interests or fundamental rights |

A processing operation must have an applicable legal basis.

## 7. Consent

### Article 4(11) and Article 7

Valid consent must be:

- Freely given
- Specific
- Informed
- Unambiguous
- Given through a statement or clear affirmative action

The controller must be able to demonstrate that consent was obtained.

Consent requests must be distinguishable from other matters and presented in clear and plain language.

### Withdrawal

Under Article 7(3):

- Consent may be withdrawn at any time.
- Withdrawal must be as easy as giving consent.
- Withdrawal does not affect the lawfulness of processing performed before withdrawal.

The future processing model must therefore distinguish:

`consent_given`

from:

`consent_withdrawn`

## 8. When Consent Is Not the Relevant Legal Basis

Consent is not the only GDPR legal basis.

Depending on the circumstances, processing may instead rely on:

- Contractual necessity
- Legal obligation
- Vital interests
- Public task
- Legitimate interests

The applicable legal basis must be determined from the actual processing circumstances.

The system must not automatically switch from consent to another legal basis merely because consent was withdrawn.

## 9. Special Category Data

Article 9 establishes additional restrictions for special-category personal data.

Processing is generally prohibited unless an Article 9(2) condition applies.

Relevant conditions include:

- Explicit consent
- Employment and social protection law
- Vital interests
- Legitimate activities of certain organisations
- Data made manifestly public by the individual
- Legal claims
- Substantial public interest
- Health or social care
- Public health
- Archiving, scientific/historical research, or statistical purposes

Article 6 and Article 9 requirements must be evaluated separately.

## 10. Children's Data

Article 8 contains specific rules for information society services offered directly to children.

Where consent is the applicable legal basis:

- The default age is 16.
- Member States may lower the age to no lower than 13.
- Below the applicable age, consent must be given or authorised by the holder of parental responsibility.

Member State-specific rules must therefore be considered.

## 11. Transparency / Notice

Articles 13 and 14 establish information requirements.

Depending on the circumstances, notices include:

- Controller identity
- Controller contact details
- DPO contact details where applicable
- Processing purposes
- Legal basis
- Legitimate interests where relied upon
- Recipients
- International transfers
- Retention period or criteria
- Data subject rights
- Right to withdraw consent
- Right to complain
- Whether providing data is required
- Source of indirectly collected data
- Automated decision-making/profiling information where applicable

### Timing

For directly collected data, information is generally provided when the data are obtained.

For indirectly obtained data, Article 14 contains specific timing requirements and exceptions.

## 12. Data Subject Rights

The GDPR provides rights including:

- Access — Article 15
- Rectification — Article 16
- Erasure — Article 17
- Restriction — Article 18
- Data portability — Article 20
- Objection — Article 21
- Rights relating to automated individual decision-making — Article 22

These rights contain conditions and exceptions and must not be treated as unconditional deletion or opt-out mechanisms.

## 13. Withdrawal / Objection / Opt-Out

These concepts must remain separate.

### Consent Withdrawal

Article 7(3).

Applies when processing is based on consent.

### Right to Object

Article 21.

Applies to specified processing, including processing based on Articles 6(1)(e) and 6(1)(f), subject to the conditions in Article 21.

### Direct Marketing

Article 21(2) provides a specific right to object to processing for direct marketing.

### Opt-Out

"Opt-out" is not a universal GDPR legal basis or equivalent to consent withdrawal.

Any product-level opt-out mechanism must be mapped to the underlying GDPR right or legal requirement.

## 14. Retention

### Storage Limitation

Article 5(1)(e) requires personal data to be kept in identifiable form no longer than necessary for the purposes for which it is processed, subject to specified exceptions.

Retention rules may also arise from:

- Legal obligations
- Contractual requirements
- Legal claims
- Archiving
- Scientific or historical research
- Statistical purposes

Retention must therefore be represented as a rule with conditions rather than a single global deletion period.

## 15. International Transfers

Chapter V governs transfers of personal data to third countries and international organisations.

Relevant mechanisms include:

### Adequacy

Article 45.

Transfers may occur where the European Commission has adopted an adequacy decision.

### Appropriate Safeguards

Article 46 includes mechanisms such as:

- Standard Contractual Clauses
- Binding Corporate Rules
- Approved codes of conduct
- Approved certification mechanisms
- Other authorised safeguards

### Derogations

Article 49 contains limited derogations for specific situations.

These include, subject to applicable conditions:

- Explicit consent
- Contractual necessity
- Legal claims
- Vital interests
- Certain public-register transfers
- Certain compelling legitimate-interest situations

Transfer requirements must be evaluated separately from the Article 6 legal basis for the underlying processing.

## 16. Cookies / Tracking

GDPR applies where cookies or other tracking technologies involve personal data.

The GDPR itself does not establish the complete EU cookie-consent framework.

Electronic communications and terminal-equipment storage/access are also governed by the EU ePrivacy framework and national implementation.

Therefore:

- GDPR requirements must be evaluated for personal-data processing.
- ePrivacy requirements must be evaluated separately for terminal-equipment storage/access.
- The CMP must not treat GDPR and ePrivacy as the same regulation.

See:

`eu-eprivacy.md`

## 17. Vendors / Processors

### Article 28

Controllers must use processors providing sufficient guarantees for appropriate technical and organisational measures.

Processor arrangements must include the requirements specified by Article 28.

Processors generally:

- Process on documented instructions.
- Maintain confidentiality.
- Implement appropriate security measures.
- Assist the controller with GDPR obligations.
- Support audits and compliance.
- Address deletion or return of data at the end of processing.

### Subprocessors

A processor requires the controller's prior specific or general written authorisation before engaging another processor.

The processor must also meet the applicable Article 28 requirements concerning subprocessors.

## 18. Enforcement

### Supervisory Authorities

Supervisory authorities monitor and enforce GDPR compliance.

### Corrective Powers

Article 58 includes powers such as:

- Warnings
- Reprimands
- Orders to comply
- Orders concerning processing
- Orders concerning erasure
- Processing limitations or bans
- Suspension of data transfers
- Administrative fines

### Administrative Fines

Article 83 provides maximum administrative fines of:

- EUR 10 million or 2% of total worldwide annual turnover, where applicable
- EUR 20 million or 4% of total worldwide annual turnover, where applicable

The applicable maximum depends on the infringement category specified by Article 83.

### Judicial Remedies

Articles 77–82 provide complaint, judicial-remedy, and compensation mechanisms.

## 19. Exceptions / Restrictions

Relevant provisions include:

- Article 2 — material-scope exclusions
- Article 23 — restrictions by Union or Member State law
- Article 85 — freedom of expression and information
- Article 89 — safeguards and possible derogations for research, archiving, and statistics

Each exception must be represented with its legal condition and source.

## 20. Effective Dates / Versioning

| Version | Event | Effective / Applicable Date | Source |
|---|---|---|---|
| 1.0 | Regulation (EU) 2016/679 applies | 25 May 2018 | EUR-Lex |

Future amendments, delegated/implementing acts, applicable national provisions, and relevant authoritative guidance must be recorded separately rather than silently replacing the base record.

## 21. Requirement Summary

| ID | Requirement | Condition | Data Category | Purpose | Legal Basis / Mechanism | Source |
|---|---|---|---|---|---|---|
| GDPR-001 | Valid consent | Processing relies on consent | Personal data | Any applicable consent-based purpose | Article 6(1)(a) | Articles 4(11), 7 |
| GDPR-002 | Demonstrable consent | Processing relies on consent | Personal data | Accountability | Article 6(1)(a) | Article 7(1) |
| GDPR-003 | Easy withdrawal | Consent has been given | Personal data | Consent-based processing | Article 7(3) | Article 7(3) |
| GDPR-004 | Lawful alternative basis | Consent is not the applicable basis | Personal data | Context-dependent | Article 6(1)(b)-(f) | Article 6 |
| GDPR-005 | Special-category condition | Article 9 data is processed | Special-category data | Context-dependent | Article 9(2) | Article 9 |
| GDPR-006 | Children's consent condition | ISS offered directly to child | Children's data | Information society service | Article 8 | Article 8 |
| GDPR-007 | Transparency | Personal data is collected/processed | Personal data | Processing | Applicable Article 13/14 basis | Articles 13-14 |
| GDPR-008 | Access right | Data subject exercises right | Personal data | Individual rights | Article 15 | Article 15 |
| GDPR-009 | Erasure right | Article 17 conditions satisfied | Personal data | Individual rights | Article 17 | Article 17 |
| GDPR-010 | Data portability | Article 20 conditions satisfied | Personal data | Individual rights | Consent or contract | Article 20 |
| GDPR-011 | Objection | Article 21 conditions satisfied | Personal data | Relevant processing | Article 21 | Article 21 |
| GDPR-012 | Retention limitation | Personal data retained | Personal data | Any processing purpose | Storage limitation | Article 5(1)(e) |
| GDPR-013 | Transfer safeguard | Personal data transferred outside applicable area | Personal data | International transfer | Chapter V | Articles 44-49 |
| GDPR-014 | Processor contract | Processor processes for controller | Personal data | Vendor processing | Article 28 | Article 28 |

## 22. Ambiguities / Open Questions

- Member State-specific implementations and derogations must be evaluated where relevant.
- Children's age requirements may differ between Member States.
- The boundary between GDPR requirements and ePrivacy requirements must be evaluated for each tracking technology and processing activity.
- Determining the correct legal basis is context-dependent and should not be automated from consent status alone.
- Controller/processor qualification depends on the facts of the processing relationship.

## 23. Conflicts

No unresolved conflict is recorded in this document unless supported by identified authoritative sources.

Known areas requiring jurisdiction-specific or authoritative interpretation should be recorded in:

`conflicts/conflicts.md`

## 24. Research Notes

- GDPR requirements must be interpreted together with relevant EDPB guidance and applicable Union/Member State law.
- EDPB guidance should be versioned separately.
- National supervisory-authority guidance may provide additional jurisdiction-specific interpretation.
- This document is a product research specification and does not constitute legal advice.

## 25. Sources

1. **EUR-Lex — Regulation (EU) 2016/679**
   https://eur-lex.europa.eu/eli/reg/2016/679/oj

2. **European Commission — Data Protection / GDPR**
   https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en

3. **European Data Protection Board**
   https://www.edpb.europa.eu/

4. **EDPB Guidelines 05/2020 — Consent under Regulation 2016/679**
   https://www.edpb.europa.eu/

5. **EDPB Guidelines 07/2020 — Controller and Processor**
   https://www.edpb.europa.eu/our-work-tools/documents/guidelines/guidelines-072020-concepts-controller-and_en