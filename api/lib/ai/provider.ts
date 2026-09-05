/**
 * Refuses to run in a browser.
 *
 * The `server-only` package would do this at build time, but it throws on
 * import under a plain Node test runner, which would make the one layer that
 * most needs testing the one layer that cannot be tested. This check gives the
 * same protection where it matters — a bundle that reached a browser would fail
 * loudly on first use rather than leaking a key quietly.
 */
if (typeof window !== "undefined") {
  throw new Error("Rift AI provider must never be imported into browser code.");
}

/**
 * An optional second opinion, behind a door that is shut by default.
 *
 * ## Why this is an abstraction rather than a call to one vendor
 *
 * Not to be tidy. A model's answer here can influence what an operator is told
 * about their own privacy posture, and being able to change or remove the model
 * without touching that reasoning is the difference between a feature and a
 * dependency. Everything downstream takes `AiProvider`, so "no provider" is an
 * ordinary value rather than a missing import.
 *
 * ## What a model is allowed to do
 *
 * Explain, summarise, prioritise, and say when evidence is ambiguous.
 *
 * It cannot decide. The deterministic engine already produced a recommendation
 * from the requirement matrix and the scan, and that recommendation is what an
 * operator approves. A model's output rides alongside it, marked as advisory,
 * and is discarded entirely if it fails validation. There is deliberately no
 * code path where a model's answer becomes a policy, an approval, an
 * enforcement change, or an ALLOW.
 *
 * ## Secrets stay here
 *
 * `server-only` makes importing this from a client component a build error
 * rather than a runtime leak. The key is read from the environment at call
 * time, never returned, never logged, and never included in a response.
 */

export interface AiRequest {
  /** What is being asked for. Providers may prompt differently per task. */
  task: "classify_vendor" | "explain_recommendation" | "explain_jurisdiction" | "prioritise";
  /**
   * The evidence, already gathered and already scoped to the caller's site.
   * Providers receive this verbatim and must not fetch anything themselves.
   */
  evidence: Record<string, unknown>;
  /** Milliseconds. A provider that cannot answer in time is treated as absent. */
  timeoutMs?: number;
}

export interface AiRawResult {
  /** The model's answer as text or JSON. Validated by the caller, never trusted. */
  content: string;
  /** Which provider and model answered, for the audit trail. */
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  /**
   * Answers, or throws. Callers treat a throw exactly like an absent provider:
   * the deterministic result stands alone.
   */
  complete(request: AiRequest): Promise<AiRawResult>;
}

/** How long a model gets before it is treated as unavailable. */
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * The provider configured for this deployment, or null.
 *
 * Null is the expected state. Every caller has to handle it, which is what
 * makes "works without AI" a property of the design rather than a promise in a
 * README.
 */
export function getAiProvider(): AiProvider | null {
  const key = process.env.RIFT_AI_API_KEY;
  if (!key) return null;

  const provider = (process.env.RIFT_AI_PROVIDER ?? "anthropic").toLowerCase();
  const model = process.env.RIFT_AI_MODEL ?? defaultModelFor(provider);
  const baseUrl = process.env.RIFT_AI_BASE_URL ?? defaultBaseUrlFor(provider);

  if (!baseUrl) return null;

  return {
    name: provider,
    async complete(request) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(baseUrl, {
          method: "POST",
          signal: controller.signal,
          headers: headersFor(provider, key),
          body: JSON.stringify(bodyFor(provider, model, request)),
        });

        if (!response.ok) {
          // The status, never the body. A provider's error body can echo the
          // prompt back, and the prompt contains a tenant's site data.
          throw new Error(`AI provider responded ${response.status}`);
        }

        return { content: extractContent(provider, await response.json()), provider, model };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function defaultModelFor(provider: string): string {
  if (provider === "openai") return "gpt-4o-mini";
  return "claude-haiku-4-5-20251001";
}

function defaultBaseUrlFor(provider: string): string | null {
  if (provider === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  // An unrecognised provider is treated as no provider rather than guessed at.
  return null;
}

function headersFor(provider: string, key: string): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
  }
  return { "content-type": "application/json", authorization: `Bearer ${key}` };
}

/**
 * The instruction every task inherits.
 *
 * Stated to the model as well as enforced in code. The enforcement is what
 * actually holds — a model told not to invent things still will — but saying it
 * costs nothing and makes the intent legible to whoever reads the prompt next.
 */
const SYSTEM =
  "You assist a privacy engineering tool. You are given observations from a website scan. " +
  "Explain and classify only from the evidence provided. Never assert legal conclusions, " +
  "never state that something is compliant or non-compliant, and say plainly when the " +
  "evidence does not support an answer. Reply with JSON only, matching the requested shape.";

function bodyFor(provider: string, model: string, request: AiRequest): unknown {
  const prompt = `Task: ${request.task}\n\nEvidence:\n${JSON.stringify(request.evidence, null, 2)}`;

  if (provider === "anthropic") {
    return {
      model,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    };
  }

  return {
    model,
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
  };
}

function extractContent(provider: string, payload: unknown): string {
  const body = payload as Record<string, unknown>;

  if (provider === "anthropic") {
    const content = body.content as Array<{ type: string; text?: string }> | undefined;
    return content?.find((part) => part.type === "text")?.text ?? "";
  }

  const choices = body.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content ?? "";
}
