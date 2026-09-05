import type { NextRequest } from "next/server";
import { z } from "zod";
import { findVariant, getServingExperiment, prisma, recordExperimentEvents } from "database";
import { guardIngest } from "@/lib/ingest-guard";
import { parseJsonBody } from "@/lib/validation";
import { setCorsHeaders } from "@/lib/cors";

/**
 * The banner was shown.
 *
 * **Ingest plane.** Site public key, origin-checked, rate-limited — reachable
 * from any page carrying the key, which is every page the snippet is on and any
 * page somebody copies it to.
 *
 * ## Why this exists at all
 *
 * A banner shown and ignored leaves no consent record. Without impressions an
 * acceptance rate is a percentage of the people who already chose something,
 * which is systematically flattering: the visitors a confusing variant produces
 * more of are precisely the ones who close it without answering, and they would
 * be invisible.
 *
 * ## Everything here is a claim
 *
 * A browser can say anything, so the arm is checked against the experiment
 * actually serving on this site and dropped when it does not match. That bounds
 * the damage to inflating a real arm's impressions rather than inventing arms or
 * writing into another site's experiment. Nothing about a person is stored: the
 * row says an arm was shown, never who saw it.
 */
const bodySchema = z.object({
  experiment_id: z.string().uuid(),
  variant_key: z.string().min(1).max(32),
  // Only impressions. A consent decision belongs in the append-only log, and
  // accepting one here would create a second, weaker path to the same evidence.
  kind: z.literal("impression"),
});

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardIngest(request, {
    limit: "consentWrite",
    route: "experiment-events",
  });
  if (!guard.ok) return guard.response;
  const { caller, allowOrigin } = guard.guarded;

  const parsed = await parseJsonBody(request, bodySchema, { cors: true });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const serving = await getServingExperiment(prisma, caller.siteId);
  const known =
    serving?.experiment_id === input.experiment_id &&
    serving.variants.some((variant) => variant.key === input.variant_key);

  if (!known) {
    // A stale page naming a finished experiment is an ordinary race, not an
    // attack. Accepted and dropped, so a browser cannot use the response to
    // learn which experiments exist.
    return setCorsHeaders(Response.json({ accepted: 0 }, { status: 202 }), allowOrigin);
  }

  const variant = await findVariant(prisma, input.experiment_id, input.variant_key);
  if (!variant) {
    return setCorsHeaders(Response.json({ accepted: 0 }, { status: 202 }), allowOrigin);
  }

  const accepted = await recordExperimentEvents(prisma, [
    {
      organisationId: caller.organisationId,
      siteId: caller.siteId,
      experimentId: input.experiment_id,
      variantId: variant.id,
      kind: "impression",
    },
  ]);

  return setCorsHeaders(Response.json({ accepted }, { status: 202 }), allowOrigin);
}
