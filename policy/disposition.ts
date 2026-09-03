/**
 * What each canonical topic *does* to a processing activity.
 *
 * This is the only table in the engine that turns a requirement into a verdict,
 * and it is keyed on the canonical topic - never on a regime. That is the
 * difference between a policy engine and a pile of GDPR conditionals: adding a
 * seventh regime to the matrix adds rows to the matrix and changes nothing here,
 * because "a notice requirement obliges you to give notice" is not a fact about
 * the GDPR.
 *
 * The brief's instruction was "do not hard-code large sections of GDPR/DPDP/CCPA
 * logic throughout API routes; centralise policy evaluation". Centralising it in
 * one place is necessary but not sufficient - a single file of per-regime
 * branches would satisfy the letter and lose the point. So the constraint this
 * file holds itself to is stronger: **no regime name appears in it.** A test
 * enforces that.
 *
 * Research artifact, not legal advice.
 */

import type { Topic, Verdict } from "./model";

/**
 * How a topic bears on the activity being evaluated.
 *
 * - `gate` - decides whether the activity may proceed at all. The consent and
 *   opt-out fields on the record are what resolve it.
 * - `obligation` - something the caller must do, which does not by itself stop
 *   the activity. It still appears on the decision; it just does not block.
 * - `organisational` - binds the organisation rather than this activity.
 *   Security, retention and accountability duties are real and are cited, but
 *   an evaluator that answered `BLOCK` because a security obligation exists
 *   would be unusable and would not be saying anything true.
 * - `scoping` - selects or dates requirements rather than imposing anything.
 * - `informational` - recorded, cited, never acted on.
 * - `conditional` - the topic turns on facts the matrix does not hold. Always
 *   `REVIEW` unless the caller asserts the conditions.
 */
export type Disposition =
  | "gate"
  | "obligation"
  | "organisational"
  | "scoping"
  | "informational"
  | "conditional";

export interface TopicDisposition {
  readonly disposition: Disposition;
  /**
   * The verdict this topic raises when it applies and is resolvable.
   * Undefined where the topic never raises one on its own.
   */
  readonly verdict: Verdict | undefined;
  /** Why this row is what it is. Read as the justification, not a comment. */
  readonly rationale: string;
}

export const TOPIC_DISPOSITION: Readonly<Record<Topic, TopicDisposition>> = {
  applicability: {
    disposition: "scoping",
    verdict: undefined,
    rationale:
      "A scope record says whether a regime reaches the activity. It selects other rules; it imposes nothing itself.",
  },
  effective_dates: {
    disposition: "scoping",
    verdict: undefined,
    rationale:
      "Commencement and versioning records date other requirements. They are applied through effective_from/effective_to, not as an obligation.",
  },
  lawful_basis: {
    disposition: "conditional",
    verdict: "REVIEW",
    rationale:
      "Which basis is available turns on facts the matrix does not hold. The engine will not pick a lawful basis on a caller's behalf; it reports which the record names and asks.",
  },
  consent: {
    disposition: "gate",
    verdict: "REQUIRE_CONSENT",
    rationale:
      "The clearest gate in the model, and the one the platform already enforces: a consent requirement stops the activity until a decision is in force.",
  },
  tracking_and_storage: {
    disposition: "gate",
    verdict: "REQUIRE_CONSENT",
    rationale:
      "Storage of or access to terminal equipment is gated on consent subject to statutory exceptions. The exceptions are carried as conditions and resolve only on assertion.",
  },
  direct_marketing: {
    disposition: "gate",
    verdict: "REQUIRE_CONSENT",
    rationale:
      "Prior consent gates certain electronic marketing, with an existing-customer exception the matrix records but cannot evaluate.",
  },
  sale_and_sharing: {
    disposition: "gate",
    verdict: "REQUIRE_OPT_OUT",
    rationale:
      "Sale and sharing are permitted subject to an opt-out rather than prohibited, so the gate they raise is an opt-out mechanism, not consent.",
  },
  opt_out_signals: {
    disposition: "obligation",
    verdict: "REQUIRE_OPT_OUT",
    rationale:
      "A duty to honour a preference signal is an obligation on the mechanism, not a bar to the activity.",
  },
  withdrawal: {
    disposition: "obligation",
    verdict: "REQUIRE_USER_ACTION",
    rationale:
      "Withdrawal must be possible where consent is relied on. It obliges a mechanism to exist; it does not stop processing that is currently consented.",
  },
  rights: {
    disposition: "obligation",
    verdict: "REQUIRE_USER_ACTION",
    rationale:
      "Access, deletion, correction and portability oblige the fiduciary to answer a request. They bind the organisation's mechanisms, not this activity's legality.",
  },
  notice: {
    disposition: "obligation",
    verdict: "REQUIRE_NOTICE",
    rationale:
      "Transparency duties attach to the activity and must be discharged, but a notice obligation is not a prohibition.",
  },
  sensitive_data: {
    disposition: "conditional",
    verdict: "REVIEW",
    rationale:
      "Special-category treatment turns on whether the data is in fact of that category and which statutory condition is met. Neither is decidable from the matrix.",
  },
  children: {
    disposition: "conditional",
    verdict: "REVIEW",
    rationale:
      "Every children's record carries an age threshold or a parental-authorisation condition. The engine cannot know the subject's age and will not assume adulthood.",
  },
  international_transfer: {
    disposition: "conditional",
    verdict: "REVIEW",
    rationale:
      "Whether a transfer is permitted turns on the destination and the safeguard in place. All three transfer records in the matrix are consent-conditional.",
  },
  automated_decision_making: {
    disposition: "conditional",
    verdict: "REVIEW",
    rationale:
      "Turns on whether the decision is significant and whether an exception applies; the single record in the matrix is consent-conditional.",
  },
  security: {
    disposition: "organisational",
    verdict: undefined,
    rationale:
      "A standing duty to protect data. Cited so it is visible, never used to block an activity, because it is not a permission question.",
  },
  retention: {
    disposition: "organisational",
    verdict: undefined,
    rationale:
      "Retention limits bind the data's lifecycle rather than this act of processing.",
  },
  accountability: {
    disposition: "organisational",
    verdict: undefined,
    rationale:
      "Records, assessments and demonstrability bind the organisation. Blocking on them would make every decision BLOCK and mean nothing.",
  },
  vendor_relationship: {
    disposition: "organisational",
    verdict: undefined,
    rationale:
      "Contractual and instruction duties between the parties. Surfaced when a vendor is in the context, but a contract term is not a gate on the processing.",
  },
  non_discrimination: {
    disposition: "obligation",
    verdict: "REQUIRE_USER_ACTION",
    rationale:
      "A bar on penalising someone for exercising a right. It constrains the response to a user action, which is why it is recorded against one.",
  },
  enforcement: {
    disposition: "informational",
    verdict: undefined,
    rationale:
      "Penalty and supervisory provisions describe consequences of breach. They are context for a reader and never an input to whether an activity may proceed.",
  },
};

/**
 * Topics whose rules stop the activity until resolved.
 *
 * Derived from the table rather than listed again, so the two cannot drift.
 */
export const GATE_TOPICS: ReadonlySet<Topic> = new Set(
  (Object.keys(TOPIC_DISPOSITION) as Topic[]).filter(
    (t) => TOPIC_DISPOSITION[t].disposition === "gate",
  ),
);
