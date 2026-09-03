/**
 * Tenancy contract shared by the API, the database package and any consumer.
 *
 * The ownership model is two levels deep:
 *
 *   Organisation (tenant)
 *     └── Website (site)
 *           ├── Session
 *           └── Event
 *
 * An organisation is the isolation boundary. Nothing below a website is ever
 * reachable from a credential belonging to a different organisation.
 */

/** Public client identifier, embedded in browser code. Not a secret. */
export const PUBLIC_KEY_PREFIX = "pk_";

/** Server-side organisation secret. Never leaves a trusted environment. */
export const SECRET_KEY_PREFIX = "sk_";

/**
 * Delivery credential for a target fiduciary collecting sealed envelopes.
 *
 * A third plane, separate from both of the above: it authorises collecting
 * ciphertext addressed to one recipient and nothing else. It confers no ability
 * to decrypt - that requires the recipient's X25519 private key, which Rift
 * never sees.
 */
export const DELIVERY_KEY_PREFIX = "rk_";

/**
 * Opaque dashboard session token, held in the operator's cookie.
 *
 * Not a fourth credential plane: it never authenticates an API request. It
 * resolves, server-side, to the organisation secret that does. See
 * `database/dashboard-sessions.ts` and docs/security.md.
 */
export const DASHBOARD_SESSION_PREFIX = "ds_";

/** An organisation as exposed over the API. Never includes key material. */
export interface OrganisationSummary {
  organisation_id: string;
  name: string;
  slug: string;
  created_at: string;
}

/**
 * A website as exposed over the API. `public_key` is included on purpose: it is
 * a public identifier its owning organisation needs in order to install the SDK.
 */
export interface WebsiteSummary {
  site_id: string;
  organisation_id: string;
  name: string;
  domain: string;
  public_key: string;
  is_active: boolean;
  /**
   * Purpose code that must currently resolve to `GRANTED` before this site's
   * analytics events are accepted by the ingestion plane. `null` - the default -
   * means no server-side gate, which is the behaviour every site had before
   * Phase 6A. See docs/security.md.
   */
  analytics_consent_purpose: string | null;
  /**
   * Browser origins accepted in addition to `domain`, as full origins
   * (`https://app.example.com`). Defence in depth: an `Origin` header is
   * evidence about a browser, never proof of consent.
   */
  allowed_origins: string[];
  created_at: string;
}

/**
 * Result of creating a website. Identical to `WebsiteSummary`; the public key is
 * retrievable at any time because it is not a secret.
 */
export type WebsiteCreated = WebsiteSummary;

/**
 * Result of creating an organisation. This is the only time the plaintext
 * secret key exists — only its SHA-256 hash is persisted.
 */
export interface OrganisationCreated extends OrganisationSummary {
  secret_key: string;
}

/** Which credential authenticated a request, and what it grants. */
export type AuthContext =
  | { kind: "ingest"; siteId: string; organisationId: string }
  | { kind: "management"; organisationId: string };
