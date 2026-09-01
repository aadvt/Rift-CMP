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
  | "ingest_failed";

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
