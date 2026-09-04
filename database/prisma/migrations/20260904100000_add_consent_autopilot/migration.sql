-- Phase 9A: consent autopilot.
--
-- Two tables, and the reason there are exactly two is the whole design.
--
-- Recommendations are generated from a scan, the jurisdiction resolver and the
-- policy engine. They are suggestions. Storing them in their un-approved form
-- would create a second artifact that looks like configuration, and the first
-- question anyone would ask of it is whether it is live - which is precisely
-- the ambiguity approval exists to remove. So a generated recommendation lives
-- only in a response body until a human approves it.
--
-- What is persisted:
--
--   consent_policy_versions            what a human approved, immutable
--   consent_recommendation_overrides   what a human decided differently, mutable
--
-- No table here carries a "lawful" or "compliant" column, for the same reason
-- the scanner schema does not: a legal conclusion buried in a column is one no
-- lawyer will ever read. The rule references live inside the snapshot, as
-- citations pointing at the requirement matrix.

CREATE TABLE "consent_policy_versions" (
    "id"               TEXT NOT NULL,
    "site_id"          TEXT NOT NULL,
    "organisation_id"  TEXT NOT NULL,
    "version"          INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'draft',
    "scan_id"          TEXT,
    "recommendations"  JSONB NOT NULL,
    "jurisdictions"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "regimes"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "approval_note"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at"      TIMESTAMP(3),

    CONSTRAINT "consent_policy_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_policy_versions_site_id_version_key"
    ON "consent_policy_versions"("site_id", "version");
CREATE UNIQUE INDEX "consent_policy_versions_id_organisation_id_key"
    ON "consent_policy_versions"("id", "organisation_id");
CREATE INDEX "consent_policy_versions_organisation_id_created_at_idx"
    ON "consent_policy_versions"("organisation_id", "created_at");
CREATE INDEX "consent_policy_versions_site_id_status_idx"
    ON "consent_policy_versions"("site_id", "status");

-- One approved version per site. Enforced here rather than in application code
-- because "which configuration is live" is a question the database should only
-- ever have one answer to; two approved rows would make the runtime's choice
-- arbitrary and the bug invisible until someone noticed the wrong banner.
CREATE UNIQUE INDEX "consent_policy_versions_one_approved_per_site"
    ON "consent_policy_versions"("site_id")
    WHERE "status" = 'approved';

ALTER TABLE "consent_policy_versions"
    ADD CONSTRAINT "consent_policy_versions_site_id_organisation_id_fkey"
    FOREIGN KEY ("site_id", "organisation_id")
    REFERENCES "websites"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_policy_versions"
    ADD CONSTRAINT "consent_policy_versions_organisation_id_fkey"
    FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "consent_recommendation_overrides" (
    "id"               TEXT NOT NULL,
    "site_id"          TEXT NOT NULL,
    "organisation_id"  TEXT NOT NULL,
    "detector_id"      TEXT NOT NULL,
    "purpose_code"     TEXT,
    "action"           TEXT NOT NULL,
    "note"             TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_recommendation_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_recommendation_overrides_site_id_detector_id_key"
    ON "consent_recommendation_overrides"("site_id", "detector_id");
CREATE INDEX "consent_recommendation_overrides_organisation_id_idx"
    ON "consent_recommendation_overrides"("organisation_id");

ALTER TABLE "consent_recommendation_overrides"
    ADD CONSTRAINT "consent_recommendation_overrides_site_id_organisation_id_fkey"
    FOREIGN KEY ("site_id", "organisation_id")
    REFERENCES "websites"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_recommendation_overrides"
    ADD CONSTRAINT "consent_recommendation_overrides_organisation_id_fkey"
    FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- An approved version is evidence of what an operator agreed to, and of what
-- the banner was serving when a consent decision was recorded against it.
-- Rewriting one would destroy that, so the only permitted change is the
-- transition out of `approved` into `superseded`, which is what publishing a
-- newer version does.
--
-- A draft stays freely editable: nothing has been claimed about it yet.
CREATE OR REPLACE FUNCTION rift_consent_policy_versions_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."status" = 'approved' THEN
        IF NEW."status" = 'superseded'
           AND NEW."id" = OLD."id"
           AND NEW."site_id" = OLD."site_id"
           AND NEW."version" = OLD."version"
           AND NEW."recommendations"::text = OLD."recommendations"::text
           AND NEW."approved_at" IS NOT DISTINCT FROM OLD."approved_at" THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION
            'consent_policy_versions: an approved version is immutable. Publish a new version instead.'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_policy_versions_guard
    BEFORE UPDATE ON "consent_policy_versions"
    FOR EACH ROW EXECUTE FUNCTION rift_consent_policy_versions_guard();
