import type { NextRequest } from "next/server";
import { z } from "zod";
import { crawl } from "@rift-cmp/crawler";
import { classifyHost } from "database";
import type { PreviewScanResponse, PreviewTechnology } from "@rift-cmp/shared";
import { PREVIEW_NOTE, likelyNeedsConsent } from "@rift-cmp/shared";
import { clientAddress, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError } from "@/lib/cors";

/**
 * A scan for somebody who has not signed up.
 *
 * **Public.** The only unauthenticated endpoint that launches a browser, which
 * makes it the only one where a stranger gets to spend the server's CPU and
 * network on a target they chose. Three things hold that down:
 *
 *   The rate limit is the tightest in the system — three a minute per address.
 *   The crawl budget is small: three pages, thirty seconds, then it stops.
 *   The crawler's own SSRF guard rejects private and link-local targets before a
 *   browser is started, which is the same guard a real scan goes through.
 *
 * ## It writes nothing
 *
 * No site, no scan row, no observations, no organisation. `crawl()` performs no
 * persistence of its own, and this route adds none — the result is computed,
 * serialised and forgotten.
 *
 * That is the whole reason this endpoint can exist. The alternative was to
 * create an organisation for a visitor before they asked for one, which either
 * leaves orphan rows behind or quietly makes somebody an account they never
 * agreed to.
 *
 * ## What it does not claim
 *
 * `likely_needs_consent` is a heuristic over the scanner's category, not a
 * finding. The real answer comes from the policy engine once an operator has
 * declared their markets and purposes, and neither exists for a stranger. The
 * field is named to say so, and the response carries a note about what a
 * three-page preview is and is not.
 */
const bodySchema = z.object({
  url: z.string().min(1).max(2048),
});

/** Deliberately small. Somebody on a landing page will not wait two minutes. */
const PREVIEW_LIMITS = {
  maxPages: 3,
  maxDepth: 1,
  maxDurationMs: 30_000,
  concurrency: 2,
  navigationTimeoutMs: 12_000,
  maxRequests: 300,
  maxCookies: 120,
  maxScripts: 120,
  maxStorageItems: 80,
} as const;

export async function POST(request: NextRequest): Promise<Response> {
  const address = clientAddress(request);

  const limited = enforceRateLimit(`preview-scan:${address}`, RATE_LIMITS.previewScan, (retryAfter) =>
    jsonError(
      "rate_limited",
      `Preview scans are limited while you are signed out. Try again in ${retryAfter} seconds, or create an account to scan properly.`,
      [],
      429,
    ),
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Request body must be valid JSON.", [], 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", "Send a website address to scan.", [], 400);
  }

  const url = /^https?:\/\//i.test(parsed.data.url.trim())
    ? parsed.data.url.trim()
    : `https://${parsed.data.url.trim()}`;

  const started = Date.now();

  let result: Awaited<ReturnType<typeof crawl>>;
  try {
    result = await crawl({ startUrl: url, limits: PREVIEW_LIMITS });
  } catch (error) {
    // A rejected start URL, an unreachable host, or a site that refused to
    // load. Reported as a 422 rather than a 500: nothing is broken here, the
    // address simply could not be crawled, and the visitor needs to know which.
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^Start URL rejected:\s*/i, "")
        : "That site could not be reached.";

    return jsonError(
      "invalid_request",
      `Rift could not scan that address. ${message}`,
      [],
      422,
    );
  }

  // ── Shape the observations into something a stranger can read ──
  //
  // Unclassified entries are dropped here. The detector emits one per unmatched
  // third-party host, so a large site produces dozens of "technologies" that are
  // really just hostnames the catalogue has never heard of. Counting those as
  // things Rift identified would inflate the number with the exact cases where
  // it identified nothing — and the breadth they represent is already reported
  // honestly as third-party domains.
  const technologies: PreviewTechnology[] = result.technologies
    .filter((tech) => tech.category.toLowerCase() !== "unclassified")
    .map((tech) => {
      // The catalogue knows where a vendor is; the crawler does not.
      const classified = classifyHost(
        tech.evidence.find((e) => e.type === "network_host")?.value ?? "",
      );

      return {
        name: tech.name,
        category: tech.category,
        confidence: tech.confidence,
        destination_country: classified.destination_country,
        crosses_border: classified.crosses_border,
        likely_needs_consent: likelyNeedsConsent(tech.category),
      };
    });

  const destinations = [
    ...new Map(
      result.requests
        .filter((r) => r.isThirdParty)
        .map((r) => {
          const classified = classifyHost(r.host);
          return [
            r.host,
            {
              host: r.host,
              country: classified.destination_country,
              crosses_border: classified.crosses_border,
            },
          ] as const;
        }),
    ).values(),
  ];

  const body_: PreviewScanResponse = {
    scan: {
      url,
      scanned_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      summary: {
        pages_scanned: result.summary.pagesScanned,
        cookies: result.summary.cookiesFound,
        third_party_domains: result.summary.thirdPartyDomains,
        technologies: technologies.length,
        likely_need_consent: technologies.filter((t) => t.likely_needs_consent).length,
        consent_ui_detected: result.summary.consentUiDetected,
      },
      technologies,
      destinations: destinations.slice(0, 40),
      // Names and domains only. A cookie's *value* is the part that identifies
      // somebody, and it has no business leaving the crawler.
      cookies: result.cookies.slice(0, 40).map((c) => ({
        name: c.name,
        domain: c.domain,
        third_party: c.isThirdParty,
      })),
      pages: result.pages.map((p) => p.url).slice(0, 10),
      limits: {
        truncated: result.summary.limitReached !== null,
        note: PREVIEW_NOTE,
      },
      legal_advice: false,
    },
  };

  return Response.json(body_, { status: 200 });
}
