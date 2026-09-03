# EU ePrivacy / Cookie Requirements

## 1. Regulation Identity

### 1.1 Official Identity

- **Official title:** Directive 2002/58/EC of the European Parliament and of the Council of 12 July 2002 concerning the processing of personal data and the protection of privacy in the electronic communications sector.
- **Common name:** ePrivacy Directive.
- **Instrument type:** EU Directive.
- **Primary subject:** Confidentiality of electronic communications, traffic/location data, terminal equipment access, cookies and similar technologies, and certain direct-marketing communications.
- **Adoption date:** 12 July 2002.
- **Applies through:** National transposition laws of EU Member States.
- The Directive has been substantially amended, including by Directive 2009/136/EC.
- The proposed ePrivacy Regulation has not replaced the Directive. The Directive therefore remains the relevant EU-level instrument for this research.

### 1.2 Relationship with GDPR

The ePrivacy Directive and GDPR operate together.

- ePrivacy contains specific rules for electronic communications and access to information stored on terminal equipment.
- GDPR applies where processing also involves personal data.
- GDPR consent requirements are relevant when consent is the legal condition for an ePrivacy operation.
- GDPR must not be treated as replacing Article 5(3) of the ePrivacy Directive.

**Implementation rule:** Do not represent ePrivacy compliance as a single GDPR `consent_required` flag.

---

## 2. Primary Sources

### 2.1 Legislation

1. Directive 2002/58/EC — ePrivacy Directive.
2. Directive 2009/136/EC — amendment containing the current Article 5(3) wording.
3. Regulation (EU) 2016/679 — GDPR, where personal-data processing or GDPR consent requirements are relevant.

### 2.2 CJEU Case Law

- **C-673/17, Planet49 GmbH**
  - Confirmed that consent for cookies cannot be obtained through a pre-ticked checkbox.
  - Consent must involve active user participation.
  - Information relevant to informed consent includes the duration of cookies and whether third parties may access them.

### 2.3 EDPB Guidance

- **EDPB Guidelines 2/2023 on the Technical Scope of Article 5(3) of the ePrivacy Directive**
  - Final version adopted 16 October 2024.
  - Covers technologies including URL/pixel tracking, local processing, IP-only tracking, IoT reporting and unique identifiers.
- **EDPB Guidelines 05/2020 on Consent under Regulation 2016/679**
- Relevant EDPB guidance on deceptive design and consent interfaces.

### 2.4 National Implementation

The Directive requires national implementation.

National laws and regulator guidance must therefore be recorded separately from EU-level requirements.

Examples may include national rules issued by authorities such as CNIL, the German data protection authorities, or other Member State regulators.

---

## 3. Territorial / Applicability Scope

### 3.1 ePrivacy Directive

Article 3 applies the Directive to processing of personal data in connection with publicly available electronic communications services in public communications networks in the Union.

### 3.2 Article 5(3)

Article 5(3) concerns storing information in, or gaining access to information already stored in, the terminal equipment of a subscriber or user.

The provision is technology-neutral.

The applicability analysis should therefore examine:

1. What information is involved?
2. Where is it stored?
3. Whose terminal equipment is involved?
4. Is information being stored or accessed?
5. Does one of the Article 5(3) exceptions apply?
6. Which Member State's transposition law applies?

### 3.3 National Law

Because this is a Directive, the final compliance result may depend on the national law implementing the Directive.

**Product requirement:** jurisdiction-specific implementations must be represented separately rather than assuming that one EU-wide technical rule answers every national-law question.

---

## 4. Covered Actors

Relevant actors include:

- Subscriber
- User
- Provider of publicly available electronic communications services
- Website or application operator
- Third-party technology provider
- Advertising technology provider
- Analytics provider
- Consent-management provider
- Controller
- Processor
- Joint controller

Actor classification must be determined from the actual processing relationship and applicable national law.

---

## 5. Covered Communications / Data

