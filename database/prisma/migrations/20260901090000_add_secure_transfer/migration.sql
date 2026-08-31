
-- CreateTable
CREATE TABLE "data_recipients" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "delivery_key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_authorisations" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "purpose_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "consent_record_id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AUTHORISED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_authorisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_records" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "authorisation_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "ephemeral_public_key" TEXT NOT NULL,
    "ciphertext_sha256" TEXT NOT NULL,
    "payload_bytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "failure_reason" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "transfer_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_recipients_delivery_key_hash_key" ON "data_recipients"("delivery_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "data_recipients_organisation_id_code_key" ON "data_recipients"("organisation_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "data_recipients_id_organisation_id_key" ON "data_recipients"("id", "organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_authorisations_nonce_key" ON "transfer_authorisations"("nonce");

-- CreateIndex
CREATE INDEX "transfer_authorisations_organisation_id_created_at_idx" ON "transfer_authorisations"("organisation_id", "created_at");

-- CreateIndex
CREATE INDEX "transfer_authorisations_site_id_status_idx" ON "transfer_authorisations"("site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_records_authorisation_id_key" ON "transfer_records"("authorisation_id");

-- CreateIndex
CREATE INDEX "transfer_records_organisation_id_recorded_at_idx" ON "transfer_records"("organisation_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_id_organisation_id_key" ON "consent_records"("id", "organisation_id");

-- AddForeignKey
ALTER TABLE "data_recipients" ADD CONSTRAINT "data_recipients_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_authorisations" ADD CONSTRAINT "transfer_authorisations_site_id_organisation_id_fkey" FOREIGN KEY ("site_id", "organisation_id") REFERENCES "websites"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_authorisations" ADD CONSTRAINT "transfer_authorisations_principal_id_site_id_fkey" FOREIGN KEY ("principal_id", "site_id") REFERENCES "principals"("id", "site_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_authorisations" ADD CONSTRAINT "transfer_authorisations_purpose_id_organisation_id_fkey" FOREIGN KEY ("purpose_id", "organisation_id") REFERENCES "purposes"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_authorisations" ADD CONSTRAINT "transfer_authorisations_recipient_id_organisation_id_fkey" FOREIGN KEY ("recipient_id", "organisation_id") REFERENCES "data_recipients"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_authorisations" ADD CONSTRAINT "transfer_authorisations_consent_record_id_organisation_id_fkey" FOREIGN KEY ("consent_record_id", "organisation_id") REFERENCES "consent_records"("id", "organisation_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_records" ADD CONSTRAINT "transfer_records_authorisation_id_fkey" FOREIGN KEY ("authorisation_id") REFERENCES "transfer_authorisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

