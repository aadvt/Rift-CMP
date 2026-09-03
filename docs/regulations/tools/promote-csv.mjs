#!/usr/bin/env node
/**
 * Promotes requirement rows that exist only in requirements.csv into
 * requirements.json.
 *
 * The two matrix representations had diverged: the CSV carried 81 rows, the JSON
 * 58, and the 23 that existed only in the CSV were invisible to anything reading
 * the structured file. Every source id in the CSV was also dangling, because it
 * used a scheme the register had since replaced. Both were silent - nothing read
 * the CSV programmatically, so nothing noticed.
 *
 * This script converts those rows using only what the CSV states. It does not
 * infer legal content. Where a CSV column has no counterpart in the structured
 * schema, the text is preserved verbatim in `notes` rather than being
 * interpreted, so a reviewer can always see what the row actually said.
 *
 * It refuses to promote a row whose source id cannot be resolved through the
 * alias map, because a requirement with an unresolvable citation is worse than a
 * missing one: it looks checkable and is not.
 *
 * Run:  node docs/regulations/tools/promote-csv.mjs [--write]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const MATRIX = path.join(root, "matrix", "requirements.json");
const CSV = path.join(root, "matrix", "requirements.csv");
const ALIASES = path.join(root, "sources", "source-id-aliases.json");
const VOCAB = path.join(root, "schemas", "vocabulary.json");

const matrix = read(MATRIX);
const aliases = read(ALIASES);
const vocab = read(VOCAB);
const write = process.argv.includes("--write");

/** Minimal RFC 4180 reader: the file has quoted fields containing commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(fs.readFileSync(CSV, "utf8").trim());
const header = rows[0].map((h) => h.trim());
const records = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));

const existing = new Set(matrix.requirements.map((r) => r.requirement_id));
const missing = records.filter((r) => r.requirement_id && !existing.has(r.requirement_id));

/** CSV `category` is title-cased prose; map it onto the canonical topic set. */
const CATEGORY_TO_TOPIC = {
  applicability: "applicability",
  "lawful basis": "lawful_basis",
  consent: "consent",
  withdrawal: "withdrawal",
  notice: "notice",
  transparency: "notice",
  rights: "rights",
  "consumer rights": "rights",
  "sensitive data": "sensitive_data",
  children: "children",
  minors: "children",
  retention: "retention",
  "international transfer": "international_transfer",
  cookies: "tracking_and_storage",
  "terminal equipment": "tracking_and_storage",
  "direct marketing": "direct_marketing",
  sale: "sale_and_sharing",
  "opt-out": "sale_and_sharing",
  "universal opt-out": "opt_out_signals",
  "non-discrimination": "non_discrimination",
  admt: "automated_decision_making",
  security: "security",
  breach: "security",
  processor: "vendor_relationship",
  vendor: "vendor_relationship",
  governance: "accountability",
  dpia: "accountability",
  sdf: "accountability",
  enforcement: "enforcement",
  "effective dates": "effective_dates",
};

const DATA_BY_REGIME = {
  GDPR: "personal_data",
  "EU-ePrivacy": "personal_data",
  "India-DPDP-Act": "digital_personal_data",
  "India-DPDP-Rules": "digital_personal_data",
  "California-CCPA-CPRA": "personal_information",
  "Brazil-LGPD": "personal_data",
  "US-State-Model": "personal_information",
};

const ACTOR_TOKENS = {
  controller: "controller",
  processor: "processor",
  business: "business",
  "service provider": "service_provider",
  contractor: "contractor",
  "data fiduciary": "data_fiduciary",
  "data processor": "data_processor",
  "third party": "third_party",
  "consent manager": "consent_manager",
};

const dataTermsByRegime = vocab.data_categories.regime_terms ?? {};

function toTopic(category) {
  const key = category.toLowerCase().trim();
  return CATEGORY_TO_TOPIC[key] ?? null;
}

function toActors(actorCell, regime) {
  const lower = actorCell.toLowerCase();
  const found = [];
  for (const [token, canonical] of Object.entries(ACTOR_TOKENS)) {
    if (lower.includes(token) && !found.includes(canonical)) found.push(canonical);
  }
  if (found.length) return found;
  // "All regulated actors" and similar: fall back to the regime's primary actor
  // rather than inventing a role the row never named.
  return regime.startsWith("India") ? ["data_fiduciary"] : regime === "California-CCPA-CPRA" ? ["business"] : ["controller"];
}

function toDataCategories(cell, regime) {
  const lower = cell.toLowerCase();
  const out = [];
  if (lower.includes("sensitive") || lower.includes("special")) {
    const sensitive = Object.keys(dataTermsByRegime).find(
      (t) => dataTermsByRegime[t].maps_to === "sensitive_data" && (dataTermsByRegime[t].regimes ?? []).includes(regime),
    );
    if (sensitive) out.push(sensitive);
  }
  if (lower.includes("child") || lower.includes("minor")) {
    const child = Object.keys(dataTermsByRegime).find(
      (t) => dataTermsByRegime[t].maps_to === "child_data" && (dataTermsByRegime[t].regimes ?? []).includes(regime),
    );
    if (child) out.push(child);
  }
  if (out.length === 0) out.push(DATA_BY_REGIME[regime] ?? "personal_data");
  return out;
}

