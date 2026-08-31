-- Phase 1: organisation tenancy, key separation, and tenant-integrity constraints.
--
-- This migration is written by hand rather than generated, for two reasons:
--   1. `websites` already holds rows, so `organisation_id` must be added
--      nullable, backfilled, and only then marked NOT NULL. A generated
--      migration would have dropped and recreated the table.
--   2. Databases provisioned before this migration picked up a few indexes
--      out-of-band (not present in the `init` migration). The IF EXISTS /
--      IF NOT EXISTS guards below let this migration converge both a drifted
--      database and a fresh one onto the same final shape.

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "secret_key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");
CREATE UNIQUE INDEX "organisations_secret_key_hash_key" ON "organisations"("secret_key_hash");

-- AlterTable: add the tenant pointer as nullable so existing rows survive.
ALTER TABLE "websites" ADD COLUMN "organisation_id" TEXT;

-- Backfill: adopt any pre-existing website into a single legacy organisation.
-- Its secret key hash is random, so no usable secret exists for it until an
-- operator rotates the key (the seed script replaces this organisation).
INSERT INTO "organisations" ("id", "name", "slug", "secret_key_hash", "created_at")
SELECT
    'org_legacy',
    'Legacy Organisation',
    'legacy',
    encode(sha256((random()::text || clock_timestamp()::text)::bytea), 'hex'),
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "websites" WHERE "organisation_id" IS NULL);

UPDATE "websites" SET "organisation_id" = 'org_legacy' WHERE "organisation_id" IS NULL;

-- Now that every row has an owner, enforce it.
ALTER TABLE "websites" ALTER COLUMN "organisation_id" SET NOT NULL;

-- Drop indexes that drifted in out-of-band; they are superseded below.
DROP INDEX IF EXISTS "events_site_id_event_type_event_time_idx";
DROP INDEX IF EXISTS "sessions_site_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "websites_public_key_key" ON "websites"("public_key");
CREATE INDEX IF NOT EXISTS "websites_organisation_id_idx" ON "websites"("organisation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "websites_id_organisation_id_key" ON "websites"("id", "organisation_id");

CREATE INDEX IF NOT EXISTS "sessions_site_id_last_activity_idx" ON "sessions"("site_id", "last_activity");
-- Required as the target of the composite foreign key from `events`.
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_id_site_id_key" ON "sessions"("id", "site_id");

CREATE INDEX IF NOT EXISTS "events_site_id_event_time_idx" ON "events"("site_id", "event_time");
CREATE INDEX IF NOT EXISTS "events_site_id_event_type_idx" ON "events"("site_id", "event_type");
CREATE INDEX IF NOT EXISTS "events_session_id_idx" ON "events"("session_id");

-- Re-point foreign keys: ON DELETE CASCADE so removing a tenant removes its data.
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_site_id_fkey";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_site_id_fkey";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_session_id_fkey";

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_organisation_id_fkey"
    FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The tenancy constraint that matters most: an event may only reference a
-- session belonging to the same site. Cross-tenant session reuse is now
-- rejected by PostgreSQL, not just by application code.
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_site_id_fkey"
    FOREIGN KEY ("session_id", "site_id") REFERENCES "sessions"("id", "site_id") ON DELETE CASCADE ON UPDATE CASCADE;
