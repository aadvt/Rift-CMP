# Jurisdiction Resolution

Phase 7A answers *what does a regime require of this activity?* — once you have
told it which regimes. This is what works out which regimes.

It exists to keep three claims apart, because collapsing them is the standard
mistake:

```text
IP location   !=   residence   !=   applicable law
```

A country derived from a network address is a guess about a connection at an
instant. Residence is a fact about a person. Applicable law is a legal
conclusion that often involves **several jurisdictions at once**, and can attach
for reasons that have nothing to do with where the visitor is standing.

Research artifact, not legal advice.

## Where it lives

| Path | What it is |
| --- | --- |
| `policy/location.ts` | The evidence model: `DetectedLocation`, `LocationSource`, `Confidence`, `VisitorContext` |
| `policy/jurisdiction-rules.ts` | The versioned region → jurisdiction mapping. Configuration, not law |
| `policy/resolve.ts` | `resolveJurisdictions` and `resolveContext` |
| `api/tests/jurisdiction-resolution.test.ts` | 44 tests, one per scenario the brief names |

No table, no migration, no endpoint, no dependency. Nothing imports it.

## Using it

```ts
import { resolveContext } from "@rift-cmp/policy";

const { resolution, decision } = resolveContext(
  {
    signals: [
      { region: "DE", source: "ip_geolocation" },
      { region: "IN", source: "business_target_market" },
    ],
  },
  { actor: "determines_purpose", asOf: new Date("2026-09-04") },
);

resolution.jurisdictions;             // ["EU", "India"]
resolution.confidenceByJurisdiction;  // { EU: "medium", India: "high" }
resolution.reasons;                   // why each one is in the answer
decision.obligations;                 // the Phase 7A reading across both
```

The two artifacts stay separate on the result on purpose. Both halves can
produce `REVIEW`, and a caller has to be able to tell *"we do not know where this
visitor is"* from *"the matrix is silent about this activity"* — one is fixed by
configuring a target market, the other by converting more research.

## The model

| Type | What it holds |
| --- | --- |
| `DetectedLocation` | One dated observation: a region code, a source, a confidence |
| `LocationSource` | Where the observation came from — six values, below |
| `Confidence` | `high` \| `medium` \| `low`, explicit and never collapsed to a number |
| `VisitorContext` | The signals, plus any jurisdiction the operator asserts outright |
| `JurisdictionResolution` | The union, per-jurisdiction confidence, regimes, and the reasoning |
| `ResolutionReason` | One reason a jurisdiction is — or is not — in the answer |

### Sources, and what each is worth

Ordered by how much a legal reading can lean on them, which is **not** the same
as how precise they are. A declared country of residence is vaguer than a
city-level geolocation and worth far more, because it is a claim about the
person rather than about a packet.

| Source | Default confidence | Residence claim? |
| --- | --- | --- |
| `user_declared` | high | yes |
| `authenticated_profile` | high | yes |
| `business_target_market` | high | no |
| `service_context` | high | no |
| `ip_geolocation` | medium | no |
| `request_context` | low | no |

`business_target_market` is high-confidence and is *not* a claim about the
person. That combination is the point: it is a decision the business made and
can evidence, so it is the most reliable input the resolver gets — and it is
what lets a jurisdiction be resolved for a visitor whose whereabouts are
completely unknown, without learning anything new about them.

`request_context` — locale, timezone — is deliberately the weakest thing in the
table. A German speaker in Chicago is not a German data subject.

## The three rules it will not break

**1. Jurisdictions accumulate. There is no winner.** No ranking step, no
best-signal selection, no tie-break. A visitor whose address resolves to Germany,
on a service whose operator offers into India, is in both. This is why
"conflicting signals" needs no special handling: two observations naming
different regions are not in conflict *about the law*, they are two reasons the
law might attach. The disagreement is recorded as a reason; both jurisdictions
are returned.

**2. Confidence never removes a jurisdiction.** A weak signal is reported as weak
and still contributes. Dropping a jurisdiction because the evidence was thin is
exactly the error that produces an under-inclusive reading — the failure that
matters, and the one that looks like success. There is no threshold to tune,
because there is no threshold.

**3. An observation is never promoted to a residence.** Every signal carries
`isResidenceClaim`, true only for `user_declared` and `authenticated_profile`.
The reasoning for anything else says so in words: *"evidence about a connection
or a business decision, not about where this person lives."* Nothing is
persisted; the resolver writes nothing anywhere.

