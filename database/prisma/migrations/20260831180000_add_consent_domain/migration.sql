
-- CreateTable
CREATE TABLE "principals" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'anonymous',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purposes" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purposes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "document_url" TEXT,
    "content_hash" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "policy_version_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_purposes" (
    "notice_id" TEXT NOT NULL,
    "purpose_id" TEXT NOT NULL,

    CONSTRAINT "notice_purposes_pkey" PRIMARY KEY ("notice_id","purpose_id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "purpose_id" TEXT NOT NULL,
    "notice_id" TEXT,
    "policy_version_id" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "decided_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "principals_site_id_external_id_key" ON "principals"("site_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "principals_id_site_id_key" ON "principals"("id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "purposes_organisation_id_code_key" ON "purposes"("organisation_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purposes_id_organisation_id_key" ON "purposes"("id", "organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "policies_organisation_id_code_key" ON "policies"("organisation_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "policies_id_organisation_id_key" ON "policies"("id", "organisation_id");

-- CreateIndex
CREATE INDEX "policy_versions_organisation_id_idx" ON "policy_versions"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_id_version_key" ON "policy_versions"("policy_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_id_organisation_id_key" ON "policy_versions"("id", "organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "notices_organisation_id_version_locale_key" ON "notices"("organisation_id", "version", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "notices_id_organisation_id_key" ON "notices"("id", "organisation_id");

-- CreateIndex
CREATE INDEX "notice_purposes_purpose_id_idx" ON "notice_purposes"("purpose_id");

-- CreateIndex
CREATE INDEX "consent_records_principal_id_purpose_id_decided_at_idx" ON "consent_records"("principal_id", "purpose_id", "decided_at");

-- CreateIndex
CREATE INDEX "consent_records_site_id_decided_at_idx" ON "consent_records"("site_id", "decided_at");

-- CreateIndex
CREATE INDEX "consent_records_organisation_id_decided_at_idx" ON "consent_records"("organisation_id", "decided_at");

-- CreateIndex
CREATE INDEX "consent_records_purpose_id_idx" ON "consent_records"("purpose_id");

-- AddForeignKey
ALTER TABLE "principals" ADD CONSTRAINT "principals_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purposes" ADD CONSTRAINT "purposes_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_organisation_id_fkey" FOREIGN KEY ("policy_id", "organisation_id") REFERENCES "policies"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_policy_version_id_organisation_id_fkey" FOREIGN KEY ("policy_version_id", "organisation_id") REFERENCES "policy_versions"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_purposes" ADD CONSTRAINT "notice_purposes_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_purposes" ADD CONSTRAINT "notice_purposes_purpose_id_fkey" FOREIGN KEY ("purpose_id") REFERENCES "purposes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_site_id_organisation_id_fkey" FOREIGN KEY ("site_id", "organisation_id") REFERENCES "websites"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_principal_id_site_id_fkey" FOREIGN KEY ("principal_id", "site_id") REFERENCES "principals"("id", "site_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_purpose_id_organisation_id_fkey" FOREIGN KEY ("purpose_id", "organisation_id") REFERENCES "purposes"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_notice_id_organisation_id_fkey" FOREIGN KEY ("notice_id", "organisation_id") REFERENCES "notices"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_policy_version_id_organisation_id_fkey" FOREIGN KEY ("policy_version_id", "organisation_id") REFERENCES "policy_versions"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- Append-only guarantee for the consent audit trail.
--
-- "Consent history must be preserved rather than overwritten" is enforced by the
-- database, not just by convention in application code: a recorded decision can
-- never be altered. Changing your mind means appending a new record, which is
-- what makes the history an audit trail rather than a mutable flag.
--
-- DELETE is deliberately NOT blocked. Tenant offboarding cascades from
-- `organisations` and must keep working, and retention/erasure policy is a
-- separate concern from immutability. The guarantee made here is precisely that
-- a decision is never *rewritten*.
CREATE OR REPLACE FUNCTION rift_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'consent_records is append-only: % is not permitted. Append a new decision instead.', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_records_append_only
    BEFORE UPDATE ON "consent_records"
    FOR EACH ROW EXECUTE FUNCTION rift_consent_records_append_only();