### 5.1 Communications Confidentiality

Article 5 protects the confidentiality of communications and related traffic data.

Member States must prohibit listening, tapping, storage or other interception/surveillance of communications and related traffic data except where legally authorised.

### 5.2 Article 5(3) Information

Article 5(3) is not limited to information that qualifies as personal data under GDPR.

The EDPB's technical guidance examines the concepts of:

- Information
- Terminal equipment
- Storage
- Access
- Gaining access

### 5.3 Personal Data

Where information obtained through an ePrivacy-covered technology is personal data, GDPR obligations may additionally apply.

---

## 6. Cookies and Similar Technologies

Article 5(3) is technology-neutral and is not limited to HTTP cookies.

Depending on the technical operation, relevant technologies may include:

- HTTP cookies
- Local storage
- Session storage
- IndexedDB
- Tracking pixels
- URL-based tracking
- Local processing
- Device/unique identifiers
- Some IoT mechanisms
- Some IP-based tracking techniques

The EDPB Guidelines 2/2023 provide the technical analysis for determining whether particular mechanisms fall within Article 5(3).

**Important:** A technology must be assessed based on how it actually operates. Do not classify every technology automatically as requiring consent.

---

## 7. Consent Requirements

### 7.1 General Rule

Article 5(3) generally requires the subscriber or user to have given consent before information is stored in, or access is gained to information already stored in, their terminal equipment, unless an Article 5(3) exception applies.

### 7.2 Consent Standard

Where GDPR consent standards apply, consent must be:

- Freely given
- Specific
- Informed
- Unambiguous
- Based on a clear affirmative action

### 7.3 Pre-Ticked Choices

Pre-ticked boxes do not constitute valid active consent.

This was confirmed by the CJEU in **Planet49 (C-673/17)**.

### 7.4 Prior Activation

For technologies requiring Article 5(3) consent, the consent decision must occur before the relevant storage/access operation.

---

## 8. When Consent Is Not Required

Article 5(3) contains two principal exceptions.

### 8.1 Communication Transmission

Consent is not required where storage or access is used for the **sole purpose of carrying out the transmission of a communication over an electronic communications network**.

### 8.2 Strictly Necessary Requested Service

Consent is not required where storage or access is:

- strictly necessary
- for the provider
- to provide an information society service
- explicitly requested by the subscriber or user.

### 8.3 Examples

Potentially exempt mechanisms may include technologies necessary for:

- User authentication
- Session management
- Shopping-cart functionality
- Security
- User-requested functionality

Each technology must be assessed against the actual purpose and technical necessity.

### 8.4 Analytics

Do not encode a universal EU-wide rule that every analytics technology is exempt or that every analytics technology necessarily requires consent.

Analytics must be assessed against Article 5(3), applicable national implementation, and relevant national regulator guidance.

---

## 9. Confidentiality of Communications

Article 5 establishes confidentiality of communications and related traffic data.

Member States must prohibit unauthorised:

- Listening
- Tapping
- Storage
- Interception
- Surveillance

Exceptions must have a legal basis under the Directive and applicable national law.

---

## 10. Traffic and Location Data

### 10.1 Traffic Data

Article 6 regulates processing of traffic data.

Traffic data must generally be erased or made anonymous when no longer needed for transmission of a communication.

Additional processing may be permitted under specified conditions, including:

- Billing
- Interconnection payments
- Certain value-added services
- Marketing of electronic communications services, subject to the conditions of the Directive.

### 10.2 Location Data

Article 9 regulates location data other than traffic data.

Such data may generally be processed when:

- anonymised; or
- processed with consent for the duration necessary for a value-added service.

Users must be informed about the type of location data, purposes and duration, and must be able to withdraw consent or temporarily suspend processing easily and free of charge.

---

## 11. Direct Marketing

### 11.1 Electronic Direct Marketing

Article 13 establishes rules for unsolicited communications for direct marketing.

For certain electronic communications, prior consent is required.

