-- CreateIndex
CREATE INDEX "events_site_id_event_time_idx" ON "events"("site_id", "event_time");

-- CreateIndex
CREATE INDEX "events_site_id_event_type_event_time_idx" ON "events"("site_id", "event_type", "event_time");

-- CreateIndex
CREATE INDEX "events_session_id_idx" ON "events"("session_id");

-- CreateIndex
CREATE INDEX "sessions_site_id_idx" ON "sessions"("site_id");
