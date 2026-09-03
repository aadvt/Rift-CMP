import type { NextRequest } from "next/server";
import { z } from "zod";
import { openConsentSession, prisma } from "database";
import type { ConsentSessionResponse } from "@rift-cmp/shared";
import { PRINCIPAL_SECRET_PREFIX } from "@rift-cmp/shared";
import { jsonError, setCorsHeaders } from "@/lib/cors";
import { guardIngest } from "@/lib/ingest-guard";

/**
 * Opens a consent session: the thing `POST /api/v1/consent` now requires.
 *
 * ## The problem this endpoint exists to solve
 *
 * A site public key is printed in page source. Before Phase 6A it was the only
 * credential `POST /api/v1/consent` asked for, which meant anyone could append
 * `GRANTED` for any `principal_external_id` on any site — permanently, because
 * the log is append-only. A forged record is worse than no record: it is
 * evidence of a decision that was never made.
 *
 * ## What a session binds
 *
 * A session names one site and one principal, and it is issued only to a caller
 * that either
 *
 *  - is creating a brand new principal (the server mints the identifier *and* a
 *    secret, and hands both back exactly once), or
 *  - proves possession of an existing principal's secret.
 *
 * So a decision can only ever be recorded against a principal whose secret the
 * caller holds. Knowing a principal identifier — from an audit export, a shared
 * device, a log line — is no longer enough.
 *
 * ## What it does not prove, stated plainly
 *
 * It does not prove a human clicked anything. A scripted client can open a
 * session, mint a principal and record decisions about that principal all day;
 * what it cannot do is speak for somebody else's principal. Proving human
 * intent from a browser is not something this or any comparable mechanism
 * achieves, and pretending otherwise would be the dishonest part. The limits are
 * enumerated in docs/security.md.
 */

const sessionSchema = z
  .object({
    principal_external_id: z.string().min(1).max(200).optional(),
    principal_secret: z
      .string()
      .min(PRINCIPAL_SECRET_PREFIX.length + 1)
      .max(200)
      .optional(),
  })
  // Strict for the same reason every other browser-facing body is: the tenant
  // comes from the credential, so naming one is an error, not a hint.
  .strict()
  .refine(
    (value) =>
      (value.principal_external_id === undefined) === (value.principal_secret === undefined),
    {
      message:
        "principal_external_id and principal_secret must be sent together, or both omitted to mint a new principal",
    },
  );

export async function OPTIONS() {
  return setCorsHeaders(new Response(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  const guard = await guardIngest(request, {
    limit: "consentSession",
    route: "consent-session",
  });
  if (!guard.ok) return guard.response;
  const { caller, allowOrigin } = guard.guarded;

  // An empty body is the common case — a first-time browser has nothing to
  // present — so it is treated as `{}` rather than as malformed JSON.
  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError("invalid_json", "Request body must be valid JSON.", [], 400, {
        allowOrigin,
      });
    }
  }

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "Invalid consent session request.",
      parsed.error.issues.map((issue) => ({
        code: "invalid_request" as const,
        message: `${issue.path.join(".") || "body"}: ${issue.message}`,
      })),
      400,
      { allowOrigin },
    );
  }

  const result = await openConsentSession(prisma, {
    siteId: caller.siteId,
    principalExternalId: parsed.data.principal_external_id ?? null,
    principalSecret: parsed.data.principal_secret ?? null,
    origin: request.headers.get("origin"),
  });

  if (!result.ok) {
    // One response for "no such principal" and "wrong secret" alike, so this
    // cannot be used to enumerate which principals a site has.
    return jsonError("unauthorized", result.message, [], 401, { allowOrigin });
  }

  const responseBody: ConsentSessionResponse = {
    site_id: caller.siteId,
    principal_external_id: result.principalExternalId,
    principal_secret: result.principalSecret,
    session_token: result.sessionToken,
    expires_at: result.expiresAt.toISOString(),
    max_decisions: result.maxDecisions,
  };

  return setCorsHeaders(
    Response.json(responseBody, {
      status: 201,
      // A credential must never sit in a shared or browser cache.
      headers: { "Cache-Control": "no-store" },
    }),
    allowOrigin,
  );
}
