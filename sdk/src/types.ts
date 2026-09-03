export type ConsentCheck = (purpose: string) => boolean;

/**
 * Supplies the consent session token the ingestion plane asks for on sites that
 * enforce consent server-side. Resolving to null means "this browser has no
 * consent session", which is the correct answer for a visitor who has never
 * decided anything — never a reason to invent an identity.
 */
export type ConsentSessionProvider = () => Promise<string | null>;

/**
 * The same thing, synchronously, for the unload path. Nothing can be awaited
 * while a page is being torn down, so the beacon flush can only send a token
 * that already exists.
 */
export type SyncConsentSessionProvider = () => string | null;

export type SDKOptions = {
  apiUrl?: string;
  /** Alternative to passing the public key positionally to `init()`. */
  publicKey?: string;
};

export type SessionState = {
  sessionId: string;
  lastActivity: number;
};
