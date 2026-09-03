/** Shared HTTP contract types for the ingestion and management APIs. */

/**
 * Stable machine-readable error codes. Clients should branch on these rather
 * than on HTTP status or human-readable messages.
 */
export type ApiErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "invalid_event"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "duplicate_event"
  | "site_mismatch"
  | "session_conflict"
  | "unknown_purpose"
  | "unknown_notice"
  | "unknown_policy"
  | "conflict"
  | "unknown_recipient"
  | "consent_not_granted"
  | "authorisation_expired"
  | "authorisation_consumed"
  | "invalid_envelope"
  | "ingest_failed"
  // --- Phase 6A: security hardening -----------------------------------------
  /** No consent session was presented where one is required. */
  | "consent_session_required"
  /** A consent session was presented but is unknown, revoked or not this site's. */
  | "invalid_session"
  | "session_expired"
  /** The session has already recorded as many decisions as it may. */
  | "session_exhausted"
  /** The decision names a principal the presented session does not speak for. */
  | "principal_mismatch"
  /** The site enforces consent for analytics and this request did not prove it. */
  | "consent_required"
  /** The browser `Origin` is not one this site is configured to accept. */
  | "origin_not_allowed"
  | "rate_limited"
  // --- Phase 7A: ingestion input bounds --------------------------------------
  /** The request body is larger than the endpoint accepts. */
  | "payload_too_large";

export interface ApiErrorDetail {
  code: ApiErrorCode;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
  };
}

/** Response body of `POST /api/v1/events`. */
export interface IngestResponse {
  accepted: number;
  rejected: number;
  errors: ApiErrorDetail[];
}
