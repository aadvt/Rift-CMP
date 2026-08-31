
-- DropForeignKey
ALTER TABLE "transfer_records" DROP CONSTRAINT "transfer_records_authorisation_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "transfer_authorisations_id_organisation_id_key" ON "transfer_authorisations"("id", "organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_records_authorisation_id_organisation_id_key" ON "transfer_records"("authorisation_id", "organisation_id");

-- AddForeignKey
ALTER TABLE "transfer_records" ADD CONSTRAINT "transfer_records_authorisation_id_organisation_id_fkey" FOREIGN KEY ("authorisation_id", "organisation_id") REFERENCES "transfer_authorisations"("id", "organisation_id") ON DELETE CASCADE ON UPDATE CASCADE;