## It refuses to see an IP address

There is no field on `VisitorContext` for one, and a signal whose `region` looks
like an address is **rejected with a reason**, not silently ignored.

The brief asks to keep legal determination separate from IP geolocation, and not
to collect personal information merely to sharpen detection. Accepting a raw
address would breach both at once — and an IP address is personal data in every
regime the matrix carries. So the caller geolocates with whatever it already has
and passes the derived region code. The engine cannot geolocate, in the same way
it cannot decrypt a transfer envelope: the capability is not in its dependency
graph.

Rejection is loud rather than quiet on purpose. A caller that passed an address
and got back "unknown" would conclude its geolocation had failed, rather than
that it had handed over personal data the resolver refuses to accept.

`api/tests/policy-boundary.test.ts` extracts the declared field names from
`DetectedLocation` and `VisitorContext` and fails if any is named for an
address, a user agent, an identifier or a coordinate.

## The rules are configuration, and versioned

`DEFAULT_JURISDICTION_RULES` carries a `version`, and every resolution stamps the
version it used. This is versioned because the mapping genuinely changes — the
United Kingdom was in the `EU` set until it was not.

`GB` is therefore the case that justifies the whole design: it is **recognised
and mapped to nothing**. UK GDPR is a separate instrument the matrix does not
carry, and mapping `GB` to `EU` would assert an equivalence that stopped being
true in 2020.

The default set maps the EU-27 plus the three non-EU EEA states (`IS`, `LI`,
`NO`), `IN`, `BR`, and `US-CA` → `California` *and* the generic `US` model. It
maps only what the matrix can answer for: resolving `JP` to some jurisdiction
with no requirements behind it would produce a confident-looking resolution
followed by an empty evaluation, which is worse than saying up front that
nothing is carried.

A caller can pass its own `JurisdictionRules` — `resolveJurisdictions(visitor,
myRules)` — and the default is untouched.

### Three distinct "no answer" outcomes

Kept apart because they need different fixes:

| Reason | Means |
| --- | --- |
| `region_unrecognised` | Not a well-formed ISO 3166 code. Probably a caller bug — `"Germany"` rather than `"DE"` |
| `region_unmapped` | A valid code this rule set maps to nothing. "Not carried", never "nothing applies" |
| `region_rejected` | It looked like a network address, and was refused |

## How it chains into Phase 7A

When nothing resolves, the empty jurisdiction list is passed to `evaluate`
unchanged, and the evaluator already refuses to guess — it returns `REVIEW` with
`no_jurisdiction_given`. Neither half special-cases the other, and **"we do not
know where they are" cannot become "nothing is required" at the seam.** That is
the single most important property of the integration, and it is tested.

## Limitations

- **Region-level only.** `EU`, `India`, `California`, `US`, `Brazil` — the grain
  the matrix carries. There is no Member State, so the brief's "German/local
  considerations where configured" resolves to `EU` and nothing more specific.
  Every ePrivacy record is Directive-level, and `REQ-EP-020` records the
  obligation to track national transposition separately precisely because the
  research does not. A German question and a French one get the same answer.
- **California is the only US state carried.** Every other state maps to the
  generic model, whose nine records all state absences.
- **No conflict-of-laws rule.** Where two jurisdictions both apply, both are
  returned and the evaluator takes the more restrictive of their requirements.
  Nothing here decides which law *governs*.
- **Confidence is a three-value label, not a probability.** It is not calibrated
  against anything, does not compose across signals beyond taking the strongest,
  and no geolocation provider's own accuracy score is consumed.
- **`service_context` is modelled but unused by the default rules.** It exists so
  a service confined to one market can say so; nothing in the matrix reads it
  differently from any other signal yet.
- **The EU member list is hand-maintained.** There is no authority to derive it
  from at runtime. A wrong list is caught by reading it, which is why it is
  written out rather than computed — and why the rule set is versioned.
- **Nothing is persisted, including the resolution.** There is no record of what
  was resolved for whom, which is deliberate — such a record would be exactly
  the durable location profile this design avoids — and it means there is also
  no audit trail of resolutions.

## Verification

```bash
npm run test:unit    # 263 tests; 44 are jurisdiction resolution
npm run typecheck
npm run lint
```
