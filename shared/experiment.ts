/**
 * Consent experiments: varying how a choice is asked, never what it means.
 *
 * ## The one sentence that governs this file
 *
 * *Experiments optimise consent UX. They do not redefine consent requirements.*
 *
 * That is enforced structurally rather than by a validator. A variant carries
 * `ExperimentText` — six strings of display copy — and has nowhere to put a
 * purpose, a rule, a jurisdiction, or an action. The path is:
 *
 *     experiment → copy variation → deterministic policy evaluation → enforcement
 *
 * and never
 *
 *     experiment → custom policy → bypass
 *
 * The alternative design, where a variant carries a configuration override that
 * is checked for safety on the way in, was rejected. It puts the guarantee in a
 * validator, and validators get extended by somebody who needs one more field.
 *
 * The guardrails below are therefore not the primary defence — they are a second
 * line, catching the copy that is technically within the schema and still unsafe:
 * a reject button relabelled into meaninglessness, or blanked out entirely.
 *
 * ## Assignment is computed in the browser, and nothing is stored about a person
 *
 * `assignVariant` is a pure function of the experiment id and a per-browser key.
 * The key is generated locally, never transmitted, and never becomes a row: the
 * server learns which arm a decision belongs to, and never which browser is in
 * which arm. There is no assignments table, and that absence is the design.
 *
 * The cost is that a determined visitor could choose their own arm by editing
 * their own storage. That is accepted: the threat model for a copy experiment is
 * an operator drawing a wrong conclusion, not a visitor gaming their own banner,
 * and the alternative — server-side assignment — would require a per-visitor
 * request on a config endpoint that is currently public, cacheable and identical
 * for everyone.
 */

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export type ExperimentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED";

export const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

/**
 * Which transitions are permitted.
 *
 * `COMPLETED` is terminal apart from archiving, and deliberately so. Restarting
 * a finished experiment would append new data to a result somebody may already
 * have acted on, and the two halves would be silently pooled across whatever
 * changed in between. Run a new experiment instead.
 */
