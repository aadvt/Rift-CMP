export type ConsentCheck = (purpose: string) => boolean;

export type SDKOptions = {
  apiUrl?: string;
  /** Alternative to passing the public key positionally to `init()`. */
  publicKey?: string;
};

export type SessionState = {
  sessionId: string;
  lastActivity: number;
};
