-- Phase 6A: security hardening of the MVP.
--
-- Four additions here, none of which changes an existing column's meaning:
--
--   1. `principals.secret_hash`      - a browser-held secret binds a consent
--                                      decision to the principal it is about.
--   2. `consent_sessions`            - short-lived, single-site, single-principal
--                                      proof that a decision came from a browser
--                                      that controls that principal.
--   3. `websites.analytics_consent_purpose` and `websites.allowed_origins`
--                                    - per-site server-side consent enforcement
--                                      for ingestion, and origin allow-listing.
--   4. `dashboard_sessions`          - revocable operator sessions, replacing an
--                                      organisation secret held verbatim in a
--                                      cookie.
--
-- Plus the immutability guards at the bottom, which are the point of the whole
-- migration: the routing tables become append-mostly, with a declared state
-- machine, and destruction of history needs an explicit, auditable opt-in.

-- AlterTable
ALTER TABLE "websites"
  ADD COLUMN "analytics_consent_purpose" TEXT,
  ADD COLUMN "allowed_origins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "principals" ADD COLUMN "secret_hash" TEXT;

-- CreateTable
CREATE TABLE "consent_sessions" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "origin" TEXT,
    "decision_count" INTEGER NOT NULL DEFAULT 0,
    "max_decisions" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "consent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_sessions_token_hash_key" ON "consent_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "consent_sessions_site_id_expires_at_idx" ON "consent_sessions"("site_id", "expires_at");

-- CreateIndex
CREATE INDEX "consent_sessions_principal_id_idx" ON "consent_sessions"("principal_id");

