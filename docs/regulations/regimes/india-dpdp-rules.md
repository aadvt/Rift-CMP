# India — Digital Personal Data Protection Rules, 2025

## 1. Regulation Identity

- **Official name:** Digital Personal Data Protection Rules, 2025
- **Jurisdiction:** India
- **Notified:** 13 November 2025
- **Issuing authority:** Ministry of Electronics and Information Technology, Government of India
- **Legal authority:** Digital Personal Data Protection Act, 2023
- **Instrument type:** Rules made under the Act.
- **Purpose:** Provide operational and procedural requirements for implementation of the DPDP Act.

## 2. Primary Sources

- Digital Personal Data Protection Rules, 2025 — notified Gazette text.
- Digital Personal Data Protection Act, 2023.
- Corrigenda and subsequent government notifications.
- Data Protection Board of India regulations/orders where applicable.

## 3. Commencement / Phasing

The Rules do not all commence on the same date.

Under Rule 1:

- **Rules 1, 2 and 17 to 21:** effective on publication.
- **Rule 4:** effective one year after publication.
- **Rules 3, 5 to 16, 22 and 23:** effective eighteen months after publication.

**Implementation requirement:** Store each Rule with its own effective date.

## 4. Covered Actors

Relevant actors include:

- Data Principal
- Data Fiduciary
- Data Processor
- Consent Manager
- Significant Data Fiduciary
- Data Protection Officer
- Data auditor
- Data Protection Board of India

The terminology of the Act applies unless the Rules specify otherwise.

## 5. Notice Requirements

The Rules provide additional requirements for notices given by Data Fiduciaries.

Notices should:

- be understandable;
- provide required information;
- identify the personal data involved;
- identify the purpose of processing;
- provide information needed for Data Principal rights; and
- provide appropriate mechanisms for exercising rights.

The implementation should store notice versions and the purposes/data categories covered by each notice.

## 6. Consent Requirements

Consent mechanisms must support:

- clear user choice;
- informed consent;
- ability to give consent;
- ability to withdraw consent;
- records necessary to demonstrate consent;
- access to consent information where required.

Consent should be represented as a versioned event rather than a permanent boolean.

## 7. Consent Managers

The Rules establish requirements for registered Consent Managers.

A Consent Manager must provide an interoperable platform enabling Data Principals to:

- give consent;
- manage consent;
- review consent;
- withdraw consent.

Consent Managers must maintain records relating to consent and data sharing as required by the Rules.

Consent Manager obligations include requirements relating to:

- independence;
- conflict-of-interest controls;
- transparency;
- security;
- record keeping;
- governance; and
- compliance with Board requirements.

## 8. Data Principal Rights

The Rules provide operational mechanisms for exercising Data Principal rights.

Systems should support requests relating to:

- access;
- correction;
- completion;
- updating;
- erasure;
- grievance redressal; and
- nomination,

as applicable under the Act.

## 9. Grievance Redressal

Data Fiduciaries must provide a mechanism through which Data Principals can submit grievances.

The Rules prescribe operational requirements concerning grievance handling.

The implementation should maintain:

- grievance ID;
- requester;
- date/time;
- issue;
- status;
- response;
- resolution;
- applicable deadline.

## 10. Security Safeguards

The Rules prescribe reasonable security safeguards that Data Fiduciaries must implement.

The security framework includes measures such as:

- encryption or other appropriate protection;
- access controls;
- logging/monitoring;
- backup and recovery;
- detection and response mechanisms;
- appropriate contractual controls with Data Processors; and
- measures designed to prevent unauthorised access or processing.

Exact implementation should follow the applicable Rule text and current technical standards rather than treating this list as exhaustive.

## 11. Personal Data Breach Notification

The Rules specify operational requirements for notifying personal data breaches.

Data Fiduciaries must provide information to the Data Protection Board and affected Data Principals in the manner and within the timelines prescribed by the Rules.

The system should therefore record:

- breach discovery time;
- affected systems/data;
- affected Data Principals;
- notification status;
- notification timestamps;
- Board notification;
- Data Principal notification;
- remedial actions.

## 12. Retention and Erasure

The Rules establish additional retention/erasure requirements for specified circumstances and classes of Data Fiduciaries.

