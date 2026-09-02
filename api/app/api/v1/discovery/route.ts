import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, recordDiscoveryReport } from "database";
import { COMPONENT_KINDS, STORAGE_KINDS } from "@rift-cmp/shared";
import { jsonError, setCorsHeaders } from "@/lib/cors";
import { authenticateIngest } from "@/lib/auth";

/**
 * The browser-facing discovery plane, authenticated with the site public key —
 * the same credential the SDK already uses for events and consent.
 *
 * Reports are write-only here. A public key can contribute observations about
 * the site it belongs to and cannot read the inventory back; that is the
 * management plane's job (`GET /api/v1/discovery/inventory`), because the
 * inventory names every vendor a business uses and is not something a key
 * visible in page source should expose.
 */

/**
 * Hostname only. Rejecting anything with a scheme, path, port, credentials or
 * query is a deliberate second line of defence: the SDK already strips these,
 * and an SDK that stopped doing so correctly must fail loudly here rather than
 * quietly filling the database with URLs that can carry identifiers.
 */
const hostSchema = z
  .string()
  .min(1)
  .max(253)
  // A bare hostname, optionally with a port: `location.host` carries one on
  // any non-default port, so rejecting it would reject every site not served
  // on 80 or 443. Still no scheme, path, credentials or query.
  .regex(/^[a-z0-9.-]+(?::\d{1,5})?$/i, "host must be a bare hostname, optionally with a port")
  .refine((value) => !value.includes(".."), "host must not contain empty labels");

/** Paths are kept for context but must never carry a query string or fragment. */
const pathSchema = z
  .string()
  .max(160)
  .refine((value) => !value.includes("?") && !value.includes("#"), {
    message: "sample_path must not contain a query string or fragment",
  });

const destinationSchema = z.object({
  host: hostSchema,
  kind: z.enum(COMPONENT_KINDS),
  initiator: z.string().max(200).nullish().transform((v) => v ?? null),
  sample_path: pathSchema.nullish().transform((v) => v ?? null),
  third_party: z.boolean(),
  request_count: z.number().int().min(1).max(100_000),
  first_seen: isoTimestamp(),
});

const storageSchema = z.object({
  kind: z.enum(STORAGE_KINDS),
  name: z.string().min(1).max(120),
  writer: z.string().max(200).nullish().transform((v) => v ?? null),
  first_seen: isoTimestamp(),
});

const violationSchema = z.object({
  host: hostSchema,
  purpose_code: z.string().min(1).max(100),
  consent_status: z.string().min(1).max(40),
  observed_at: isoTimestamp(),
});

const reportSchema = z
  .object({
    site_id: z.string().min(1),
    page_url: pathSchema.or(z.string().url()).pipe(
      z.string().refine((value) => !value.includes("?") && !value.includes("#"), {
        message: "page_url must not contain a query string or fragment",
      }),
    ),
    collected_at: isoTimestamp(),
    schema_version: z.number().int().min(1),
    source: z.string().min(1).max(80),
    destinations: z.array(destinationSchema).max(200),
    storage: z.array(storageSchema).max(200),
    violations: z.array(violationSchema).max(100),
  })
  // Strict: the tenant comes from the credential, so any attempt to widen the
  // payload is a validation error rather than a silently ignored field.
  .strict();

function isoTimestamp() {
  return z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be a valid RFC3339 timestamp",
  });
}

export async function OPTIONS() {
  return setCorsHeaders(new Response(null, { status: 204 }));
}

/** Accepts one page view's worth of observations for the authenticated site. */
export async function POST(request: NextRequest) {
  const auth = await authenticateIngest(request);
  if (!auth.ok) return auth.response;
  const { siteId } = auth.caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "Invalid discovery report.",
      parsed.error.issues.map((issue) => ({
        code: "invalid_request" as const,
        message: `${issue.path.join(".") || "body"}: ${issue.message}`,
      })),
    );
  }

  // `site_id` in the body is ignored in favour of the credential's site, so a
  // report cannot be attributed to a site the caller does not hold a key for.
  try {
    const result = await recordDiscoveryReport(prisma, {
      siteId,
      report: { ...parsed.data, site_id: siteId },
    });
    return setCorsHeaders(Response.json(result, { status: 202 }));
  } catch (error) {
    console.error("[rift-cmp] failed to record discovery report", error);
    return jsonError("ingest_failed", "Failed to record discovery report.", [], 500);
  }
}
