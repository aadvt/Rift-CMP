-- Phase 3: consent experiments.
--
-- An experiment varies how a consent choice is *presented*. It cannot vary what
-- the choice means, and that is the shape of these tables rather than a rule
-- applied on top of them: `experiment_variants` has one column for a difference,
-- `text`, and it holds display copy. There is no column for a purpose, a rule, a
-- jurisdiction or an action, so a variant cannot express one.
--
-- Four changes.
--
--   1. `experiments` and `experiment_variants`. Scoped by organisation and site
--      through a composite foreign key, the same shape every other tenant-scoped
--      table here uses.
--
--   2. `experiment_events` records impressions - the banner was shown and
--      nothing was chosen. Those leave no consent record, and without them every
--      acceptance rate is a percentage of the people who already chose
--      something, which is not the number anybody means by it.
--
--      It carries no principal, no session and no address. A row says an arm was
--      shown, never who saw it, so it is not personal data and does not become a
--      new retention obligation. That is deliberate: counting how many people
--      saw a banner does not require knowing which people, and a per-visitor row
--      here would rebuild the identity link consent analytics does not have.
--
--      There is deliberately no assignments table. Which arm a browser is in is
--      computed in that browser from a key that never leaves it, so the server
--      learns which arm a decision belongs to and never which browser is in
--      which arm.
--
--   3. `consent_records` gains experiment attribution. Two nullable columns: a
--      decision taken outside an experiment has no arm, and that is the ordinary
--      case rather than missing data. The variant is stored by its stable key
--      rather than a row id, so deleting an experiment cannot orphan the
--      attribution on a record that can never be updated.
--
--   4. `consent_records.proof_version` records which canonical form produced a
--      signature. Existing rows are NULL, meaning the original scheme, and are
--      rebuilt and verified under it - a proof written in March must not stop
--      verifying because a newer scheme exists.
--
-- The append-only guarantee is untouched: adding columns is DDL and does not
-- pass through the row trigger, and no existing row changes.

CREATE TABLE "experiments" (
    "id"                TEXT         NOT NULL,
    "organisation_id"   TEXT         NOT NULL,
    "site_id"           TEXT         NOT NULL,
    "name"              TEXT         NOT NULL,
    "description"       TEXT,
    "status"            TEXT         NOT NULL DEFAULT 'DRAFT',
    "starts_at"         TIMESTAMP(3),
    "ends_at"           TIMESTAMP(3),
    "policy_version_id" TEXT,
    "created_by"        TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_variants" (
    "id"              TEXT    NOT NULL,
    "experiment_id"   TEXT    NOT NULL,
    "organisation_id" TEXT    NOT NULL,
    "key"             TEXT    NOT NULL,
    "name"            TEXT    NOT NULL,
    "description"     TEXT,
    "allocation"      INTEGER NOT NULL,
    -- Display copy, and nothing else. See the note at the top.
    "text"            JSONB,
    "is_control"      BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_events" (
    "id"              TEXT         NOT NULL,
    "organisation_id" TEXT         NOT NULL,
    "site_id"         TEXT         NOT NULL,
    "experiment_id"   TEXT         NOT NULL,
    "variant_id"      TEXT         NOT NULL,
    "kind"            TEXT         NOT NULL,
    "occurred_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "consent_records"
    ADD COLUMN "proof_version" TEXT,
    ADD COLUMN "experiment_id" TEXT,
    ADD COLUMN "variant_key"   TEXT;

-- Composite key to the site, so an experiment can never reference a website in
-- another tenant.
ALTER TABLE "experiments"
    ADD CONSTRAINT "experiments_site_id_organisation_id_fkey"
    FOREIGN KEY ("site_id", "organisation_id")
    REFERENCES "websites" ("id", "organisation_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiment_variants"
    ADD CONSTRAINT "experiment_variants_experiment_id_fkey"
    FOREIGN KEY ("experiment_id") REFERENCES "experiments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiment_events"
    ADD CONSTRAINT "experiment_events_experiment_id_fkey"
    FOREIGN KEY ("experiment_id") REFERENCES "experiments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiment_events"
    ADD CONSTRAINT "experiment_events_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "experiment_variants" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "experiments_id_organisation_id_key"
    ON "experiments" ("id", "organisation_id");
CREATE INDEX "experiments_organisation_id_created_at_idx"
    ON "experiments" ("organisation_id", "created_at");
-- "Is anything running on this site" is asked on every consent config read.
CREATE INDEX "experiments_site_id_status_idx"
    ON "experiments" ("site_id", "status");

-- One key per experiment: two arms sharing a key would make every attributed
-- decision ambiguous.
CREATE UNIQUE INDEX "experiment_variants_experiment_id_key_key"
    ON "experiment_variants" ("experiment_id", "key");
CREATE INDEX "experiment_variants_organisation_id_idx"
    ON "experiment_variants" ("organisation_id");

CREATE INDEX "experiment_events_experiment_id_kind_occurred_at_idx"
    ON "experiment_events" ("experiment_id", "kind", "occurred_at");
CREATE INDEX "experiment_events_site_id_occurred_at_idx"
    ON "experiment_events" ("site_id", "occurred_at");
CREATE INDEX "experiment_events_organisation_id_occurred_at_idx"
    ON "experiment_events" ("organisation_id", "occurred_at");

-- The comparison view reads decisions for one arm over a window. Without this it
-- scans the whole decision log, which is the largest table on a busy tenant.
CREATE INDEX "consent_records_experiment_id_variant_key_decided_at_idx"
    ON "consent_records" ("experiment_id", "variant_key", "decided_at");
