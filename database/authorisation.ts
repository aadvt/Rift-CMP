import type { ConsentStatus, DecisionReason } from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";
import { getEffectiveConsent } from "./consent";

/**
 * The orchestration layer.
 *
 * This module answers one question:
 *
 *   Is this requested action currently authorised for this Data Principal,
 *   this Fiduciary and this purpose?
 *
 * It is deliberately free of side effects. Asking is not the same as being
 * granted permission, and separating the two is what keeps the consent domain
 * and the secure-routing prototype independent: consent knows nothing about
 * transfers, transfers know nothing about how consent is evaluated, and this
 * module is the only place that joins them.
 *
 * It contains no cryptography, creates no rows, and applies no legal rules
 * beyond "the current decision must be GRANTED". Which purposes require consent
 * in the first place is a question for a compliance engine, above this layer.
 */

export type { DecisionReason };

/** Everything the decision resolved, available only when it permitted the action. */
export interface DecisionContext {
  siteId: string;
  principalId: string;
  purposeId: string;
  /** The exact append-only decision relied upon. */
  consentRecordId: string;
  consentStatus: ConsentStatus;
  /** When the principal made that decision. */
  decidedAt: Date;
}

export type AuthorisationDecision =
  | { permitted: true; context: DecisionContext }
  | { permitted: false; reason: DecisionReason; message: string };

/** Maps a refusing consent status onto the reason it refused. */
function reasonForStatus(status: ConsentStatus): DecisionReason {
  return status === "WITHDRAWN" ? "consent_withdrawn" : "consent_denied";
}

/**
 * Evaluates whether an action is currently permitted. Reads only.
 *
 * Every lookup is scoped to `organisationId`, which the caller derives from an
 * authenticated credential. A site, principal or purpose belonging to another
 * tenant is indistinguishable from one that does not exist, so this cannot be
 * used to probe across tenants.
 */
export async function evaluateAuthorisation(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    principalExternalId: string;
    purposeCode: string;
  },
): Promise<AuthorisationDecision> {
  // 1. The requesting Fiduciary is already identified by the credential; here we
  //    confirm the site it names is actually one of theirs.
  const site = await prisma.website.findFirst({
    where: { id: input.siteId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!site) {
    return {
      permitted: false,
      reason: "site_not_found",
      message: `No site found with id: ${input.siteId}.`,
    };
  }

  // 2. The Data Principal, scoped to that site.
  const principal = await prisma.principal.findUnique({
    where: {
      siteId_externalId: { siteId: site.id, externalId: input.principalExternalId },
    },
    select: { id: true },
  });
  if (!principal) {
    return {
      permitted: false,
      reason: "principal_not_found",
      message: "No principal found on this site with that external id.",
    };
  }

  // 3. The purpose, scoped to the organisation.
  const purpose = await prisma.purpose.findFirst({
    where: { organisationId: input.organisationId, code: input.purposeCode },
    select: { id: true },
  });
  if (!purpose) {
    return {
      permitted: false,
      reason: "purpose_not_found",
      message: `No purpose found with code: ${input.purposeCode}.`,
    };
  }

  // 4. The applicable consent state, derived from the append-only log by the
  //    same shared function the consent API uses. There is one definition of
  //    "current consent" in this codebase and this is not a second one.
  const state = await getEffectiveConsent(prisma, {
    siteId: site.id,
    principalExternalId: input.principalExternalId,
  });
  const decision = state?.effective.find((entry) => entry.purpose_code === input.purposeCode);

  // 5. Absence of a decision is not permission.
  if (!decision) {
    return {
      permitted: false,
      reason: "no_consent_decision",
      message: `No consent decision recorded for "${input.purposeCode}".`,
    };
  }

  if (decision.status !== "GRANTED") {
    return {
      permitted: false,
      reason: reasonForStatus(decision.status),
      message: `Consent for "${input.purposeCode}" is currently ${decision.status}.`,
    };
  }

  return {
    permitted: true,
    context: {
      siteId: site.id,
      principalId: principal.id,
      purposeId: purpose.id,
      consentRecordId: decision.consent_record_id,
      consentStatus: decision.status,
      decidedAt: new Date(decision.decided_at),
    },
  };
}
