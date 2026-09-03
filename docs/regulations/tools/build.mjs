#!/usr/bin/env node
/**
 * Generates the derived matrix artifacts from requirements.json.
 *
 * requirements.json is the single source of truth. The CSV and the TypeScript
 * module are generated from it and should never be hand-edited - that is
 * precisely how the two representations drifted apart before, with 23 rows
 * living only in the CSV and every one of its citations dangling. A generated
 * file cannot disagree with its source.
 *
 * Emits:
 *   matrix/requirements.csv        tabular view for review and spreadsheets
 *   generated/requirements.ts      typed data for a future engine to import
 *   generated/vocabulary.ts        the controlled vocabulary as union types
 *
 * The TypeScript output is **data and types only**. It contains no evaluation
 * logic, because deciding which requirements apply to a given situation is the
 * regulation engine's job and that is a later phase.
 *
 * Run:  node docs/regulations/tools/build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const matrix = read(path.join(root, "matrix", "requirements.json"));
const vocab = read(path.join(root, "schemas", "vocabulary.json"));
const reqs = matrix.requirements;

const generatedDir = path.join(root, "generated");
fs.mkdirSync(generatedDir, { recursive: true });

const BANNER = `// GENERATED FILE - DO NOT EDIT.
// Produced by docs/regulations/tools/build.mjs from matrix/requirements.json.
// Edit the JSON and re-run the build; edits here are overwritten.
//
// Research artifact, not legal advice. See docs/regulations/README.md.
`;

// ── requirements.csv ────────────────────────────────────────────────────────
const CSV_COLUMNS = [
  "requirement_id", "regime", "topic", "topic_canonical", "requirement_type",
  "authority_level", "requirement", "covered_actors", "data_categories",
  "data_categories_canonical", "legal_bases", "consent_required", "regions",
  "exceptions", "effective_from", "effective_to", "policy_version", "source_ids",
];

const cell = (value) => {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const consentCell = (req) => {
  if (!req.consent || req.consent.required === undefined) return "";
  const v = req.consent.required;
  return v === true ? "yes" : v === false ? "no" : String(v);
};

const csvLines = [CSV_COLUMNS.join(",")];
for (const r of [...reqs].sort((a, b) => a.requirement_id.localeCompare(b.requirement_id))) {
  csvLines.push([
    cell(r.requirement_id), cell(r.regime), cell(r.topic), cell(r.topic_canonical),
    cell(r.requirement_type), cell(r.authority_level), cell(r.requirement),
    cell(r.applicability?.covered_actors), cell(r.data_categories),
    cell(r.data_categories_canonical), cell(r.legal_bases), cell(consentCell(r)),
    cell(r.regions), cell(r.exceptions), cell(r.effective_from), cell(r.effective_to),
    cell(r.policy_version), cell(r.source_ids),
  ].join(","));
}
fs.writeFileSync(path.join(root, "matrix", "requirements.csv"), csvLines.join("\n") + "\n", "utf8");

// ── vocabulary.ts ───────────────────────────────────────────────────────────
const union = (values) =>
  values.length ? values.map((v) => `  | ${JSON.stringify(v)}`).join("\n") : "  | never";

const canonicalTopics = Object.keys(vocab.topics.canonical);
const canonicalBases = Object.keys(vocab.legal_bases.canonical);
const canonicalData = Object.keys(vocab.data_categories.canonical);
const regimeData = Object.keys(vocab.data_categories.regime_terms);
const requirementTypes = Object.keys(vocab.requirement_types.values);
const authorityLevels = Object.keys(vocab.authority_levels.values);
const regions = Object.keys(vocab.regions.values);
const regimes = [...new Set(reqs.map((r) => r.regime))].sort();

const vocabularyTs = `${BANNER}
/** Canonical subject of a requirement. */
export type Topic =
${union(canonicalTopics)};

/** Canonical grounds on which processing may lawfully occur. */
export type LegalBasis =
${union(canonicalBases)};

/** Canonical data concepts. Regime-specific terms map onto these. */
export type CanonicalDataCategory =
${union(canonicalData)};

