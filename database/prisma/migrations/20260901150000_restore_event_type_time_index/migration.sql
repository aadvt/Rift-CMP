-- Reconcile the event index set after merging two lines of work.
--
-- `20260830194326_add_event_indexes` created a three-column
-- (site_id, event_type, event_time) index. The tenancy migration that followed
-- dropped it and created a two-column (site_id, event_type) index, because at
-- the time that index existed in the database but not in any committed
-- migration, and was taken for drift rather than a deliberate choice.
--
-- It was deliberate. The three-column form supports "this site, this event
-- type, over this period", which is the actual analytics access pattern, and it
-- subsumes the two-column form as a leading-column prefix. Restore it.
DROP INDEX IF EXISTS "events_site_id_event_type_idx";

CREATE INDEX IF NOT EXISTS "events_site_id_event_type_event_time_idx"
    ON "events"("site_id", "event_type", "event_time");