-- AddForeignKey
ALTER TABLE "consent_sessions" ADD CONSTRAINT "consent_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: composite, so a session can never name another site's principal.
ALTER TABLE "consent_sessions" ADD CONSTRAINT "consent_sessions_principal_id_site_id_fkey" FOREIGN KEY ("principal_id", "site_id") REFERENCES "principals"("id", "site_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "dashboard_sessions" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "sealed_secret" TEXT NOT NULL,
    "seal_iv" TEXT NOT NULL,
    "seal_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "dashboard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_sessions_token_hash_key" ON "dashboard_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "dashboard_sessions_organisation_id_idx" ON "dashboard_sessions"("organisation_id");

-- AddForeignKey
ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- --- Immutable audit semantics ----------------------------------------------
--
-- The product describes the lifecycle as an audit trail. Until now only
-- `consent_records` was actually protected, and only against UPDATE. The two
-- routing tables carry the other two thirds of that timeline and were freely
-- mutable, so "the transfer cited consent record X" was a claim the database
-- would happily let anyone rewrite.
--
-- These tables cannot be made strictly append-only, because they legitimately
-- advance: an authorisation is consumed, a transfer is delivered. So the
-- guarantee made here is precise, and in practice stronger than a blanket
-- "no UPDATE" that application code would have to work around:
--
--   * every column that records *what happened* is immutable, and
--   * `status` may only move along the declared state machine, forwards.
--
-- Deletion is guarded rather than blocked. Offboarding an organisation must keep
-- working, so it goes through one explicit, greppable opt-in: a transaction that
-- sets `rift.offboarding = 'on'`. `deleteOrganisation()` in
-- `database/tenancy.ts` is the only thing in this repo that does. Anything else
-- deleting history - an ad-hoc psql session, a mistaken script, an ORM cascade
-- nobody expected - fails loudly.
--
-- Note that TRUNCATE does not fire row-level triggers. The test harness
-- truncates between tests and is unaffected; a production TRUNCATE is not a
-- silent rewrite, it is an obvious catastrophe.

CREATE OR REPLACE FUNCTION rift_offboarding_enabled()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN coalesce(current_setting('rift.offboarding', true), '') = 'on';
END;
$$ LANGUAGE plpgsql STABLE;


-- consent_records: unchanged for UPDATE, now guarded for DELETE.
CREATE OR REPLACE FUNCTION rift_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF rift_offboarding_enabled() THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION
            'consent_records is append-only: DELETE requires an explicit offboarding transaction.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    RAISE EXCEPTION
        'consent_records is append-only: % is not permitted. Append a new decision instead.', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consent_records_append_only ON "consent_records";
CREATE TRIGGER consent_records_append_only
    BEFORE UPDATE OR DELETE ON "consent_records"
    FOR EACH ROW EXECUTE FUNCTION rift_consent_records_append_only();


-- transfer_authorisations: AUTHORISED -> CONSUMED | EXPIRED, and nothing else.
CREATE OR REPLACE FUNCTION rift_transfer_authorisations_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF rift_offboarding_enabled() THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION
            'transfer_authorisations is historical: DELETE requires an explicit offboarding transaction.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW."id"                IS DISTINCT FROM OLD."id"
    OR NEW."organisation_id"   IS DISTINCT FROM OLD."organisation_id"
    OR NEW."site_id"           IS DISTINCT FROM OLD."site_id"
    OR NEW."principal_id"      IS DISTINCT FROM OLD."principal_id"
    OR NEW."purpose_id"        IS DISTINCT FROM OLD."purpose_id"
    OR NEW."recipient_id"      IS DISTINCT FROM OLD."recipient_id"
    OR NEW."consent_record_id" IS DISTINCT FROM OLD."consent_record_id"
    OR NEW."nonce"             IS DISTINCT FROM OLD."nonce"
    OR NEW."expires_at"        IS DISTINCT FROM OLD."expires_at"
    OR NEW."created_at"        IS DISTINCT FROM OLD."created_at" THEN
        RAISE EXCEPTION
            'transfer_authorisations records what was authorised: only status may change.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (OLD."status" = 'AUTHORISED' AND NEW."status" IN ('CONSUMED', 'EXPIRED')) THEN
        RAISE EXCEPTION
            'transfer_authorisations: status % -> % is not a permitted transition.', OLD."status", NEW."status"
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transfer_authorisations_immutable ON "transfer_authorisations";
CREATE TRIGGER transfer_authorisations_immutable
    BEFORE UPDATE OR DELETE ON "transfer_authorisations"
    FOR EACH ROW EXECUTE FUNCTION rift_transfer_authorisations_guard();


-- transfer_records: RECORDED -> DELIVERED | FAILED, and the payload never moves.
CREATE OR REPLACE FUNCTION rift_transfer_records_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF rift_offboarding_enabled() THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION
            'transfer_records is historical: DELETE requires an explicit offboarding transaction.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW."id"                   IS DISTINCT FROM OLD."id"
    OR NEW."organisation_id"      IS DISTINCT FROM OLD."organisation_id"
    OR NEW."authorisation_id"     IS DISTINCT FROM OLD."authorisation_id"
    OR NEW."ciphertext"           IS DISTINCT FROM OLD."ciphertext"
    OR NEW."iv"                   IS DISTINCT FROM OLD."iv"
    OR NEW."auth_tag"             IS DISTINCT FROM OLD."auth_tag"
    OR NEW."ephemeral_public_key" IS DISTINCT FROM OLD."ephemeral_public_key"
    OR NEW."ciphertext_sha256"    IS DISTINCT FROM OLD."ciphertext_sha256"
    OR NEW."payload_bytes"        IS DISTINCT FROM OLD."payload_bytes"
    OR NEW."recorded_at"          IS DISTINCT FROM OLD."recorded_at" THEN
        RAISE EXCEPTION
            'transfer_records records what was relayed: only delivery state may change.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (OLD."status" = 'RECORDED' AND NEW."status" IN ('DELIVERED', 'FAILED')) THEN
        RAISE EXCEPTION
            'transfer_records: status % -> % is not a permitted transition.', OLD."status", NEW."status"
            USING ERRCODE = 'restrict_violation';
    END IF;

    -- A delivery timestamp is written once and never revised or erased.
    IF OLD."delivered_at" IS NOT NULL AND NEW."delivered_at" IS DISTINCT FROM OLD."delivered_at" THEN
        RAISE EXCEPTION
            'transfer_records: delivered_at is written once.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD."failure_reason" IS NOT NULL AND NEW."failure_reason" IS DISTINCT FROM OLD."failure_reason" THEN
        RAISE EXCEPTION
            'transfer_records: failure_reason is written once.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transfer_records_immutable ON "transfer_records";
CREATE TRIGGER transfer_records_immutable
    BEFORE UPDATE OR DELETE ON "transfer_records"
    FOR EACH ROW EXECUTE FUNCTION rift_transfer_records_guard();
