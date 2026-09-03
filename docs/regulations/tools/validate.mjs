#!/usr/bin/env node
/**
 * Validates the regulation research artifacts.
 *
 * This exists because the matrix is about to become an input to an engine, and
 * the failure mode of a legal dataset is silent: a dangling source id or a
 * typo'd topic does not crash anything, it just quietly stops matching, and the
 * engine returns "no requirement applies" — which reads exactly like a clean
 * bill of health. Every check below is chosen because its failure would be
 * invisible at runtime.
 *
 * It validates structure and internal consistency. It cannot and does not
 * validate that the law is stated correctly; that needs a human with the
 * sources open.
 *
 * Run:  node docs/regulations/tools/validate.mjs
 * Exits non-zero on any error, so it can gate a build.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const matrix = read(path.join(root, "matrix", "requirements.json"));
const vocab = read(path.join(root, "schemas", "vocabulary.json"));
const schema = read(path.join(root, "schemas", "requirement.schema.json"));
const sourcesFile = read(path.join(root, "sources", "sources.json"));
const sources = Array.isArray(sourcesFile) ? sourcesFile : (sourcesFile.sources ?? []);
const reqs = matrix.requirements ?? [];

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── 1. Required fields ──────────────────────────────────────────────────────
for (const req of reqs) {
  for (const field of schema.required ?? []) {
    if (!(field in req)) fail(`${req.requirement_id}: missing required field '${field}'`);
  }
}

// ── 2. Identifier uniqueness and shape ──────────────────────────────────────
const seen = new Set();
for (const req of reqs) {
  const id = req.requirement_id;
  if (seen.has(id)) fail(`duplicate requirement_id '${id}'`);
  seen.add(id);
  if (!/^REQ-[A-Z0-9-]+$/.test(id ?? "")) fail(`malformed requirement_id '${id}'`);
}

// ── 3. Controlled vocabulary ────────────────────────────────────────────────
const known = (group) => {
  const set = new Set();
  for (const [canonical, entry] of Object.entries(group.canonical ?? {})) {
    set.add(canonical);
    for (const a of entry.aliases ?? []) set.add(a);
  }
  return set;
};

const topics = known(vocab.topics);
const bases = known(vocab.legal_bases);
const canonicalTopics = new Set(Object.keys(vocab.topics.canonical ?? {}));
const dataTerms = new Set([
  ...Object.keys(vocab.data_categories.canonical ?? {}),
  ...Object.keys(vocab.data_categories.regime_terms ?? {}),
]);
const actors = new Set(
  Object.values(vocab.covered_actors.canonical ?? {}).flatMap((e) => e.regime_terms ?? []),
);
const regions = new Set(Object.keys(vocab.regions.values ?? {}));
const reqTypes = new Set(Object.keys(vocab.requirement_types.values ?? {}));
const authLevels = new Set(Object.keys(vocab.authority_levels.values ?? {}));

for (const req of reqs) {
  const id = req.requirement_id;
  if (req.topic && !topics.has(req.topic)) fail(`${id}: topic '${req.topic}' not in vocabulary`);
  if (req.topic_canonical && !canonicalTopics.has(req.topic_canonical)) {
    fail(`${id}: topic_canonical '${req.topic_canonical}' is not a canonical topic`);
  }
  if (!req.topic_canonical) warn(`${id}: no topic_canonical - run normalise.mjs --write`);

  for (const b of req.legal_bases ?? []) {
    if (!bases.has(b)) fail(`${id}: legal_basis '${b}' not in vocabulary`);
  }
  for (const c of req.data_categories ?? []) {
    if (!dataTerms.has(c)) fail(`${id}: data_category '${c}' not in vocabulary`);
  }
  for (const a of req.applicability?.covered_actors ?? []) {
    if (!actors.has(a)) fail(`${id}: covered_actor '${a}' not in vocabulary`);
  }
  for (const r of req.regions ?? []) {
    if (!regions.has(r)) fail(`${id}: region '${r}' not in vocabulary`);
  }
  if (req.requirement_type && !reqTypes.has(req.requirement_type)) {
    fail(`${id}: requirement_type '${req.requirement_type}' not in vocabulary`);
  }
  if (req.authority_level && !authLevels.has(req.authority_level)) {
    fail(`${id}: authority_level '${req.authority_level}' not in vocabulary`);
  }
}

// ── 4. Referential integrity ────────────────────────────────────────────────
const sourceIds = new Set(sources.map((s) => s.source_id));
for (const req of reqs) {
  const ids = req.source_ids ?? [];
  // An unsourced legal requirement is the single most dangerous record here:
  // it looks authoritative and cannot be checked.
  if (ids.length === 0) fail(`${req.requirement_id}: has no source_ids`);
  for (const sid of ids) {
    if (!sourceIds.has(sid)) fail(`${req.requirement_id}: source_id '${sid}' is not registered`);
  }
}

const cited = new Set(reqs.flatMap((r) => r.source_ids ?? []));
for (const s of sources) {
  if (!cited.has(s.source_id)) {
    warn(`source '${s.source_id}' (${s.regime}) is registered but no requirement cites it`);
  }
}

// ── 5. Dates ────────────────────────────────────────────────────────────────
for (const req of reqs) {
  const id = req.requirement_id;
  const { effective_from: from, effective_to: to } = req;
  if (from !== null && from !== undefined && !ISO_DATE.test(from)) {
    fail(`${id}: effective_from '${from}' is not YYYY-MM-DD`);
  }
  if (to !== null && to !== undefined && !ISO_DATE.test(to)) {
    fail(`${id}: effective_to '${to}' is not YYYY-MM-DD`);
  }
  if (from && to && from > to) fail(`${id}: effective_from is after effective_to`);
}

for (const s of sources) {
  for (const field of ["publication_date", "effective_date", "retrieved_date", "application_date"]) {
    const v = s[field];
    if (v && !ISO_DATE.test(v)) fail(`source ${s.source_id}: ${field} '${v}' is not YYYY-MM-DD`);
  }
  if (!s.url) warn(`source ${s.source_id}: no url recorded`);
  if (!s.retrieved_date) warn(`source ${s.source_id}: no retrieved_date - staleness cannot be judged`);
}

// ── 6. Every regime in the matrix is a declared regime ───────────────────────
const declaredRegimes = new Set(sources.map((s) => s.regime));
for (const regime of new Set(reqs.map((r) => r.regime))) {
  if (!declaredRegimes.has(regime)) {
    warn(`regime '${regime}' appears in the matrix but has no source registered under it`);
  }
}

// ── 7. CSV agrees with JSON ──────────────────────────────────────────────────
const csvPath = path.join(root, "matrix", "requirements.csv");
if (fs.existsSync(csvPath)) {
  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const csvIds = new Set(lines.slice(1).map((l) => l.split(",")[0]?.replace(/^"|"$/g, "").trim()));
  for (const req of reqs) {
    if (!csvIds.has(req.requirement_id)) {
      warn(`${req.requirement_id} is in requirements.json but not requirements.csv`);
    }
  }
  for (const id of csvIds) {
    if (id && !seen.has(id)) warn(`${id} is in requirements.csv but not requirements.json`);
  }
}

// ── 8. The schema still describes the data ──────────────────────────────────
// Added in Phase 6C. The schema had gone stale without anything noticing: it
// declared `additionalProperties: false` while normalise.mjs was adding four
// canonical fields, and carried its own enums for requirement_type and
// authority_level that had drifted away from the vocabulary. Nothing read it,
// so all 81 records were silently invalid against their own schema. These
// checks make the schema load-bearing rather than decorative.
const declared = new Set(Object.keys(schema.properties ?? {}));
const declaredApplicability = new Set(Object.keys(schema.properties?.applicability?.properties ?? {}));
for (const req of reqs) {
  for (const key of Object.keys(req)) {
    if (!declared.has(key)) fail(`${req.requirement_id}: field '${key}' is not declared in requirement.schema.json`);
  }
  for (const key of Object.keys(req.applicability ?? {})) {
    if (!declaredApplicability.has(key)) {
      fail(`${req.requirement_id}: applicability.${key} is not declared in requirement.schema.json`);
    }
  }
}
// The vocabulary is the single authority for enumerated values. If the schema
// re-declares them, the two can disagree, which is how they drifted before.
for (const field of ["requirement_type", "authority_level"]) {
  if (schema.properties?.[field]?.enum) {
    fail(`requirement.schema.json re-declares an enum for '${field}'; vocabulary.json is the authority`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const byRegime = {};
for (const r of reqs) byRegime[r.regime] = (byRegime[r.regime] ?? 0) + 1;

console.log("Regulation matrix validation\n");
console.log(`  requirements     ${reqs.length}`);
console.log(`  sources          ${sources.length}`);
console.log(`  regimes          ${Object.keys(byRegime).length}`);
console.log(`  vocabulary       v${vocab.schema_version}`);
console.log(`  research_status  ${matrix.research_status}\n`);

for (const [regime, n] of Object.entries(byRegime).sort((a, b) => b[1] - a[1])) {
  const topicsCovered = new Set(reqs.filter((r) => r.regime === regime).map((r) => r.topic_canonical));
  console.log(`  ${regime.padEnd(24)} ${String(n).padStart(3)} reqs  ${topicsCovered.size} topics`);
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log("\nFAILED");
  process.exit(1);
}

console.log("\nOK - structure and internal consistency only; legal accuracy is not machine-checkable.");