const TRANSITIONS: Record<ExperimentStatus, readonly ExperimentStatus[]> = {
  DRAFT: ["SCHEDULED", "RUNNING", "ARCHIVED"],
  SCHEDULED: ["RUNNING", "DRAFT", "ARCHIVED"],
  RUNNING: ["PAUSED", "COMPLETED"],
  PAUSED: ["RUNNING", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionProblem(
  from: ExperimentStatus,
  to: ExperimentStatus,
): string | null {
  if (from === to) return `The experiment is already ${from}.`;
  if (canTransition(from, to)) return null;

  const allowed = TRANSITIONS[from] ?? [];
  if (allowed.length === 0) {
    return `An ${from.toLowerCase()} experiment cannot change state.`;
  }
  return `A ${from.toLowerCase()} experiment cannot become ${to.toLowerCase()}. It can become: ${allowed.join(", ")}.`;
}

/** Whether an experiment should be serving variants right now. */
export function isServing(
  status: ExperimentStatus,
  window: { startsAt?: Date | string | null; endsAt?: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (status !== "RUNNING") return false;

  const starts = window.startsAt ? new Date(window.startsAt) : null;
  const ends = window.endsAt ? new Date(window.endsAt) : null;

  if (starts && now < starts) return false;
  // The end is exclusive: an experiment that ran "until the 5th" should not
  // still be assigning arms on the 5th at 23:59.
  if (ends && now >= ends) return false;
  return true;
}

// ─── Variants ────────────────────────────────────────────────────────────────

/**
 * Everything a variant is allowed to change.
 *
 * Exactly the fields `buildRuntimeConfig` already puts in `text`. Nothing else
 * exists here, and that is the whole safety argument: a variant has no field in
 * which to express a policy difference.
 */
export interface ExperimentText {
  title?: string | null;
  body?: string | null;
  accept_all?: string | null;
  reject_all?: string | null;
  manage?: string | null;
  save?: string | null;
}

export const EXPERIMENT_TEXT_FIELDS: readonly (keyof ExperimentText)[] = [
  "title",
  "body",
  "accept_all",
  "reject_all",
  "manage",
  "save",
];

export interface ExperimentVariantInput {
  key: string;
  name: string;
  description?: string | null;
  allocation: number;
  text?: ExperimentText | null;
  isControl?: boolean;
}

export interface ValidationProblem {
  field: string;
  message: string;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/**
 * The copy that must remain intelligible.
 *
 * Only two are checked this way, and only for emptiness and length. This is not
 * a content classifier and does not pretend to be one — it cannot tell whether
 * "Continue" is an honest reject label. What it catches is the mechanical
 * version: a reject control blanked out, or padded until it no longer reads as
 * a control. A reviewer approves the wording; this stops the shapes that are
 * unsafe regardless of wording.
 */
const MUST_REMAIN_LEGIBLE: readonly (keyof ExperimentText)[] = ["reject_all", "manage"];

export function validateVariants(variants: readonly ExperimentVariantInput[]): ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  if (variants.length < 2) {
    problems.push({
      field: "variants",
      message: "An experiment needs at least two variants; one arm is not a comparison.",
    });
  }

  const seen = new Set<string>();
  let total = 0;
  let controls = 0;

  for (const [index, variant] of variants.entries()) {
    const at = `variants[${index}]`;

    if (!KEY_PATTERN.test(variant.key ?? "")) {
      problems.push({
        field: `${at}.key`,
        message:
          "A variant key is 1-32 characters of lowercase letters, digits, hyphen or underscore. It is recorded on consent decisions, so it has to stay stable and readable.",
      });
    } else if (seen.has(variant.key)) {
      problems.push({ field: `${at}.key`, message: `Two variants share the key "${variant.key}".` });
    }
    seen.add(variant.key);

    if (!variant.name || !variant.name.trim()) {
      problems.push({ field: `${at}.name`, message: "A variant needs a name." });
    }

    if (!Number.isInteger(variant.allocation)) {
      problems.push({
        field: `${at}.allocation`,
        // Fractional allocation would make the bucket arithmetic depend on
        // floating point, and two runtimes could then disagree about which arm
        // a visitor is in.
        message: "Allocation must be a whole percentage.",
      });
    } else if (variant.allocation < 0) {
      problems.push({ field: `${at}.allocation`, message: "Allocation cannot be negative." });
    } else if (variant.allocation > 100) {
      problems.push({ field: `${at}.allocation`, message: "Allocation cannot exceed 100." });
    } else {
      total += variant.allocation;
    }

    if (variant.isControl) controls += 1;

    problems.push(...validateText(variant.text ?? null, `${at}.text`));
  }

  if (total !== 100) {
    problems.push({
      field: "variants",
      message: `Allocations must sum to exactly 100. These sum to ${total}.`,
    });
  }

  if (controls !== 1) {
    problems.push({
      field: "variants",
      message:
        controls === 0
          ? "Exactly one variant must be the control, or there is nothing to compare against."
          : "Only one variant can be the control.",
    });
  }

  return problems;
}

/** Copy overrides, checked field by field. */
export function validateText(text: ExperimentText | null, at = "text"): ValidationProblem[] {
  if (!text) return [];
  const problems: ValidationProblem[] = [];

  for (const key of Object.keys(text)) {
    if (!(EXPERIMENT_TEXT_FIELDS as readonly string[]).includes(key)) {
      problems.push({
        field: `${at}.${key}`,
        // Rejected rather than dropped. Silently ignoring an override would
        // leave an operator believing an experiment is running a difference it
        // is not, and reading a null result as evidence.
        message: `"${key}" is not something a variant can change. A variant may only vary display copy: ${EXPERIMENT_TEXT_FIELDS.join(", ")}.`,
      });
    }
  }

  for (const field of EXPERIMENT_TEXT_FIELDS) {
    const value = text[field];
    if (value === undefined || value === null) continue;

    if (typeof value !== "string") {
      problems.push({ field: `${at}.${field}`, message: "Copy must be text." });
      continue;
    }
    if (value.length > 400) {
      problems.push({ field: `${at}.${field}`, message: "Copy is limited to 400 characters." });
    }

    if (MUST_REMAIN_LEGIBLE.includes(field) && value.trim().length === 0) {
      problems.push({
        field: `${at}.${field}`,
        message:
          field === "reject_all"
            ? "The reject control cannot be blanked. An experiment may reword refusal; it may not remove it."
            : "The preference control cannot be blanked. Withdrawing and adjusting a choice has to stay reachable.",
      });
    }
  }

  return problems;
}

// ─── Assignment ──────────────────────────────────────────────────────────────

/**
 * FNV-1a, 32-bit.
 *
 * Deliberately not `node:crypto`: this module is imported by the browser SDK,
 * and the bundle guard rejects a Node built-in reaching it. A hash used to pick
 * a bucket needs to be uniform and identical everywhere, not unforgeable — there
 * is nothing here worth forging, since the visitor already controls their own
 * key.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface AssignableVariant {
  key: string;
  allocation: number;
}

/**
 * Pick an arm, deterministically.
 *
 * The same experiment and the same browser key always produce the same arm, on
 * any device and in any runtime, for as long as the allocation is unchanged. A
 * visitor who reloads, navigates, or comes back tomorrow sees what they saw.
 *
 * Variants are sorted by key before bucketing, so the order they happen to
 * arrive in from the database cannot reassign everybody.
 *
 * Returns null when nothing can be assigned — no variants, or allocations that
 * do not sum to 100. Null means "show the site's ordinary banner", which is the
 * only safe reading of a broken experiment.
 */
export function assignVariant(
  experimentId: string,
  browserKey: string,
  variants: readonly AssignableVariant[],
): string | null {
  if (variants.length === 0 || !browserKey) return null;

  const ordered = [...variants].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const total = ordered.reduce((sum, v) => sum + v.allocation, 0);
  if (total !== 100) return null;

  const bucket = hash(`${experimentId}:${browserKey}`) % 100;

  let cursor = 0;
  for (const variant of ordered) {
    cursor += variant.allocation;
    if (bucket < cursor) return variant.key;
  }

  // Unreachable while the allocations sum to 100, and a real answer rather than
  // a throw if that ever stops being true.
  return ordered[ordered.length - 1]?.key ?? null;
}

// ─── Wire shapes ─────────────────────────────────────────────────────────────

export interface ExperimentVariantSummary {
  variant_id: string;
  key: string;
  name: string;
  description: string | null;
  allocation: number;
  text: ExperimentText | null;
  is_control: boolean;
}

export interface ExperimentSummary {
  experiment_id: string;
  site_id: string;
  name: string;
  description: string | null;
  status: ExperimentStatus;
  starts_at: string | null;
  ends_at: string | null;
  policy_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variants: ExperimentVariantSummary[];
  /** Whether it is assigning arms right now, status and window together. */
  serving: boolean;
}

/** What a browser is told. Copy and allocation only — no dates, no status, no ids beyond the two it needs. */
export interface ExperimentRuntimeConfig {
  experiment_id: string;
  variants: Array<{ key: string; allocation: number; text: ExperimentText | null }>;
}
