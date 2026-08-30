export type ConsentCheck = (purpose: string) => boolean;

export type SDKOptions = {
  apiUrl?: string;
};

export type SessionState = {
  sessionId: string;
  lastActivity: number;
};