### 11.2 Existing Customer Exception

Article 13(2) provides a limited exception where:

1. Contact details were obtained in the context of a sale of a product or service.
2. The marketing concerns the provider's own similar products or services.
3. The customer was given a clear and free opportunity to object when the details were collected and with each subsequent communication.

### 11.3 National Implementation

Member State law may contain additional implementation details.

---

## 12. Children / Special Categories

The ePrivacy Directive does not establish a standalone general children's-data regime equivalent to GDPR Article 8.

Where personal data is processed:

- GDPR children's-data requirements may apply.
- GDPR special-category requirements may apply where relevant.

These must not be incorrectly represented as independent ePrivacy rules.

---

## 13. Transparency / Information Requirements

Users must receive information required by the applicable ePrivacy and GDPR provisions.

For Article 5(3), information should allow users to understand relevant storage/access operations and their purpose.

Where GDPR applies, GDPR transparency requirements may additionally require information such as:

- Controller identity
- Processing purposes
- Legal basis
- Recipients
- Retention information
- Data-subject rights
- International-transfer information where applicable

**Implementation rule:** Do not claim that every GDPR Article 13/14 disclosure is itself an ePrivacy Directive requirement.

---

## 14. Withdrawal / Objection / Opt-Out

### 14.1 Withdrawal

Where processing/storage/access is based on consent, withdrawal must be possible under the applicable consent rules.

Under GDPR Article 7(3), withdrawal of GDPR consent must be as easy as giving consent.

### 14.2 Direct Marketing Objection

GDPR Article 21 provides an unconditional right to object to processing for direct marketing.

### 14.3 ePrivacy vs GDPR

Do not treat these concepts as interchangeable:

- ePrivacy consent
- GDPR consent
- GDPR objection
- Marketing opt-out
- Withdrawal of consent

The applicable rule depends on the processing operation and legal framework.

---

## 15. Vendors / Third Parties

Third-party technologies must be assessed based on their actual role.

Possible roles include:

- Processor
- Controller
- Joint controller
- Independent third party

Where GDPR applies and a provider is a processor, GDPR Article 28 requirements may apply.

The ePrivacy Directive itself should not be interpreted as automatically making every cookie/vendor relationship a processor relationship.

---

## 16. Enforcement

### 16.1 National Enforcement

Because the ePrivacy Directive is implemented through national law, enforcement powers and penalties are primarily determined through Member State implementation.

### 16.2 GDPR Enforcement

Where GDPR applies, national supervisory authorities may enforce applicable GDPR requirements.

### 16.3 CJEU Interpretation

CJEU judgments must be considered when interpreting EU-law requirements.

---

## 17. Exceptions

Relevant exceptions and restrictions include:

- Article 5(3) transmission exception
- Article 5(3) strictly-necessary requested-service exception
- Article 15 restrictions implemented by Member States for specified purposes
- Other provisions concerning emergency, security, law-enforcement and regulatory requirements

National implementation must be checked before converting an exception into a technical rule.

---

## 18. Effective Dates / Versioning

| Instrument | Date | Status |
|---|---|---|
| Directive 2002/58/EC | 12 July 2002 | Foundational ePrivacy Directive |
| Directive 2002/58/EC | 31 July 2002 | Published in Official Journal |
| National transposition | From 2003 onward | Member-State specific |
| Directive 2009/136/EC | 25 November 2009 | Amended Article 5(3) |
| Directive 2009/136/EC | 25 May 2011 | Member-State transposition deadline |
| CJEU Planet49, C-673/17 | 1 October 2019 | Binding judicial interpretation |
| EDPB Guidelines 2/2023 | 16 October 2024 | Final version |

**Versioning rule:** Store the EU Directive, amendments, national transposition and regulator guidance as separate versioned sources.

---

## 19. Requirement Summary

