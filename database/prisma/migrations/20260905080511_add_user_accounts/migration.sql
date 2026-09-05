-- NOTE: Prisma generated a `DROP INDEX "consent_records_proof_hash_idx"` here
-- and it was removed by hand. That index is drift between the live database and
-- schema.prisma, not part of adding user accounts, and a migration named
-- "add_user_accounts" is the wrong place for an unrelated index on the consent
-- log to disappear. The drift is still there and still wants resolving on its
-- own terms.

-- AlterTable
ALTER TABLE "dashboard_sessions" ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "sealed_secret" DROP NOT NULL,
ALTER COLUMN "seal_iv" DROP NOT NULL,
ALTER COLUMN "seal_tag" DROP NOT NULL;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "organisation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organisation_id_idx" ON "users"("organisation_id");

-- CreateIndex
CREATE INDEX "dashboard_sessions_user_id_idx" ON "dashboard_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