/**
 * A regime's own term for a data category.
 *
 * Kept distinct from {@link CanonicalDataCategory} on purpose: \`personal_information\`
 * and \`digital_personal_data\` are not synonyms for \`personal_data\`, they are
 * different legal scopes that overlap. See \`data_categories.regime_terms\` in the
 * vocabulary for how each relates.
 */
export type RegimeDataCategory =
${union(regimeData)};

export type RequirementType =
${union(requirementTypes)};

/** How directly the cited source states the requirement. */
export type AuthorityLevel =
${union(authorityLevels)};

export type Region =
${union(regions)};

export type Regime =
${union(regimes)};

/** Regime term -> canonical concept, with the relationship between them. */
export const DATA_CATEGORY_MAP: Record<string, { canonical: string; relation: string }> = ${JSON.stringify(
  Object.fromEntries(
    Object.entries(vocab.data_categories.regime_terms).map(([term, e]) => [
      term,
      { canonical: e.maps_to, relation: e.relation },
    ]),
  ),
  null,
  2,
)};

/** Alias -> canonical topic, for reading historical records. */
export const TOPIC_ALIASES: Record<string, string> = ${JSON.stringify(
  Object.fromEntries(
    Object.entries(vocab.topics.canonical).flatMap(([canonical, e]) =>
      (e.aliases ?? []).map((a) => [a, canonical]),
    ),
  ),
  null,
  2,
)};
`;
fs.writeFileSync(path.join(generatedDir, "vocabulary.ts"), vocabularyTs, "utf8");

// ── requirements.ts ─────────────────────────────────────────────────────────
const requirementsTs = `${BANNER}
import type {
  AuthorityLevel,
  CanonicalDataCategory,
  LegalBasis,
  Regime,
  Region,
  RequirementType,
  Topic,
} from "./vocabulary";

/**
 * Whether consent is required.
 *
 * Deliberately not a boolean. \`"conditional"\` is a real and common answer - the
 * requirement depends on facts the matrix does not hold - and flattening it to
 * true or false would assert something no source says. A consumer that cannot
 * handle \`"conditional"\` should surface it for a human, not coerce it.
 */
export type ConsentRequirement = {
  required: boolean | "conditional";
  conditions?: string[];
  withdrawal_required?: boolean;
};

export interface Applicability {
  applies: boolean;
  triggers: string[];
  covered_actors: string[];
  covered_actors_canonical?: string[];
}

export interface Requirement {
  requirement_id: string;
  regime: Regime;
  /** The regime's own term. */
  topic: string;
  /** Canonical topic, for cross-regime queries. */
  topic_canonical?: Topic;
  requirement: string;
  requirement_type?: RequirementType;
  authority_level?: AuthorityLevel;
  applicability: Applicability;
  legal_bases: string[];
  legal_bases_canonical?: LegalBasis[];
  purposes: string[];
  /** Regime terms, preserved verbatim. */
  data_categories: string[];
  data_categories_canonical?: CanonicalDataCategory[];
  contexts: string[];
  regions: Region[];
  consent?: ConsentRequirement;
  opt_out?: Record<string, unknown>;
  children?: Record<string, unknown>;
  exceptions: string[];
  /** ISO date. Null where the source states no start date. */
  effective_from: string | null;
  /** ISO date, or null where the requirement is still in force. */
  effective_to: string | null;
  policy_version: string | null;
  source_ids: string[];
  notes?: string;
}

export interface RequirementMatrix {
  schema_version: string;
  vocabulary_version?: string;
  research_status: string;
  legal_advice: false;
  requirements: Requirement[];
}

export const REQUIREMENT_MATRIX = ${JSON.stringify(
  {
    schema_version: matrix.schema_version,
    vocabulary_version: matrix.vocabulary_version,
    research_status: matrix.research_status,
    legal_advice: false,
    requirements: reqs,
  },
  null,
  2,
)} as const satisfies RequirementMatrix;

export const REQUIREMENTS: readonly Requirement[] = REQUIREMENT_MATRIX.requirements;
`;
fs.writeFileSync(path.join(generatedDir, "requirements.ts"), requirementsTs, "utf8");

console.log(`requirements     ${reqs.length}`);
console.log(`wrote            matrix/requirements.csv`);
console.log(`wrote            generated/vocabulary.ts`);
console.log(`wrote            generated/requirements.ts`);
