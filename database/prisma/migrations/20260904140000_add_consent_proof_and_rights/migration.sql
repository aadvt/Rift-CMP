-- Phase 10A: consent evidence, retention metadata, and rights requests.
--
-- Three changes, and what is *not* here matters as much as what is.
--
--   1. `consent_records` gains evidence columns. All nullable, because every
--      record written before this has none - and backfilling a value nobody
--      observed would manufacture the evidence these columns exist to provide.
--      No column here holds anything about the person beyond the principal
--      reference the table already carried.
--
--   2. `purposes` gains retention metadata the operator writes. There is no
--      computed period and no default: retention turns on the processing, the
--      regime and facts only the fiduciary holds, so the schema records what
--      they say rather than what the platform guesses. Null means "not stated",
--      which a rights response reports as such rather than as "none".
--
--   3. `rights_requests` records a request and its state. Rift does not fulfil
--      one: access and deletion reach into systems it does not own, and a
--      platform marking a request "completed" from its own tables would be
--      certifying something it cannot see. The operator does the work; this is
--      the workflow record and the audit trail around it.
--
-- The append-only guarantee on `consent_records` is untouched. Adding columns
-- is DDL and does not go through the row trigger, and no existing row changes.

ALTER TABLE "consent_records"
    ADD COLUMN "jurisdictions"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "mechanism"             TEXT,
    ADD COLUMN "policy_config_version" TEXT,
    ADD COLUMN "vendors"               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "proof_hash"            TEXT;

-- Looking a receipt up by its digest is the one query a principal's own
-- verification makes, and it should not scan the log to answer it.
CREATE INDEX "consent_records_proof_hash_idx" ON "consent_records"("proof_hash");

ALTER TABLE "purposes"
    ADD COLUMN "retention_note"   TEXT,
    ADD COLUMN "retention_period" TEXT;

CREATE TABLE "rights_requests" (
    "id"               TEXT NOT NULL,
    "organisation_id"  TEXT NOT NULL,
    "site_id"          TEXT NOT NULL,
    "principal_id"     TEXT NOT NULL,
    "kind"             TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'received',
    "jurisdictions"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rule_references"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "message"          TEXT,
    "resolution_note"  TEXT,
    "contact"          TEXT,
    "received_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at"     TIMESTAMP(3),
    "due_at"           TIMESTAMP(3),

    CONSTRAINT "rights_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rights_requests_id_organisation_id_key"
    ON "rights_requests"("id", "organisation_id");
CREATE INDEX "rights_requests_organisation_id_received_at_idx"
    ON "rights_requests"("organisation_id", "received_at");
CREATE INDEX "rights_requests_site_id_status_idx"
    ON "rights_requests"("site_id", "status");
CREATE INDEX "rights_requests_principal_id_idx"
    ON "rights_requests"("principal_id");

ALTER TABLE "rights_requests"
    ADD CONSTRAINT "rights_requests_organisation_id_fkey"
    FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite, so a request can never name a site from another tenant. The same
-- shape every cross-domain reference in this schema uses.
ALTER TABLE "rights_requests"
    ADD CONSTRAINT "rights_requests_site_id_organisation_id_fkey"
    FOREIGN KEY ("site_id", "organisation_id")
    REFERENCES "websites"("id", "organisation_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- And composite again, so a request can never name a principal from another
-- site. A rights request about the wrong person is the worst thing this table
-- could hold, so it is made unrepresentable rather than validated.
ALTER TABLE "rights_requests"
    ADD CONSTRAINT "rights_requests_principal_id_site_id_fkey"
    FOREIGN KEY ("principal_id", "site_id")
    REFERENCES "principals"("id", "site_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
