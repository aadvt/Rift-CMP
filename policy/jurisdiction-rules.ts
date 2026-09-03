/**
 * Which region codes map to which jurisdictions.
 *
 * This is **configuration, not law**, and it is versioned because the mapping
 * genuinely changes: the United Kingdom was in the `EU` set until it was not,
 * and a rule set that could not express "this was true until 2020" would
 * quietly answer historical questions wrongly. Every resolution stamps the
 * version it used.
 *
 * ## Why this is separate from `disposition.ts`
 *
 * `disposition.ts` says what a *topic* does and names no regime. This file names
 * regions and jurisdictions and says nothing about requirements. Keeping them
 * apart is what lets an operator add a country - or correct one - without going
 * near the evaluator, and lets the evaluator gain a regime without anyone
 * editing a country list.
 *
 * ## What it does not do
 *
 * It does not geolocate, and it holds no legal proposition. That `DE` maps to
 * the `EU` jurisdiction is a statement about geography and membership; whether
 * anything is *required* of a processing activity in the EU comes entirely from
 * the Phase 6B matrix, through the evaluator.
 *
 * Research artifact, not legal advice.
 */

import type { Jurisdiction } from "./model";

/**
 * A versioned mapping from region codes to jurisdictions.
 *
 * One region may map to several jurisdictions, and that is the normal case
 * rather than an edge case: a visitor in California is in `California` *and* in
 * the generic `US` state model, and both may have something to say.
 */
export interface JurisdictionRules {
  readonly version: string;
  /** Human-readable note on what this version changed and why. */
  readonly description: string;
  /** ISO 3166 region code (upper case) -> jurisdictions it belongs to. */
  readonly regions: Readonly<Record<string, readonly Jurisdiction[]>>;
  /**
   * Region codes recognised as valid but deliberately mapped to nothing.
   *
   * The difference between "we do not carry law for this place" and "we have
   * never heard of this place" is worth preserving: the first is an answer, the
   * second is a possible typo in a caller's region code.
   */
  readonly unmappedRegions: readonly string[];
}

/**
 * EU member states, as ISO 3166-1 alpha-2.
 *
 * The 27 members after the United Kingdom's withdrawal. Listed rather than
 * derived, because there is no authority to derive it from at runtime and a
 * wrong list is better caught by reading it than by trusting it.
 */
const EU_MEMBER_STATES: readonly string[] = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
];

/**
 * The three EEA states that are not EU members.
 *
 * Included because the matrix's own `EU` region is documented as "European
 * Union / EEA where applicable", and the GDPR is incorporated into the EEA
 * Agreement. Kept as a separate list so an operator who disagrees can drop them
 * in a new rule version without editing the member-state list.
 */
const EEA_NON_EU_STATES: readonly string[] = ["IS", "LI", "NO"];

function eu(): Record<string, readonly Jurisdiction[]> {
  const out: Record<string, readonly Jurisdiction[]> = {};
  for (const code of [...EU_MEMBER_STATES, ...EEA_NON_EU_STATES]) {
    out[code] = ["EU"];
  }
  return out;
}

/**
 * The default rule set.
 *
 * Deliberately small. It maps only what the Phase 6B matrix can actually answer
 * for, because a mapping that resolved `JP` to some jurisdiction the matrix has
 * no requirements for would produce a confident-looking resolution followed by
 * an empty evaluation - worse than saying up front that nothing is carried.
 */
export const DEFAULT_JURISDICTION_RULES: JurisdictionRules = Object.freeze({
  version: "2026-09-04",
  description:
    "EU-27 plus the three non-EU EEA states; India; Brazil; California as a US " +
    "subdivision, which also carries the generic US state model. Every other " +
    "region is recognised as unmapped rather than guessed at.",
  regions: Object.freeze({
    ...eu(),
    IN: ["India"],
    BR: ["Brazil"],
    // California is the only US state the matrix carries specifically. It also
    // gets `US`, the generic state model, because the CCPA is not the whole of
    // what a Californian visitor may be owed - and the model is held back by
    // the evaluator unless a caller asks for derived authority, so including it
    // here costs nothing and losing it would be a silent narrowing.
    "US-CA": ["California", "US"],
    // Any other US state resolves to the generic model alone. There is no
    // state-specific research behind it, and the evaluator says so.
    US: ["US"],
  }) as Readonly<Record<string, readonly Jurisdiction[]>>,
  /**
   * The United Kingdom is the case that justifies versioning this file at all.
   * It is recognised and mapped to nothing: UK GDPR is a separate instrument
   * the matrix does not carry, and mapping `GB` to `EU` would assert an
   * equivalence that stopped being true in 2020.
   */
  unmappedRegions: Object.freeze(["GB", "CH", "US-NY", "US-TX", "CA", "AU", "JP", "SG"]),
});

/** Region codes this rule set maps to at least one jurisdiction. */
export function mappedRegions(rules: JurisdictionRules): readonly string[] {
  return Object.keys(rules.regions).sort();
}

/**
 * Normalise a caller's region code.
 *
 * Accepts `de`, `DE`, `us-ca`, `US_CA`. Rejects anything that is not a plausible
 * ISO 3166 code - in particular anything that looks like an address, which is
 * the one input this package refuses to handle at all.
 */
export function normaliseRegion(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase().replace(/_/g, "-");
  if (!/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Does this look like an IP address rather than a region code?
 *
 * Used to fail loudly rather than silently ignore. A caller passing an address
 * here has misunderstood the boundary this package draws, and the worst outcome
 * would be for it to be quietly dropped and the resolution to come back
 * "unknown" - the caller would conclude geolocation had failed rather than that
 * it had handed over personal data the resolver refuses to accept.
 */
export function looksLikeIpAddress(raw: string): boolean {
  const value = raw.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true;
  // Any colon-separated hex run long enough to be an IPv6 address or prefix.
  if (/^[0-9a-fA-F:]{3,}$/.test(value) && value.includes(":")) return true;
  return false;
}

/** Jurisdictions a region maps to, or an empty list. */
export function jurisdictionsForRegion(
  region: string,
  rules: JurisdictionRules = DEFAULT_JURISDICTION_RULES,
): readonly Jurisdiction[] {
  return rules.regions[region] ?? [];
}
