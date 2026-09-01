/**
 * The audit view.
 *
 * Consent, authorisation and transfer are separate domains with separate
 * storage; this is the one place they are presented as a single story. It is a
 * deliberately flat, denormalised projection rather than a window onto the
 * database: nothing here exposes a table shape, and the internal row ids that
 * do appear are the same public identifiers the other APIs already return.
 */

export type AuditEntryKind = "consent" | "authorisation" | "transfer";

export interface AuditEntry {
  kind: AuditEntryKind;
  /** When the thing happened, for ordering across all three kinds. */
  at: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  /** Domain-specific status: GRANTED / AUTHORISED / DELIVERED and so on. */
  status: string;
  /** One line a human can read without cross-referencing anything. */
  summary: string;
  /** Cross-references, so a reader can follow one decision through to delivery. */
  consent_record_id: string | null;
  authorisation_id: string | null;
  transfer_id: string | null;
}

export interface AuditResponse {
  entries: AuditEntry[];
}
