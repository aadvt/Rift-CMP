-- CreateTable
CREATE TABLE "discovered_components" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "initiator" TEXT,
    "sample_path" TEXT,
    "page_url" TEXT NOT NULL,
    "is_third_party" BOOLEAN NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "vendor" TEXT,
    "category" TEXT,
    "destination_country" TEXT,
    "crosses_border" BOOLEAN NOT NULL DEFAULT false,
    "first_seen" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovered_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_storage" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "writer" TEXT,
    "first_seen" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovered_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_violations" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "purpose_code" TEXT NOT NULL,
    "consent_status" TEXT NOT NULL,
    "page_url" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovered_components_site_id_last_seen_idx" ON "discovered_components"("site_id", "last_seen");

-- CreateIndex
CREATE INDEX "discovered_components_site_id_is_third_party_idx" ON "discovered_components"("site_id", "is_third_party");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_components_site_id_host_kind_key" ON "discovered_components"("site_id", "host", "kind");

-- CreateIndex
CREATE INDEX "discovered_storage_site_id_last_seen_idx" ON "discovered_storage"("site_id", "last_seen");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_storage_site_id_kind_name_key" ON "discovered_storage"("site_id", "kind", "name");

-- CreateIndex
CREATE INDEX "discovery_violations_site_id_observed_at_idx" ON "discovery_violations"("site_id", "observed_at");

-- AddForeignKey
ALTER TABLE "discovered_components" ADD CONSTRAINT "discovered_components_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_storage" ADD CONSTRAINT "discovered_storage_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_violations" ADD CONSTRAINT "discovery_violations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
