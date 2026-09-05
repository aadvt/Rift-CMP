import type { NextRequest } from "next/server";
import {
  getApprovedPolicyVersion,
  hostsForVendor,
  listNotices,
  listPurposes,
  prisma,
} from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { requestOrigin } from "@/lib/dashboard/api";
import { buildInstallSnippet, buildPreferencesSnippet } from "@/lib/install-snippet";
import {
  buildRuntimeConfig,
  enforcementFrom,
  vendorsByPurposeFrom,
} from "@/lib/consent-config";

/**
 * The snippet for one site, and whether it has ever reported.
 *
 * **Management plane only.** The snippet itself is not a secret — it contains
 * only the site id, the public key and this origin — but the activity beside it
 * is operational data about a tenant's site, so the whole response takes the
 * organisation secret.
 *
 * ## Why the snippet is served rather than composed by the caller
 *
 * `lib/install-snippet.ts` already builds the one thing a customer pastes, and
 * it bakes in the API origin. A dashboard that assembled its own copy would hold
 * a second opinion about what the snippet says, and the first time the runtime
 * changed shape the two would disagree — with the wrong one being the copy the
 * customer actually pasted. So the string is built once, here, from the same
 * function the rest of the platform uses.
 *
 * ## What `activity` is, and what it is not
 *
 * It is evidence that this site's public key has been used: sessions started,
 * events received, consent decisions recorded, and when the first and last of
 * each arrived. It is **not** a verdict about whether an installation is
 * correct. Nothing here says "installed" or "broken" — a caller that has not
 * seen a page view for a week knows something worth saying, and the words for
 * that belong to the surface talking to a person, not to this route.
 *
 * Counts are lifetime rather than windowed, because the question this answers
 * is "has this ever worked", which a 30-day window would silently answer wrong
 * for a site that was installed and then went quiet.
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const [purposes, notices, approved] = await Promise.all([
    listPurposes(prisma, auth.caller.organisationId),
    listNotices(prisma, auth.caller.organisationId),
    getApprovedPolicyVersion(prisma, auth.caller.organisationId, siteId),
  ]);

  // Same derivation the browser plane uses in `/api/v1/consent/config`, so the
  // version an operator is told they installed is the version a visitor's
  // banner reports. Re-deriving it differently here is exactly the kind of
  // second opinion that makes a support conversation impossible.
  const current = notices.length > 0 ? notices[notices.length - 1] : null;
  const disclosed = current ? new Set(current.purpose_codes) : null;

  const runtime = buildRuntimeConfig({
    siteId,
    purposes: purposes
      .filter((p) => p.is_active)
      .filter((p) => (disclosed ? disclosed.has(p.code) : true))
      .map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        isActive: p.is_active,
      })),
    ...(approved ? { vendorsByPurpose: vendorsByPurposeFrom(approved.recommendations) } : {}),
    enforcement: approved ? enforcementFrom(approved.recommendations, hostsForVendor) : null,
    notice: current
      ? {
          noticeId: current.notice_id,
          version: current.version,
          locale: current.locale,
          policyVersionId: current.policy_version_id,
          documentUrl: null,
        }
      : null,
  });

  const origin = await requestOrigin();

  const [sessions, events, pageViews, firstEvent, lastEvent, consentDecisions, lastConsent] =
    await Promise.all([
      prisma.session.count({ where: { siteId } }),
      prisma.event.count({ where: { siteId } }),
      prisma.event.count({ where: { siteId, eventType: "page_view" } }),
      prisma.event.findFirst({
        where: { siteId },
        orderBy: { eventTime: "asc" },
        select: { eventTime: true },
      }),
      prisma.event.findFirst({
        where: { siteId },
        orderBy: { eventTime: "desc" },
        select: { eventTime: true },
      }),
      prisma.consentRecord.count({ where: { siteId } }),
      prisma.consentRecord.findFirst({
        where: { siteId },
        orderBy: { decidedAt: "desc" },
        select: { decidedAt: true },
      }),
    ]);

  return Response.json(
    {
      install: {
        site_id: siteId,
        public_key: website.publicKey,
        script_url: `${origin.replace(/\/$/, "")}/js/rift-cmp.js`,
        api_origin: origin.replace(/\/$/, ""),
        snippet: buildInstallSnippet({
          siteId,
          publicKey: website.publicKey,
          origin,
          // A banner on a site with no declared purposes renders nothing, and a
          // snippet that implies otherwise is a snippet an operator debugs for
          // an afternoon before discovering there was nothing to show.
          withBanner: runtime.ready,
        }),
        preferences_snippet: buildPreferencesSnippet(),
        config_version: runtime.config_version,
        config_ready: runtime.ready,
        policy_version: approved
          ? { version: approved.version, approved_at: approved.approved_at }
          : null,
        activity: {
          sessions,
          events,
          page_views: pageViews,
          consent_decisions: consentDecisions,
          first_event_at: firstEvent?.eventTime.toISOString() ?? null,
          last_event_at: lastEvent?.eventTime.toISOString() ?? null,
          last_consent_at: lastConsent?.decidedAt.toISOString() ?? null,
        },
      },
    },
    { status: 200 },
  );
}
