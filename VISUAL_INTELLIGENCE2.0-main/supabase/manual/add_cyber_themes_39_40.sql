-- ==============================================================================
-- Add cyber themes 39 and 40 (The Upside Down, Phantom Protocol)
-- Apply manually in Supabase Dashboard -> SQL Editor. Do NOT rerun 0030.
--
-- Additive only: no existing theme, assignment, or function is touched.
-- Migration 0030 created sort_order with `check (sort_order between 1 and 38)`,
-- so that check is widened to 1..40 first, otherwise the insert fails.
-- Runs as one transaction: any error rolls everything back.
--
-- Pre-check (read-only) — confirm the constraint name before running:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.cyber_theme_catalog'::regclass and contype = 'c';
--   -- expect: cyber_theme_catalog_sort_order_check | CHECK (sort_order >= 1 AND sort_order <= 38)
-- ==============================================================================

begin;

alter table public.cyber_theme_catalog
  drop constraint if exists cyber_theme_catalog_sort_order_check;
alter table public.cyber_theme_catalog
  add constraint cyber_theme_catalog_sort_order_check check (sort_order between 1 and 40);

insert into public.cyber_theme_catalog (theme_id, title, description_line1, description_line2, instructions, palette, visual_style, sort_order) values
  ('the-upside-down', 'The Upside Down', 'Visual Style: A dark parallel world of black skies, crimson rift lighting, drifting ash particles, and flickering supernatural glitches.', 'What to Create: Turn the webpage into a portal to the Upside Down with crimson-lit headings, floating spore particles, flickering glitch text, and vine-cracked dark cards.', 'Build a cinematic horror atmosphere with pitch-black backgrounds, pulsing red light, eerie floating particles, and subtle supernatural glitch effects that never hurt readability.', '[{"name":"Upside Black","hex":"#070405"},{"name":"Rift Crimson","hex":"#b3001b"},{"name":"Gate Ember","hex":"#ff3b30"},{"name":"Spore Ash","hex":"#8c8a93"}]'::jsonb, 'upside-down', 39),
  ('phantom-protocol', 'Phantom Protocol', 'Visual Style: Covert cybersecurity consoles, matte-black surfaces, neon-green terminal text, encrypted data streams, and classified-file stamps.', 'What to Create: Rebuild the webpage as a classified intrusion-response console with digital-rain backgrounds, encrypted hash readouts, redaction bars, and CLASSIFIED access badges.', 'Design a stealthy cyber-ops interface using matte-black panels, glowing green monospace text, falling digital rain, and encrypted-data motifs in a strict, minimal layout.', '[{"name":"Matte Black","hex":"#0a0b0a"},{"name":"Phantom Green","hex":"#00ff66"},{"name":"Cipher Graphite","hex":"#1c201d"},{"name":"Redacted Gray","hex":"#6f7a72"}]'::jsonb, 'phantom-protocol', 40)
on conflict (theme_id) do nothing;

commit;

-- Post-check (read-only):
--   select count(*) from public.cyber_theme_catalog;                     -- expect 40
--   select theme_id, sort_order from public.cyber_theme_catalog where sort_order >= 39;
--   select count(*) from public.cyber_theme_assignments;                 -- unchanged
