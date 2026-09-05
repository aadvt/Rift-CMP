-- Phase 11B: signed consent proofs, and an enforcement log that holds no payloads.
--
-- Two changes.
--
--   1. `consent_records` gains signature and chain columns. These extend the
--      Phase 10A receipt rather than sitting beside it: `proof_hash` is still
--      the integrity digest over the record's evidence, and what is added is the
--      two claims a bare hash could never make - that a named key produced the
--      proof, and that this decision sits where it says it does in one person's
--      history on one site.
--
--      Columns rather than a `consent_proofs` table because there is exactly one
--      proof per decision. A parallel table would be the same row written twice,
--      with an opportunity for the two copies to disagree and no way to tell
--      which was right.
--
--      All nullable. Every record written before this migration has none, and no
--      signing key ever has to be configured - an unsigned proof is a real state
--      that verification reports as unsigned rather than as invalid. Nothing is
--      backfilled: a signature computed today over a decision taken in March
--      would evidence nothing except that we can still run the signer.
--
--   2. `enforcement_events` records what the firewall decided. It is deliberately
--      thin, and the thinness is the design. An enforcement log is the most
--      tempting place in a privacy product to keep request bodies "just for
--      debugging", and doing so would turn this table into a copy of every
--      payload the firewall inspected - including the fields redaction exists to
--      remove. It stores a host, never a URL, because a URL carries a query
--      string and a query string carries those same values.
--
--      There is no principal column, and that is not an omission. Linking an
--      enforcement decision to a visitor would rebuild on this side the identity
--      join that consent analytics deliberately does not have.
--
-- The append-only guarantee on `consent_records` is untouched: adding columns is
-- DDL and does not pass through the row trigger, and no existing row changes.

ALTER TABLE "consent_records"
    ADD COLUMN "proof_signature"     TEXT,
    ADD COLUMN "proof_key_id"        TEXT,
    ADD COLUMN "proof_document_hash" TEXT,
    ADD COLUMN "proof_previous_hash" TEXT,
    ADD COLUMN "proof_sequence"      INTEGER;

-- The chain verifier walks one principal's decisions in order on one site. That
-- is the only query it makes, and it makes it for every verification.
--
-- UNIQUE rather than a plain index, so two decisions written concurrently cannot
-- land on the same position. The second one fails and retries instead of quietly
-- forking the chain - and a forked chain is indistinguishable from tampering
-- once the writes have happened. Records written before this migration have a
-- NULL sequence, and Postgres permits any number of those.
CREATE UNIQUE INDEX "consent_records_site_id_principal_id_proof_sequence_key"
    ON "consent_records" ("site_id", "principal_id", "proof_sequence");

CREATE TABLE "enforcement_events" (
    "id"               TEXT         NOT NULL,
    "organisation_id"  TEXT         NOT NULL,
    "site_id"          TEXT         NOT NULL,
    "occurred_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source"           TEXT         NOT NULL,
    "destination_host" TEXT,
    "vendor"           TEXT,
    "purpose"          TEXT,
    "decision"         TEXT         NOT NULL,
    "effect"           TEXT         NOT NULL,
    "observed_only"    BOOLEAN      NOT NULL DEFAULT false,
    "policy_version"   TEXT,
    "matched_rule"     JSONB,
    "reason"           TEXT         NOT NULL,
    "severity"         TEXT         NOT NULL DEFAULT 'info',
    "redactions"       JSONB,

    CONSTRAINT "enforcement_events_pkey" PRIMARY KEY ("id")
);

-- Composite key to the site, so an event can never reference a website in
-- another tenant - the same shape every other site-scoped table in this schema
-- uses, for the same reason.
ALTER TABLE "enforcement_events"
    ADD CONSTRAINT "enforcement_events_site_id_organisation_id_fkey"
    FOREIGN KEY ("site_id", "organisation_id")
    REFERENCES "websites" ("id", "organisation_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "enforcement_events_organisation_id_occurred_at_idx"
    ON "enforcement_events" ("organisation_id", "occurred_at");
CREATE INDEX "enforcement_events_site_id_occurred_at_idx"
    ON "enforcement_events" ("site_id", "occurred_at");
-- The dashboard's default view is "what was blocked on this site recently",
-- which is this index exactly.
CREATE INDEX "enforcement_events_site_id_decision_occurred_at_idx"
    ON "enforcement_events" ("site_id", "decision", "occurred_at");
