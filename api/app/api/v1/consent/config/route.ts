import type { NextRequest } from "next/server";
import {
  getApprovedPolicyVersion,
  hostsForVendor,
  listNotices,
  listPurposes,
  prisma,
} from "database";
import type { ConsentConfigResponse } from "@rift-cmp/shared";
import { setCorsHeaders } from "@/lib/cors";
import { guardIngest } from "@/lib/ingest-guard";
import {
  buildRuntimeConfig,
  enforcementFrom,
  vendorsByPurposeFrom,
} from "@/lib/consent-config";

/**
 * The configuration the consent banner renders.
 *
 * Browser plane, site public key. This is what makes the install snippet one
 * line: the runtime fetches its purposes and copy from here instead of the
 * operator hard-coding a policy into their page, so changing a purpose is a
 * dashboard action rather than a redeploy of somebody else's website.
 *
 * ## What is deliberately not in the response
 *
 * No regime, no jurisdiction, no citation, no requirement, no obligation. The
 * banner renders labels and records choices; it decides nothing. Everything
 * that needed deciding was decided before this was serialised, and putting the
 * reasoning in a payload that ships to every visitor would be both useless to
 * the browser and misleading to anyone reading it, since it would look like the
 * page was applying it.
 *
 * No personal data either. The response describes a site's declared purposes
 * and is identical for every visitor, which is what lets it be cached.
 *
 * ## Why it is public
 *
 * A site public key already ships in page source, so this endpoint is
 * effectively open to anyone who views a customer's HTML. That is acceptable
 * because the response contains only what the operator has chosen to display to
 * every visitor anyway — the same purposes and copy their banner shows. It is
 * rate limited on the read budget regardless, because "public" and "free to
 * hammer" are different things.
 */

export async function GET(request: NextRequest): Promise<Response> {
  const guard = await guardIngest(request, {
    limit: "consentRead",
    route: "consent-config",
  });
  if (!guard.ok) return guard.response;

  const { caller, allowOrigin } = guard.guarded;

  const [purposes, notices, approved] = await Promise.all([
    listPurposes(prisma, caller.organisationId),
    listNotices(prisma, caller.organisationId),
    // Phase 9A. An approved policy version is what an operator agreed the site
    // should offer; where one exists it supplies the vendor list the preference
    // centre shows. It never adds or removes a purpose on its own: a purpose
    // has to be declared in the consent domain for a decision to reference it,
    // and inventing one here would produce a banner recording consent against
    // something the log cannot hold.
    getApprovedPolicyVersion(prisma, caller.organisationId, caller.siteId),
  ]);

  // The notice in force is the most recently published one. `listNotices`
  // returns them oldest first, so the last is current.
  const current = notices.length > 0 ? notices[notices.length - 1] : null;

  // A notice names the purposes it disclosed. Where one exists, the banner
  // shows exactly those — a purpose the current notice does not disclose has
  // not been explained to the visitor, and offering a toggle for it would
  // collect a choice about something they were never told about.
  const disclosed = current ? new Set(current.purpose_codes) : null;

  const vendorsByPurpose = approved
    ? vendorsByPurposeFrom(approved.recommendations)
    : undefined;

  // Enforcement rules exist only once a policy version is approved. Before
  // that there is nothing an operator has agreed to enforce, and acting on an
  // unapproved recommendation is exactly what Phase 9A refused to do.
  const enforcement = approved
    ? enforcementFrom(approved.recommendations, hostsForVendor)
    : null;

  const config = buildRuntimeConfig({
    siteId: caller.siteId,
    purposes: purposes
      .filter((p) => p.is_active)
      .filter((p) => (disclosed ? disclosed.has(p.code) : true))
      .map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        isActive: p.is_active,
      })),
    vendorsByPurpose,
    enforcement,
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

  const body: ConsentConfigResponse = config;

  const response = Response.json(body, {
    headers: {
      // Short and revalidatable. A purpose change should reach live banners in
      // about a minute; caching for longer would make the dashboard feel
      // broken, and not caching at all would put a database read on every page
      // view of every customer site.
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      etag: `"${config.config_version}"`,
    },
  });
  setCorsHeaders(response, allowOrigin);
  return response;
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  const response = new Response(null, { status: 204 });
  setCorsHeaders(response, request.headers.get("origin"));
  return response;
}
