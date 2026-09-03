/**
 * What we observed about where a visitor is, and how much it is worth.
 *
 * This file models *evidence*, not truth. The distinction it exists to protect
 * is the one the phase brief leads with:
 *
 *   IP location  !=  residence  !=  applicable law
 *
 * Three different claims, routinely collapsed into one. A country derived from
 * an address is a guess about a network connection at an instant. Residence is
 * a fact about a person. Applicable law is a legal conclusion that may involve
 * several jurisdictions at once and can attach for reasons that have nothing to
 * do with where the visitor is standing - a business that offers services into a
 * market is reached by that market's law regardless of any address.
 *
 * So nothing here is called `userLocation`, `country` or `residence`. A
 * {@link DetectedLocation} is a dated observation with a named source and an
 * explicit confidence, and `resolve.ts` turns a set of them into jurisdictions
 * without ever treating one as a statement about where someone lives.
 *
 * ## The resolver never sees an IP address
 *
 * There is deliberately no field on {@link VisitorContext} for one. The brief
 * says to keep legal determination separate from IP geolocation and not to
 * collect personal information merely to sharpen detection; taking a raw address
 * would breach both at once, and an IP address is personal data in every regime
 * the matrix carries. The caller performs geolocation with whatever it already
 * has and passes the *derived region code*. The engine cannot geolocate, in the
 * same way it cannot decrypt a transfer envelope: the capability is not in its
 * dependency graph.
 *
 * Research artifact, not legal advice.
 */

import type { Jurisdiction } from "./model";

/**
 * Where a location observation came from.
 *
 * Ordered by how much a legal reading can lean on it, which is not the same as
 * how precise it is. A declared country of residence is vaguer than a
 * city-level geolocation and worth far more, because it is a claim about the
 * person rather than about a packet.
 */
export type LocationSource =
  /** The visitor said so - a preference centre, a country selector. */
  | "user_declared"
  /** An account record the site already holds for an authenticated visitor. */
  | "authenticated_profile"
  /** Markets the business has decided to offer services into. */
  | "business_target_market"
  /** The service itself is confined to a region. */
  | "service_context"
  /** A region code an upstream provider derived from a network address. */
  | "ip_geolocation"
  /** Locale or timezone hints from the request. Weak, and easily wrong. */
  | "request_context";

/**
 * How much weight an observation carries.
 *
 * Explicit and never collapsed into a number. Confidence is reported alongside
 * every jurisdiction it contributed to, and it is deliberately **not** used to
 * silently drop one - see the note on conservatism in `resolve.ts`.
 */
export type Confidence = "high" | "medium" | "low";

/** Whether a source speaks about the person or merely about a connection. */
export const SOURCE_IS_RESIDENCE_CLAIM: Readonly<Record<LocationSource, boolean>> =
  {
    user_declared: true,
    authenticated_profile: true,
    // The three below say nothing about any individual - they are facts about
    // the business or the service, and are the reason a jurisdiction can apply
    // to a visitor whose whereabouts are entirely unknown.
    business_target_market: false,
    service_context: false,
    ip_geolocation: false,
    request_context: false,
  };

/** Default weight of each source, overridable per observation. */
export const DEFAULT_SOURCE_CONFIDENCE: Readonly<
  Record<LocationSource, Confidence>
> = {
  user_declared: "high",
  authenticated_profile: "high",
  // High because it is a decision the business made and can evidence, not a
  // guess about a visitor. It is the most reliable input the resolver gets.
  business_target_market: "high",
  service_context: "high",
  // Medium at best: proxies, VPNs, corporate egress and mobile carrier routing
  // all detach the address from the person, and none of them is exotic.
  ip_geolocation: "medium",
  // Locale says something about a language preference and almost nothing about
  // a location. A German speaker in Chicago is not a German data subject.
  request_context: "low",
};

/**
 * One dated observation about where a visitor might be, or which market the
 * business is in.
 *
 * `region` is an ISO 3166 code - `"DE"`, `"IN"`, `"BR"` - or a subdivision code
 * where the regime is sub-national, as California requires: `"US-CA"`. It is
 * matched against the configured mapping in `jurisdiction-rules.ts` and never
 * interpreted directly.
 */
export interface DetectedLocation {
  readonly region: string;
  readonly source: LocationSource;
  /** Defaults to {@link DEFAULT_SOURCE_CONFIDENCE} for the source. */
  readonly confidence?: Confidence;
  /**
   * When this was observed. An observation is a point in time and is not
   * evidence about any other point in time.
   */
  readonly observedAt?: Date;
  /** Free-text provenance, echoed into the reasoning. Never matched. */
  readonly note?: string;
}

/**
 * Everything the resolver is allowed to know about a visitor.
 *
 * Note what is absent: no IP address, no user agent, no identifier of any kind,
 * and no field that would tempt a caller to collect something new. Every input
 * is either an observation the site already had or a fact about the business.
 */
export interface VisitorContext {
  /** Observations, in any order. An empty list is a valid, answerable input. */
  readonly signals: readonly DetectedLocation[];
  /**
   * Jurisdictions the operator has decided apply regardless of any signal.
   *
   * The override of last resort, for an operator who has taken advice. Recorded
   * on the resolution as an explicit override so it never looks like a finding.
   */
  readonly assertedJurisdictions?: readonly Jurisdiction[];
}

/** A location observation with its defaults filled in. */
export interface ResolvedSignal {
  readonly region: string;
  readonly source: LocationSource;
  readonly confidence: Confidence;
  readonly isResidenceClaim: boolean;
  readonly observedAt: Date | null;
  readonly note: string | null;
  /** Jurisdictions this observation mapped to. Empty where unmapped. */
  readonly jurisdictions: readonly Jurisdiction[];
}

export const CONFIDENCE_ORDER: readonly Confidence[] = ["high", "medium", "low"];

/** The weaker of two confidences. */
export function weakest(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(a) >= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}

/** The stronger of two confidences. */
export function strongest(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}
