import type { NextRequest } from "next/server";
import type { z } from "zod";
import { jsonError, managementError } from "./cors";

/**
 * Read and validate a JSON request body.
 *
 * Every write endpoint needs the same three steps - parse the body, validate it
 * against a schema, turn failures into the project's error envelope - so they
 * live here once rather than in each route.
 *
 * Pass `cors: true` for the browser-facing plane; management responses omit CORS
 * headers deliberately (see `lib/cors.ts`).
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
  options: { cors?: boolean } = {},
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const fail = options.cors ? jsonError : managementError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: fail("invalid_json", "Request body must be valid JSON.") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail(
        "invalid_request",
        "Request body failed validation.",
        parsed.error.issues.map((issue) => ({
          code: "invalid_request" as const,
          message: `${issue.path.join(".") || "body"}: ${issue.message}`,
        })),
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
