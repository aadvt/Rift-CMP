#!/usr/bin/env node
/**
 * Normalises the requirement matrix against the controlled vocabulary.
 *
 * What this does and, more importantly, what it refuses to do.
 *
 * It **adds** canonical fields beside the regime-specific ones. It never
 * rewrites a regime's own term. `digital_personal_data` stays exactly that on a
 * DPDP record, and gains `data_categories_canonical: ["personal_data"]` next to
 * it. Overwriting would assert an equivalence between regimes that no source
 * states, which the methodology forbids.
 *
 * It also fills two fields the schema declared but nothing populated -
 * `requirement_type` and `authority_level` - by inference from the record's own
 * topic and cited sources. Both inferences are mechanical and recorded, not
 * legal judgements: `authority_level` reads the source register's `source_type`,
 * and `requirement_type` reads the canonical topic. Where neither yields an
 * answer the field is left null and the gap is reported rather than guessed.
 *
 * Run:  node docs/regulations/tools/normalise.mjs [--write]
 * Without --write it reports what it would change and exits 0.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const MATRIX = path.join(root, "matrix", "requirements.json");
const VOCAB = path.join(root, "schemas", "vocabulary.json");
const SOURCES = path.join(root, "sources", "sources.json");

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const matrix = read(MATRIX);
const vocab = read(VOCAB);
const sourcesFile = read(SOURCES);
const sources = Array.isArray(sourcesFile) ? sourcesFile : (sourcesFile.sources ?? []);

const write = process.argv.includes("--write");

/** alias -> canonical, built from the vocabulary so the mapping lives in one place. */
function aliasIndex(group) {
  const index = new Map();
  for (const [canonical, entry] of Object.entries(group.canonical ?? {})) {
    index.set(canonical, canonical);
    for (const alias of entry.aliases ?? []) index.set(alias, canonical);
  }
  return index;
}

const topicIndex = aliasIndex(vocab.topics);
const basisIndex = aliasIndex(vocab.legal_bases);

/** Regime data-category terms carry an explicit `maps_to`. */
const dataCategoryIndex = new Map();
for (const [term, entry] of Object.entries(vocab.data_categories.regime_terms ?? {})) {
  dataCategoryIndex.set(term, entry.maps_to);
}
for (const canonical of Object.keys(vocab.data_categories.canonical ?? {})) {
  if (!dataCategoryIndex.has(canonical)) dataCategoryIndex.set(canonical, canonical);
}

const actorIndex = new Map();
for (const [canonical, entry] of Object.entries(vocab.covered_actors.canonical ?? {})) {
  for (const term of entry.regime_terms ?? []) actorIndex.set(term, canonical);
}

const sourceTypeById = new Map(sources.map((s) => [s.source_id, s.source_type]));

/**
 * Maps a canonical topic to the kind of obligation it expresses.
 *
 * This is a property of the topic, not of any particular legal system, which is
 * why it can be derived rather than authored per record.
 */
const TYPE_BY_TOPIC = {
  applicability: "scope",
  effective_dates: "timing",
  enforcement: "enforcement",
  rights: "right",
  lawful_basis: "condition",
  sensitive_data: "condition",
  children: "condition",
  consent: "obligation",
  withdrawal: "obligation",
  notice: "obligation",
  retention: "obligation",
  international_transfer: "obligation",
  tracking_and_storage: "obligation",
  direct_marketing: "obligation",
  sale_and_sharing: "obligation",
  opt_out_signals: "obligation",
  non_discrimination: "prohibition",
  automated_decision_making: "obligation",
  security: "obligation",
  vendor_relationship: "obligation",
  accountability: "obligation",
};

/**
 * Source types, most authoritative first. A requirement resting on several
 * sources takes the strongest, because that is the one that makes it binding.
 */
const AUTHORITY_BY_SOURCE_TYPE = {
  // Values below are the ones the source register actually uses. `primary` is
  // the statute itself; `primary_regulatory` covers rules and regulations made
  // under one, which bind but sit a level down.
  primary: "statute",
  primary_regulatory: "delegated",
  official_guidance: "regulator_guidance",
  official_information: "regulator_guidance",
  independent_authoritative: "regulator_guidance",
  // A model assembled during research is not an authority. Requirements resting
  // only on one are marked `derived` so nothing downstream mistakes the generic
  // US state model for law.
  derived_model: "derived",
};
const AUTHORITY_RANK = { statute: 4, delegated: 3, regulator_guidance: 2, derived: 1 };

function inferAuthority(sourceIds) {
  let best = null;
  for (const id of sourceIds ?? []) {
    const level = AUTHORITY_BY_SOURCE_TYPE[sourceTypeById.get(id)];
    if (!level) continue;
    if (!best || AUTHORITY_RANK[level] > AUTHORITY_RANK[best]) best = level;
  }
  return best;
}