Retention logic must be represented as:

`data category + purpose + applicable Rule + retention condition + deletion trigger`

Do not create a universal DPDP retention period.

## 13. Significant Data Fiduciaries

The Rules provide additional obligations for Significant Data Fiduciaries.

These include requirements relating to:

- Data Protection Officers;
- independent data auditors;
- Data Protection Impact Assessments;
- periodic audits;
- monitoring and compliance;
- specified technical and organisational measures.

## 14. Data Protection Impact Assessment

Where applicable to a Significant Data Fiduciary, the Data Protection Impact Assessment must assess processing risks and relevant safeguards.

The product should represent DPIA status as:

- required;
- completed;
- reviewed;
- remediation required;
- approved/closed.

## 15. Data Audits

Significant Data Fiduciaries are subject to periodic data audits as required by the Rules.

Audit records should include:

- audit period;
- scope;
- auditor;
- findings;
- remediation;
- completion date;
- evidence.

## 16. Children

The Rules provide mechanisms for verifying parental consent in circumstances where consent of a parent is required.

The Rules also contain provisions concerning exemptions and specified classes of processing.

Child-processing logic must therefore distinguish:

- child identification;
- parental consent;
- verification;
- prohibited processing;
- applicable exemption.

## 17. International Transfers

The Rules provide the framework under which the Central Government may prescribe requirements relating to making personal data available to a foreign State or entity under the Act.

International transfer controls should therefore be versioned separately from the general DPDP authorization model.

## 18. Exemptions

The Rules provide specific exemptions and conditions for certain classes of Data Fiduciaries or processing activities.

Exemptions should be represented as:

`actor + processing purpose + condition + exemption + effective date`

rather than as a global exemption flag.

## 19. Data Processor Controls

Data Fiduciaries must establish appropriate contractual and operational controls over Data Processors.

The relationship should address applicable:

- security requirements;
- processing instructions;
- breach handling;
- deletion/retention;
- access controls;
- compliance responsibilities.

The exact contractual requirement should be mapped to the relevant Act/Rule provision.

## 20. Enforcement / Data Protection Board

The Rules provide procedural and operational requirements supporting the Data Protection Board.

The Board's powers originate in the Act, while procedural requirements may be prescribed through Rules and subsequent Board regulations.

## 21. Technical / Organisational Requirements

The Rules introduce a more detailed implementation layer than the Act.

For the product, represent requirements using:

- requirement ID;
- Rule number;
- actor;
- purpose;
- data category;
- condition;
- action;
- effective date;
- evidence requirement.

## 22. Requirement Summary

| ID | Requirement | Source | Condition |
|---|---|---|---|
| DPR-001 | Provide compliant notice | Rule 3 | When applicable |
| DPR-002 | Support consent management | Rules + Act | Where consent is used |
| DPR-003 | Support consent withdrawal | Rules + Act | Where consent exists |
| DPR-004 | Maintain consent records | Rules | Applicable Consent Manager/Data Fiduciary requirements |
| DPR-005 | Provide grievance mechanism | Rules + Act | Applicable Data Fiduciary |
| DPR-006 | Implement security safeguards | Rules | Applicable processing |
| DPR-007 | Maintain breach-response capability | Rules | Personal data breach |
| DPR-008 | Support SDF DPIA requirements | Rules | Significant Data Fiduciary |
| DPR-009 | Support SDF audit requirements | Rules | Significant Data Fiduciary |
| DPR-010 | Implement child-consent verification | Rules + Act | Where parental consent is required |
| DPR-011 | Apply prescribed exemptions | Rules | Only where conditions are satisfied |
| DPR-012 | Version compliance by effective date | Rules | All requirements |

## 23. Effective-Date Model

### Computed calendar dates
The official commencement instruments specify periods from publication. For machine comparison, the project computes **2026-11-13** for the one-year group and **2027-05-13** for the eighteen-month group from the Gazette publication date of 2025-11-13. These are modeling calculations; the source's stated periods remain authoritative.


The compliance engine must not assume:

`Rules published = all Rules immediately enforceable`

Instead:

```text
Rule
  -> publication date
  -> commencement rule
  -> effective date
  -> applicable actor
  -> applicable condition