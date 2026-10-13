-- ─────────────────────────────────────────────────────────────
-- Migration 0016: Realtime replica identity fix
-- ─────────────────────────────────────────────────────────────
-- Supabase Realtime filters (e.g. `id=eq.<uuid>`) only work when the
-- table's replica identity includes the filtered column. The default
-- replica identity is PRIMARY KEY only, which means:
--   • INSERT events always broadcast the full new row → filters work.
--   • UPDATE/DELETE events only broadcast the PK in the OLD record →
--     a filter like `team_id=eq.<uuid>` on members UPDATE/DELETE would
--     never match because `team_id` isn't in the OLD record.
--
-- Setting REPLICA IDENTITY FULL makes Postgres include every column in
-- the WAL record for UPDATE/DELETE, so Realtime can evaluate any
-- column filter on any event type. The trade-off is slightly larger
-- WAL entries — acceptable for these small, low-write tables.

alter table teams    replica identity full;
alter table members  replica identity full;
