-- ─────────────────────────────────────────────────────────────
-- Migration 0011: storage.objects RLS for stage-assets/submissions
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0010 (not edited). The `stage-assets` and
-- `submissions` buckets were created private (public = false) back in
-- 0004, but storage.objects RLS is on by default in Supabase and no
-- policy was ever added for either bucket — so nothing (not even an
-- authenticated admin) could upload to or read from them. That's why
-- the admin "Assets" tab only ever let someone type a storage_path by
-- hand: there was no working upload path to type one into.
--
-- Admins (is_admin(), same real Supabase Auth session used everywhere
-- else in /admin) get full access to both buckets directly from the
-- browser — this is an authorized admin action, no server secret
-- needed. Everyone else (anon/authenticated with no admins row) gets
-- nothing directly; a team's read access is intentionally NOT a
-- storage policy at all, because team identity here is a
-- localStorage code+reg_no pair with no Supabase Auth session to
-- write a policy against (see stageAccess.ts's own comment on this).
-- That's what src/app/api/assets/[id]/route.ts is for: it re-checks
-- the exact same get_stage_content() gate server-side, then uses the
-- service_role key — server-only, never shipped to the browser — to
-- mint a short-lived signed URL. The policies below only ever cover
-- the admin upload path.

create policy "Admin full access to stage-assets" on storage.objects
  for all
  using (bucket_id = 'stage-assets' and is_admin())
  with check (bucket_id = 'stage-assets' and is_admin());

create policy "Admin full access to submissions bucket" on storage.objects
  for all
  using (bucket_id = 'submissions' and is_admin())
  with check (bucket_id = 'submissions' and is_admin());
