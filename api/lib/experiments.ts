import { z } from "zod";
import {
  EXPERIMENT_TEXT_FIELDS,
  transitionProblem,
  validateVariants,
  type ExperimentStatus,
  type ExperimentSummary,
  type ExperimentVariantInput,
  type ValidationProblem,
} from "@rift-cmp/shared/experiment";
import { getApprovedPolicyVersion, getServingExperiment, prisma } from "database";

/**
 * Server-side experiment rules.
 *
 * The safety argument lives in two places and they do different jobs.
 *
 * `shared/experiment.ts` holds the structural guarantee: a variant carries six
 * strings of copy and has nowhere to put a policy. That one cannot be worked
 * around, because there is no field to work around it with.
 *
 * This file holds the situational rules — the ones that depend on what else is
 * true right now. Whether the site already has an experiment running. Whether
 * the policy version an experiment names is one this tenant actually approved.
 * Whether the requested lifecycle move is legal. None of those can be decided
 * from a variant in isolation, and all of them are ways an experiment could be
 * made to mean something other than it says.
 */

// ─── Request schemas ─────────────────────────────────────────────────────────

/**
 * Copy overrides, at the boundary.
 *
 * `.strict()` is doing real work: it rejects any key outside the six rather than
 * stripping it. A stripped key is an operator believing their experiment varies
 * something it does not, and reading a null result as evidence about a change
 * that never shipped.
 */
export const variantTextSchema = z
  .object({
    title: z.string().max(400).nullable().optional(),
    body: z.string().max(400).nullable().optional(),
    accept_all: z.string().max(400).nullable().optional(),
    reject_all: z.string().max(400).nullable().optional(),
    manage: z.string().max(400).nullable().optional(),
    save: z.string().max(400).nullable().optional(),
  })
  .strict();

export const variantSchema = z.object({
  key: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  allocation: z.number(),
  text: variantTextSchema.nullable().optional(),
  is_control: z.boolean().optional(),
});

export const experimentBodySchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  policy_version_id: z.string().uuid().nullable().optional(),
  variants: z.array(variantSchema).min(1).max(10),
});

export const experimentUpdateSchema = experimentBodySchema.partial().omit({ site_id: true });

/** Wire shape to the domain shape. */
export function toVariantInputs(
  variants: ReadonlyArray<z.infer<typeof variantSchema>>,
): ExperimentVariantInput[] {
  return variants.map((variant) => ({
    key: variant.key,
    name: variant.name,
    description: variant.description ?? null,
    allocation: variant.allocation,
    text: variant.text ?? null,
    isControl: variant.is_control === true,
  }));
}

// ─── Situational validation ──────────────────────────────────────────────────

export interface ExperimentCheckInput {
  organisationId: string;
  siteId: string;
  /** Set when editing, so an experiment does not collide with itself. */
  experimentId?: string;
  policyVersionId?: string | null;
  variants: readonly ExperimentVariantInput[];
  /** True when the check is for something about to serve visitors. */
  starting: boolean;
}

/**
 * Everything that has to be true before an experiment may exist or run.
 *
 * Returns problems rather than throwing, and returns *all* of them rather than
 * the first: an operator fixing a configuration one error per round-trip gives
 * up, and a dangerous configuration corrected halfway is still dangerous.
 */
export async function checkExperiment(
  input: ExperimentCheckInput,
): Promise<ValidationProblem[]> {
  const problems: ValidationProblem[] = [...validateVariants(input.variants)];

  // A policy version this tenant did not approve. Naming somebody else's — or
  // one that does not exist — would let an experiment claim it was measured
  // against a configuration it never ran under.
  if (input.policyVersionId) {
    const approved = await getApprovedPolicyVersion(
      prisma,
      input.organisationId,
      input.siteId,
    );
    if (!approved || approved.policy_version_id !== input.policyVersionId) {
      problems.push({
        field: "policy_version_id",
        message:
          "That is not the approved consent configuration for this site. An experiment is measured against what the site is actually serving.",
      });
    }
  }

  if (input.starting) {
    // Two overlapping experiments on one banner interact: a visitor in arm B of
    // one and arm A of the other sees a combination neither was designed to
    // test, and the two results cannot be separated afterwards from any data
    // that was kept.
    const serving = await getServingExperiment(prisma, input.siteId);
    if (serving && serving.experiment_id !== input.experimentId) {
      problems.push({
        field: "status",
        message:
          "Another experiment is already running on this site. Two experiments varying the same banner produce results neither of them can be read from.",
      });
    }
  }

  return problems;
}

/** Lifecycle move, as a problem list so it composes with the rest. */
export function checkTransition(
  from: ExperimentStatus,
  to: ExperimentStatus,
): ValidationProblem[] {
  const problem = transitionProblem(from, to);
  return problem ? [{ field: "status", message: problem }] : [];
}

/**
 * Whether an experiment's definition may still be edited.
 *
 * Only before it has served anything. Editing an allocation mid-run reassigns
 * some visitors — a browser bucketed at 55 moves from a 50/50 arm to a 70/30 one
 * — so a person who accepted under one banner would have their decision counted
 * against another. There is no correct merge, so the answer is not to allow one.
 */
export function isEditable(status: ExperimentStatus): boolean {
  return status === "DRAFT" || status === "SCHEDULED";
}

export function editabilityProblem(status: ExperimentStatus): ValidationProblem | null {
  if (isEditable(status)) return null;
  return {
    field: "status",
    message:
      status === "PAUSED"
        ? "A paused experiment has already assigned visitors to arms. Changing its variants now would move some of them, and their earlier decisions would be counted against an arm they were never shown. Archive it and start a new one."
        : `A ${status.toLowerCase()} experiment cannot be edited. Its results describe the configuration it ran under.`,
  };
}

/** The fields an operator is allowed to vary, for an error message. */
export const VARIABLE_FIELDS = EXPERIMENT_TEXT_FIELDS.join(", ");

/** Trim a summary for a browser-facing surface. Unused server-side; kept honest by type. */
export type { ExperimentSummary };