/**
 * A regime's region is a restatement of its own identity, not a legal
 * inference: the GDPR is EU law, the DPDP Act is Indian law. 23 records were
 * missing it entirely, which silently broke region-scoped lookup - the query
 * simply returned nothing rather than failing.
 */
const REGION_BY_REGIME = {
  GDPR: ["EU"],
  "EU-ePrivacy": ["EU"],
  "India-DPDP-Act": ["India"],
  "India-DPDP-Rules": ["India"],
  "California-CCPA-CPRA": ["California"],
  "Brazil-LGPD": ["Brazil"],
  "US-State-Model": ["US"],
};

const mapAll = (values, index) => {
  const out = [];
  for (const v of values ?? []) {
    const mapped = index.get(v);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
};

const changes = [];
const unmapped = { topic: new Set(), legal_bases: new Set(), data_categories: new Set(), actors: new Set() };

for (const req of matrix.requirements) {
  const before = JSON.stringify(req);

  const canonicalTopic = topicIndex.get(req.topic);
  if (canonicalTopic) req.topic_canonical = canonicalTopic;
  else unmapped.topic.add(req.topic);

  const bases = mapAll(req.legal_bases, basisIndex);
  for (const b of req.legal_bases ?? []) if (!basisIndex.has(b)) unmapped.legal_bases.add(b);
  if (bases.length) req.legal_bases_canonical = bases;

  const cats = mapAll(req.data_categories, dataCategoryIndex);
  for (const c of req.data_categories ?? []) if (!dataCategoryIndex.has(c)) unmapped.data_categories.add(c);
  if (cats.length) req.data_categories_canonical = cats;

  const actors = mapAll(req.applicability?.covered_actors, actorIndex);
  for (const a of req.applicability?.covered_actors ?? []) if (!actorIndex.has(a)) unmapped.actors.add(a);
  if (actors.length && req.applicability) req.applicability.covered_actors_canonical = actors;

  if (!req.requirement_type && canonicalTopic && TYPE_BY_TOPIC[canonicalTopic]) {
    req.requirement_type = TYPE_BY_TOPIC[canonicalTopic];
  }

  if (!req.authority_level) {
    const inferred = inferAuthority(req.source_ids);
    if (inferred) req.authority_level = inferred;
  }

  if (!req.regions || req.regions.length === 0) {
    const region = REGION_BY_REGIME[req.regime];
    if (region) req.regions = [...region];
  }

  if (JSON.stringify(req) !== before) changes.push(req.requirement_id);
}

// Key order is stabilised so a re-run produces no spurious diff.
const KEY_ORDER = [
  "requirement_id", "regime", "topic", "topic_canonical", "requirement",
  "requirement_type", "authority_level", "applicability",
  "legal_bases", "legal_bases_canonical", "purposes",
  "data_categories", "data_categories_canonical", "contexts", "regions",
  "consent", "opt_out", "children", "exceptions",
  "effective_from", "effective_to", "policy_version", "source_ids", "notes",
];

matrix.requirements = matrix.requirements.map((req) => {
  const ordered = {};
  for (const key of KEY_ORDER) if (key in req) ordered[key] = req[key];
  for (const key of Object.keys(req)) if (!(key in ordered)) ordered[key] = req[key];
  return ordered;
});

matrix.vocabulary_version = vocab.schema_version;
matrix.normalised_at = new Date().toISOString().slice(0, 10);

console.log(`records:            ${matrix.requirements.length}`);
console.log(`records changed:    ${changes.length}`);
for (const [field, set] of Object.entries(unmapped)) {
  const list = [...set];
  console.log(`unmapped ${field.padEnd(16)} ${list.length}${list.length ? ": " + list.join(", ") : ""}`);
}

const regioned = matrix.requirements.filter((r) => (r.regions ?? []).length).length;
console.log(`regions:            ${regioned}/${matrix.requirements.length}`);
const typed = matrix.requirements.filter((r) => r.requirement_type).length;
const authed = matrix.requirements.filter((r) => r.authority_level).length;
console.log(`requirement_type:   ${typed}/${matrix.requirements.length}`);
console.log(`authority_level:    ${authed}/${matrix.requirements.length}`);

if (write) {
  fs.writeFileSync(MATRIX, JSON.stringify(matrix, null, 2) + "\n", "utf8");
  console.log(`\nwrote ${path.relative(process.cwd(), MATRIX)}`);
} else {
  console.log("\ndry run - pass --write to apply");
}

const totalUnmapped = Object.values(unmapped).reduce((n, s) => n + s.size, 0);
process.exit(totalUnmapped > 0 ? 1 : 0);
