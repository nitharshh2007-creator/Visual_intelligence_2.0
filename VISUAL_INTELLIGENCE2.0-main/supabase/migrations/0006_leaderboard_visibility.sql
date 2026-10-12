-- ─────────────────────────────────────────────────────────────
-- Migration 0006: Leaderboard visibility switch (Phase 3 spec,
-- Section E)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0005 (not edited). The Phase 3 spec's own text
-- labels this "Migration 0005", written assuming Section A (join by
-- code) wouldn't need a migration of its own. It did (0005_team_
-- lookup.sql, shipped first per the build order), so this is 0006 —
-- Section C's "Migration 0005" becomes 0007, and so on. Numbers
-- shift; nothing about the design changes.
--
-- Default is 'hidden'. Once this runs on a real project, the public
-- /leaderboard immediately shows the "hidden" state until an admin
-- flips it to public from the control room — this is intentional
-- (fail-closed), not a bug.

alter table event_state
  add column if not exists leaderboard_visibility text not null default 'hidden'
    check (leaderboard_visibility in ('public', 'hidden')),
  add column if not exists projector_token text,
  add column if not exists leaderboard_rev bigint not null default 0;

update event_state
  set projector_token = replace(gen_random_uuid()::text, '-', '')
  where id = 1 and projector_token is null;

-- ── Generic admin action audit log ──
-- score_audit (0003) is scores-shaped (team_id/stage/points) and
-- doesn't fit a visibility toggle or a token rotation. This is the
-- general-purpose table Section C/D's release/cutoff actions will
-- also write to ("every admin action appears in the audit log").
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  admin_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table admin_audit_log enable row level security;
-- No anon/authenticated policies: readable only via a future
-- admin_list_audit_log() RPC (not needed yet — /admin/log doesn't
-- surface this table in Section E; wiring it up is left for when
-- Section C's Event Flow panel ships, since that's the first place
-- release/cutoff actions need a visible trail).

-- ── leaderboard_rev: bumped so clients can detect "something
--    changed" by watching only the event_state row (now the only
--    thing anon can read directly — see the revokes below) ──
create or replace function bump_leaderboard_rev()
returns trigger
language plpgsql
as $$
begin
  update event_state set leaderboard_rev = leaderboard_rev + 1 where id = 1;
  return null;
end;
$$;

drop trigger if exists trg_bump_rev_scores on scores;
create trigger trg_bump_rev_scores
  after insert or update or delete on scores
  for each statement
  execute function bump_leaderboard_rev();

drop trigger if exists trg_bump_rev_activity on activity;
create trigger trg_bump_rev_activity
  after insert on activity
  for each statement
  execute function bump_leaderboard_rev();

-- event_state's own meaningful changes (stage/status/announcement/
-- pause/visibility) must also bump the rev — extends the existing
-- 0002 before-update trigger (same name/signature, so this is a
-- plain `create or replace`, not a new trigger).
create or replace function log_stage_activity()
returns trigger
language plpgsql
as $$
begin
  if new.current_stage is distinct from old.current_stage then
    insert into activity (type, team_id, message)
    values ('stage_complete', null, 'Stage ' || new.current_stage || ' is now ' || new.status || '.');
  end if;
  new.updated_at := now();
  new.leaderboard_rev := coalesce(old.leaderboard_rev, 0) + 1;
  return new;
end;
$$;

-- ── get_leaderboard: the only public read path for teams/activity
--    from here on ──
-- Visible when: visibility = 'public', OR the caller is an admin
-- session, OR a valid (non-null, matching) projector token is passed.
-- Otherwise returns visibility = 'hidden' with empty teams/activity
-- and zeroed counts — no team data leaks while hidden, full stop.
--
-- `round`/`p_show_eliminated` are placeholders for Section D's
-- qualifier cutoffs, which don't exist yet: round is always null and
-- total_teams == shown_teams (nothing is filtered out yet). Once
-- Section D ships, this function gets a body update (same signature)
-- to read `qualifiers`/`event_state.current_round` and apply the
-- filter described there.
create or replace function get_leaderboard(p_projector_token text default null, p_show_eliminated boolean default false)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_event event_state;
  v_allowed boolean;
  v_total int;
  v_teams jsonb;
  v_activity jsonb;
begin
  select * into v_event from event_state where id = 1;

  v_allowed := v_event.leaderboard_visibility = 'public'
    or is_admin()
    or (p_projector_token is not null and v_event.projector_token is not null and p_projector_token = v_event.projector_token);

  if not v_allowed then
    return jsonb_build_object(
      'visibility', 'hidden',
      'round', null,
      'total_teams', 0,
      'shown_teams', 0,
      'teams', '[]'::jsonb,
      'activity', '[]'::jsonb
    );
  end if;

  select count(*) into v_total from leaderboard_view;

  select coalesce(jsonb_agg(to_jsonb(lv) order by lv.rank), '[]'::jsonb) into v_teams
  from leaderboard_view lv;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_activity
  from (select * from activity order by created_at desc limit 50) a;

  return jsonb_build_object(
    'visibility', v_event.leaderboard_visibility,
    'round', null,
    'total_teams', v_total,
    'shown_teams', v_total,
    'teams', v_teams,
    'activity', v_activity
  );
end;
$$;

grant execute on function get_leaderboard(text, boolean) to anon, authenticated;

-- ── Admin RPCs ──
create or replace function admin_set_leaderboard_visibility(p_mode text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_old text;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_mode not in ('public', 'hidden') then
    raise exception 'Invalid visibility mode' using errcode = 'VI001';
  end if;

  select leaderboard_visibility into v_old from event_state where id = 1;

  update event_state set leaderboard_visibility = p_mode where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_leaderboard_visibility', jsonb_build_object('from', v_old, 'to', p_mode), auth.uid());

  return jsonb_build_object('ok', true, 'visibility', p_mode);
end;
$$;

create or replace function admin_rotate_projector_token()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_token text;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  v_token := replace(gen_random_uuid()::text, '-', '');
  update event_state set projector_token = v_token where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('rotate_projector_token', '{}'::jsonb, auth.uid());

  return jsonb_build_object('ok', true, 'projector_token', v_token);
end;
$$;

revoke all on function admin_set_leaderboard_visibility(text) from public, anon;
grant execute on function admin_set_leaderboard_visibility(text) to authenticated;

revoke all on function admin_rotate_projector_token() from public, anon;
grant execute on function admin_rotate_projector_token() to authenticated;

-- ── Lock down direct reads — get_leaderboard is the only path now ──
revoke select on leaderboard_view from anon, authenticated;
revoke select on activity from anon, authenticated;
revoke select on scores from anon, authenticated; -- already ungranted; stated for clarity, per spec

drop policy if exists anon_read_activity on activity;
-- event_state keeps its existing anon_read_event_state policy/grant —
-- useLeaderboard still subscribes to it directly (that's the whole
-- point of leaderboard_rev: the one table anon can still read live).
