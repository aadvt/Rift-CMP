import { z } from "zod";
import type { VendorRecommendation } from "@rift-cmp/shared";
import { getAiProvider, type AiProvider } from "./provider";

/**
 * What a model said, after it has been checked.
 *
 * ## Nothing here is trusted on arrival
 *
 * A model's reply is text from outside the system. It is parsed, validated
 * against a strict schema, and then checked a second time against the evidence
 * that was sent — because a schema only proves the shape is right, not that the
 * content refers to anything real. A reply naming a vendor that was never in
 * the request is discarded, not repaired: a plausible answer about the wrong
 * thing is worse than no answer.
 *
 * ## Failure is always the same failure
 *
 * No provider, a timeout, malformed JSON, a schema violation, an unknown id, a
 * confidence outside 0–1 — every one of them produces `null`, and every caller
 * carries on with the deterministic result alone. There is deliberately no path
 * where a bad reply degrades into a permissive answer, because the one thing an
 * unvalidated model must never be able to do is turn "we do not know" into
 * "allow".
 */

/** 0–1. Anything outside it means the model was not answering the question asked. */
const confidence = z.number().min(0).max(1);

const AssistedVendor = z.object({
  /** Must match a detector id that was sent. Checked again below. */
  detector_id: z.string().min(1).max(200),
  /** Suggested category. Advisory — the catalogue remains authoritative. */
  suggested_category: z.string().min(1).max(64).nullable(),
  /** Free text, shown to a person, never parsed for meaning. */
  reasoning: z.string().min(1).max(2000),
  confidence,
  /** Which pieces of the supplied evidence the model says it used. */
  evidence_used: z.array(z.string().max(500)).max(20),
  /** True when the model thinks the evidence does not settle it. */
  ambiguous: z.boolean(),
});

const AssistedPriority = z.object({
  detector_id: z.string().min(1).max(200),
  /** 1 is most urgent. Only ever reorders; never adds or removes. */
  rank: z.number().int().min(1).max(500),
  reasoning: z.string().min(1).max(1000),
});

const VendorAssistSchema = z.object({ vendors: z.array(AssistedVendor).max(100) }).strict();
const PrioritySchema = z.object({ order: z.array(AssistedPriority).max(500) }).strict();
const ExplanationSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    ambiguities: z.array(z.string().max(500)).max(20),
    confidence,
  })
  .strict();

export type AssistedVendorNote = z.infer<typeof AssistedVendor>;
export type AiExplanation = z.infer<typeof ExplanationSchema>;

/** Everything advisory that reached a caller, with its provenance attached. */
export interface AiAssistance {
  /** `anthropic`, `openai`… so a reader knows who said it. */
  provider: string;
  model: string;
  /** Always true. Nothing here is a decision. */
  advisory: true;
  vendors: AssistedVendorNote[];
  explanation: AiExplanation | null;
  priority: Array<{ detector_id: string; rank: number; reasoning: string }>;
}

/** Models like to wrap JSON in prose or fences. Both are recoverable; neither is trusted. */
function parseJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? content).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    // A model that cannot produce JSON is treated as unavailable, which is the
    // same outcome as every other failure here.
    return null;
  }
}

async function ask<T>(
  provider: AiProvider,
  task: Parameters<AiProvider["complete"]>[0]["task"],
  evidence: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<{ value: T; provider: string; model: string } | null> {
  try {
    const raw = await provider.complete({ task, evidence });
    const parsed = schema.safeParse(parseJson(raw.content));
    if (!parsed.success) return null;
    return { value: parsed.data, provider: raw.provider, model: raw.model };
  } catch {
    // Timeout, network, non-200, abort. All indistinguishable from no provider,
    // and all handled the same way by every caller.
    return null;
  }
}

/**
 * A second opinion on the recommendations, or nothing at all.
 *
 * The deterministic recommendations are passed in and returned untouched. What
 * comes back is commentary *about* them, keyed by detector id, which the caller
 * attaches without letting it change an action, a purpose or a requirement.
 */
export async function assistRecommendations(input: {
  recommendations: VendorRecommendation[];
  jurisdictions: string[];
  /** Injected in tests. Defaults to whatever the environment configured. */
  provider?: AiProvider | null;
}): Promise<AiAssistance | null> {
  const provider = input.provider === undefined ? getAiProvider() : input.provider;
  if (!provider) return null;
  if (input.recommendations.length === 0) return null;

  // Only what the model needs. Nothing about a principal, no consent records,
  // no keys — an evidence bundle is the one place tenant data leaves the system,
  // so it carries the minimum that makes the question answerable.
  const known = new Set(input.recommendations.map((r) => r.detector_id));
  const evidence = {
    jurisdictions: input.jurisdictions,
    vendors: input.recommendations.map((r) => ({
      detector_id: r.detector_id,
      vendor_name: r.vendor_name,
      category: r.category,
      scanner_confidence: r.confidence,
      deterministic_action: r.recommended_action,
      consent_requirement: r.consent_requirement,
      evidence: r.evidence.map((e) => e.detail).slice(0, 5),
    })),
  };

  const [vendors, explanation, priority] = await Promise.all([
    ask(provider, "classify_vendor", evidence, VendorAssistSchema),
    ask(provider, "explain_recommendation", evidence, ExplanationSchema),
    ask(provider, "prioritise", evidence, PrioritySchema),
  ]);

  // Nothing usable came back. Same as no provider.
  if (!vendors && !explanation && !priority) return null;

  // The second check: a valid shape can still name something that was never
  // sent. A note about a vendor this site does not have is either a
  // hallucination or evidence from another tenant's request, and both are
  // dropped without ceremony.
  const notes = (vendors?.value.vendors ?? []).filter((v) => known.has(v.detector_id));
  const order = (priority?.value.order ?? []).filter((p) => known.has(p.detector_id));

  const source = vendors ?? explanation ?? priority;

  return {
    provider: source?.provider ?? provider.name,
    model: source?.model ?? "unknown",
    advisory: true,
    vendors: notes,
    explanation: explanation?.value ?? null,
    priority: order,
  };
}

/**
 * Prose about a jurisdiction resolution, never a resolution of its own.
 *
 * The resolver decides which jurisdictions apply and this cannot change that.
 * It is handed the answer and asked to explain it, so the worst a bad reply can
 * do is be unhelpful — never to add a jurisdiction, remove one, or assert that
 * a regulation does or does not apply.
 */
export async function explainJurisdictions(input: {
  jurisdictions: string[];
  regimes: string[];
  openQuestions: Array<{ reason: string; detail: string }>;
  provider?: AiProvider | null;
}): Promise<(AiExplanation & { provider: string; model: string; advisory: true }) | null> {
  const provider = input.provider === undefined ? getAiProvider() : input.provider;
  if (!provider) return null;
  if (input.jurisdictions.length === 0 && input.regimes.length === 0) return null;

  const result = await ask(
    provider,
    "explain_jurisdiction",
    {
      resolved_jurisdictions: input.jurisdictions,
      regimes: input.regimes,
      questions_the_engine_would_not_answer: input.openQuestions.slice(0, 12),
    },
    ExplanationSchema,
  );

  if (!result) return null;

  return { ...result.value, provider: result.provider, model: result.model, advisory: true };
}