/**
 * `consent_required` is Yes / No / Conditional / N/A.
 *
 * "Conditional" is preserved as `required: "conditional"` rather than being
 * forced to a boolean, because the whole point of the matrix is that a legal
 * requirement is not a boolean.
 */
function toConsent(cell) {
  const v = cell.toLowerCase().trim();
  if (v === "yes") return { required: true };
  if (v === "no") return { required: false };
  if (v === "conditional") return { required: "conditional" };
  return null; // N/A or blank: the row makes no claim, so neither do we.
}

const resolveSource = (id) => aliases.aliases?.[id]?.resolves_to ?? null;

const promoted = [];
const refused = [];

for (const row of missing) {
  const topic = toTopic(row.category);
  const sourceId = resolveSource(row.source_id);

  if (!sourceId) {
    refused.push(`${row.requirement_id}: source '${row.source_id}' has no entry in source-id-aliases.json`);
    continue;
  }
  if (!topic) {
    refused.push(`${row.requirement_id}: category '${row.category}' has no canonical topic`);
    continue;
  }

  const notes = [];
  if (row.source_provision) notes.push(`Provision: ${row.source_provision}`);
  if (row.legal_basis_or_permission && row.legal_basis_or_permission !== "N/A") {
    notes.push(`Basis/permission as stated in CSV: ${row.legal_basis_or_permission}`);
  }
  if (row.consumer_right_or_control && row.consumer_right_or_control !== "N/A") {
    notes.push(`Right/control as stated in CSV: ${row.consumer_right_or_control}`);
  }
  if (row.status) notes.push(`Research status: ${row.status}`);
  notes.push("Promoted from requirements.csv; structured fields derived only from that row.");

  const record = {
    requirement_id: row.requirement_id,
    regime: row.regime,
    topic,
    requirement: row.requirement,
    applicability: {
      applies: true,
      triggers: row.applicability ? [row.applicability] : [],
      covered_actors: toActors(row.actor, row.regime),
    },
    legal_bases: [],
    purposes: [],
    data_categories: toDataCategories(row.covered_data, row.regime),
    contexts: [],
    regions: [],
    exceptions:
      row.exception_or_condition && row.exception_or_condition !== "N/A" ? [row.exception_or_condition] : [],
    effective_from: /^\d{4}-\d{2}-\d{2}$/.test(row.effective_date) ? row.effective_date : null,
    effective_to: null,
    policy_version: null,
    source_ids: [sourceId],
    notes: notes.join(" | "),
  };

  const consent = toConsent(row.consent_required);
  if (consent) record.consent = consent;

  promoted.push(record);
}

// Regions come from the regime, which is the only thing the CSV determines.
const REGION_BY_REGIME = {
  GDPR: ["EU"],
  "EU-ePrivacy": ["EU"],
  "India-DPDP-Act": ["India"],
  "India-DPDP-Rules": ["India"],
  "California-CCPA-CPRA": ["California"],
  "Brazil-LGPD": ["Brazil"],
  "US-State-Model": ["US"],
};
// policy_version follows whatever the regime's existing records already use, so
// promoted rows join the same version series rather than starting a new one.
const versionByRegime = {};
for (const r of matrix.requirements) {
  if (r.policy_version && !versionByRegime[r.regime]) versionByRegime[r.regime] = r.policy_version;
}
for (const r of promoted) {
  r.regions = REGION_BY_REGIME[r.regime] ?? [];
  r.policy_version = versionByRegime[r.regime] ?? null;
}

console.log(`csv rows            ${records.length}`);
console.log(`already in json     ${records.length - missing.length}`);
console.log(`missing from json   ${missing.length}`);
console.log(`promoted            ${promoted.length}`);
console.log(`refused             ${refused.length}`);
for (const r of refused) console.log(`  x ${r}`);

if (promoted.length) {
  console.log("\npromoted ids:");
  for (const r of promoted) console.log(`  ${r.requirement_id.padEnd(24)} ${r.topic}`);
}

if (write && promoted.length) {
  matrix.requirements.push(...promoted);
  matrix.requirements.sort((a, b) => a.requirement_id.localeCompare(b.requirement_id));
  fs.writeFileSync(MATRIX, JSON.stringify(matrix, null, 2) + "\n", "utf8");
  console.log(`\nwrote ${path.relative(process.cwd(), MATRIX)} (${matrix.requirements.length} records)`);
  console.log("run normalise.mjs --write next to canonicalise the new rows");
} else if (!write) {
  console.log("\ndry run - pass --write to apply");
}

process.exit(refused.length ? 1 : 0);