| ID | Requirement | Source | Conditions |
|---|---|---|---|
| EP-001 | Obtain consent before covered terminal-equipment storage/access | Art. 5(3) ePD | Unless an exception applies |
| EP-002 | Do not use pre-ticked consent choices | Planet49 / GDPR consent standard | Where consent is required |
| EP-003 | Use clear and informed consent mechanisms | Art. 5(3) + GDPR | Where consent applies |
| EP-004 | Permit transmission-only operations without consent | Art. 5(3) ePD | Sole purpose must be communication transmission |
| EP-005 | Permit strictly necessary requested-service operations without consent | Art. 5(3) ePD | Must satisfy the statutory conditions |
| EP-006 | Protect communications confidentiality | Art. 5 ePD | Subject to lawful exceptions |
| EP-007 | Apply traffic-data restrictions | Art. 6 ePD | Subject to specified purposes/conditions |
| EP-008 | Apply location-data restrictions | Art. 9 ePD | Consent/anonymisation and other conditions |
| EP-009 | Apply direct-marketing requirements | Art. 13 ePD | Depends on communication type and exception |
| EP-010 | Apply GDPR requirements where personal-data processing occurs | GDPR | Operation-specific |
| EP-011 | Track national implementation separately | ePrivacy Directive | Directive requires national transposition |

---

## 20. Ambiguities / Open Questions

The following should remain explicit research fields rather than hard-coded assumptions:

1. Whether a particular emerging tracking technology falls within Article 5(3).
2. Whether a particular analytics implementation satisfies an Article 5(3) exception.
3. Which Member State's transposition applies in a particular deployment.
4. How national regulators interpret technologies differently.
5. Treatment of browser/device-level preference signals.
6. Treatment of new technical mechanisms not directly addressed by existing national guidance.
7. National approaches to consent-or-pay models.

---

## 21. Conflicts Between Sources

### 21.1 EU-Level vs National Rules

The Directive provides the EU-level framework, while Member States implement it through national law.

Therefore, national guidance may provide more detailed interpretations for a particular jurisdiction.

### 21.2 Emerging Technologies

EDPB Guidelines 2/2023 provide a broad technical interpretation of Article 5(3), including technologies beyond traditional cookies.

National regulator interpretations may differ or provide additional conditions.

**Conflict-handling rule:** Do not silently choose one interpretation. Record:

- Source
- Jurisdiction
- Date
- Exact issue
- Conflicting positions
- Product impact
- Current confidence

---

## 22. Research Notes

- ePrivacy is not equivalent to GDPR.
- Article 5(3) is technology-neutral.
- Cookie compliance cannot be reduced to a cookie-name list.
- Consent is not required where a valid Article 5(3) exception applies.
- National implementation must be represented separately.
- GDPR requirements may apply in addition to ePrivacy where personal data is processed.
- EDPB guidance should be distinguished from legislation and CJEU judgments.
- National regulator guidance should not automatically be generalized across the EU.

---

## 23. Exact Source References

1. **EUR-Lex — Directive 2002/58/EC**  
   Directive on privacy and electronic communications.

2. **EUR-Lex — Directive 2009/136/EC**  
   Amendment containing the current Article 5(3) framework.

3. **CJEU — Case C-673/17, Planet49 GmbH**  
   Judgment of 1 October 2019.

4. **EDPB — Guidelines 2/2023 on the Technical Scope of Article 5(3)**  
   Final version adopted 16 October 2024.

5. **EDPB — Guidelines 05/2020 on Consent under Regulation (EU) 2016/679**

6. **Regulation (EU) 2016/679 — GDPR**  
   Relevant provisions include Articles 4(11), 6, 7, 12–14 and 21.

### Source URLs

- https://eur-lex.europa.eu/eli/dir/2002/58/oj
- https://eur-lex.europa.eu/eli/dir/2009/136/oj
- https://curia.europa.eu/
- https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en

### Source Priority

`EU legislation > CJEU judgments > EDPB guidance > national legislation > national regulator guidance > secondary commentary`
