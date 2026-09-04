-- Phase 8A: the website scanner.
--
-- Seven tables for Playwright-based scans, added *alongside* the in-page
-- discovery domain rather than replacing it. The two answer different
-- questions and neither subsumes the other:
--
--   discovered_components  what a real visitor's browser did, which is the only
--                          way to evidence that a tracker fired while consent
--                          was withdrawn. Needs the tag installed.
--   scans                  what a robot saw at one moment, logged out. Works
--                          before signup, which is what onboarding needs.
--
-- Three properties of this schema are deliberate and load-bearing:
--
--   1. There is no cookie `value` column, and no request header or body column
--      anywhere. The crawler discards values at its own boundary; the absence
--      of a destination here means a later change cannot quietly start storing
--      them without someone adding a column and justifying it.
--   2. `scan_requests` is aggregated per (host, resource_type, method) rather
--      than one row per request, so a hostile page cannot turn one scan into
--      unbounded writes. Same reasoning as `discovered_components`.
--   3. No table carries a "consent required" or "lawful" column. Scanner rows
--      are observations; the compliance layer reads them and decides. Putting a
--      legal conclusion in this schema would bury it where no lawyer looks.
--
-- Every child table cascades from `scans`, and `scans` cascades from both
-- `websites` and `organisations`, so tenant offboarding removes scan history
-- with everything else rather than leaving orphans behind.

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL DEFAULT 'baseline',
    "start_url" TEXT NOT NULL,
    "crawler_version" TEXT,
    "config" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "pages_discovered" INTEGER NOT NULL DEFAULT 0,
    "pages_scanned" INTEGER NOT NULL DEFAULT 0,
    "pages_failed" INTEGER NOT NULL DEFAULT 0,
    "cookies_found" INTEGER NOT NULL DEFAULT 0,
    "scripts_found" INTEGER NOT NULL DEFAULT 0,
    "requests_observed" INTEGER NOT NULL DEFAULT 0,
    "storage_items_found" INTEGER NOT NULL DEFAULT 0,
    "third_party_domains" INTEGER NOT NULL DEFAULT 0,
    "technologies_detected" INTEGER NOT NULL DEFAULT 0,
    "consent_ui_detected" BOOLEAN NOT NULL DEFAULT false,
    "consent_ui_signals" JSONB,
    "limit_reached" TEXT,
    "robots_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_pages" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "final_url" TEXT,
    "status" INTEGER,
    "title" TEXT,
    "content_type" TEXT,
    "depth" INTEGER NOT NULL,
    "redirect_chain" JSONB NOT NULL,
    "rendered" BOOLEAN NOT NULL,
    "error" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_cookies" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "expires" TIMESTAMP(3),
    "secure" BOOLEAN NOT NULL,
    "http_only" BOOLEAN NOT NULL,
    "same_site" TEXT,
    "is_third_party" BOOLEAN NOT NULL,
    "first_seen_on" TEXT NOT NULL,

    CONSTRAINT "scan_cookies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_scripts" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "url" TEXT,
    "host" TEXT,
    "inline" BOOLEAN NOT NULL,
    "is_third_party" BOOLEAN NOT NULL,
    "observed_on" TEXT NOT NULL,

    CONSTRAINT "scan_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_requests" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sample_path" TEXT,
    "is_third_party" BOOLEAN NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER,

    CONSTRAINT "scan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_storage" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "observed_on" TEXT NOT NULL,

    CONSTRAINT "scan_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_technologies" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "detector_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "destination_country" TEXT,
    "crosses_border" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "scan_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scans_organisation_id_created_at_idx" ON "scans"("organisation_id", "created_at");

-- CreateIndex
CREATE INDEX "scans_site_id_created_at_idx" ON "scans"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "scans_status_created_at_idx" ON "scans"("status", "created_at");

-- CreateIndex
CREATE INDEX "scan_pages_scan_id_idx" ON "scan_pages"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_pages_scan_id_url_key" ON "scan_pages"("scan_id", "url");

-- CreateIndex
CREATE INDEX "scan_cookies_scan_id_idx" ON "scan_cookies"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_cookies_scan_id_name_domain_path_key" ON "scan_cookies"("scan_id", "name", "domain", "path");

-- CreateIndex
CREATE INDEX "scan_scripts_scan_id_idx" ON "scan_scripts"("scan_id");

-- CreateIndex
CREATE INDEX "scan_scripts_scan_id_host_idx" ON "scan_scripts"("scan_id", "host");

-- CreateIndex
CREATE INDEX "scan_requests_scan_id_idx" ON "scan_requests"("scan_id");

-- CreateIndex
CREATE INDEX "scan_requests_scan_id_is_third_party_idx" ON "scan_requests"("scan_id", "is_third_party");

-- CreateIndex
CREATE UNIQUE INDEX "scan_requests_scan_id_host_resource_type_method_key" ON "scan_requests"("scan_id", "host", "resource_type", "method");

-- CreateIndex
CREATE INDEX "scan_storage_scan_id_idx" ON "scan_storage"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_storage_scan_id_kind_name_origin_key" ON "scan_storage"("scan_id", "kind", "name", "origin");

-- CreateIndex
CREATE INDEX "scan_technologies_scan_id_idx" ON "scan_technologies"("scan_id");

-- CreateIndex
CREATE INDEX "scan_technologies_scan_id_category_idx" ON "scan_technologies"("scan_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "scan_technologies_scan_id_detector_id_key" ON "scan_technologies"("scan_id", "detector_id");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_pages" ADD CONSTRAINT "scan_pages_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_cookies" ADD CONSTRAINT "scan_cookies_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_scripts" ADD CONSTRAINT "scan_scripts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_requests" ADD CONSTRAINT "scan_requests_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_storage" ADD CONSTRAINT "scan_storage_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_technologies" ADD CONSTRAINT "scan_technologies_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

