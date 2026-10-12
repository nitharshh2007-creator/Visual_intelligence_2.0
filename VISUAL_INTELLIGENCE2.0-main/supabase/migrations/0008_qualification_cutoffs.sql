-- ─────────────────────────────────────────────────────────────
-- Migration 0008: Qualification cutoffs (Phase 3 spec, Section D)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0007 (not edited). The spec calls this "Migration
-- 0005" too — same renumbering note as 0006/0007: Sections A, E, C
-- claimed 0005-0007 first in build order, so this is 0008.
--
-- Keep/eliminate policy (CUTOFFS, ADVANCE_RULE in src/data/event.ts)
-- is never hardcoded here — the admin UI resolves "half" vs a literal
-- count client-side and passes the number, same as it already does
-- for stage durations.

create table if not exists qualifiers (
  team_id uuid not null references teams(id) on delete cascade,
  after_stage int not null check (after_stage between 1 and 4),
  rank_at_cut int not null,
  total_at_cut numeric not null,
  applied_at timestamptz not null default now(),
  applied_by uuid references auth.users(id),
  primary key (team_id, after_stage)
);

alter table qualifiers enable row level security;
create policy "Admin bypass qualifiers" on qualifiers using (is_admin());
-- No anon/authenticated grant — qualifiers are only ever read inside
-- get_leaderboard()/get_stage_access() (both SECURITY DEFINER).

alter table event_state
  add column if not exists current_round int not null default 0 check (current_round between 0 and 4),
  add column if not exists current_round_label text,
  add column if not exists current_advance_rule text not null default 'eliminate' check (current_advance_rule in ('eliminate', 'display_only'));

-- qualifiers changes need to bump leaderboard_rev too (same reasoning
-- as scores/activity in 0006) — reuses that migration's function,
-- same name/signature, so this is just a new trigger, not a redefine.
drop trigger if exists trg_bump_rev_qualifiers on qualifiers;
create trigger trg_bump_rev_qualifiers
  after insert or update or delete on qualifiers
  for each statement
  execute function bump_leaderboard_rev();

-- _team_stage_state: same signature as 0007, body extended with the
-- ELIMINATED check (qualifiers didn't exist yet when 0007 wrote this).
-- A team is ELIMINATED for any stage past the most recent cutoff if
-- it isn't in that cutoff's qualifier set and the policy is
-- 'eliminate' (not 'display_only', which keeps everyone playing).
create or replace function _team_stage_state(p_team_id uuid, p_stage int)
returns jsonb
language plpgsql
stable
as $$
declare
  v_progress stage_progress;
  v_released boolean;
  v_prior_done boolean;
  v_override boolean;
  v_round int;
  v_rule text;
  v_qualified boolean;
begin
  select current_round, current_advance_rule into v_round, v_rule from event_state where id = 1;

  if v_round > 0 and v_rule = 'eliminate' and p_stage > v_round then
    select exists (select 1 from qualifiers where team_id = p_team_id and after_stage = v_round) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_' || v_round);
    end if;
  end if;

  select * into v_progress from stage_progress where stage = p_stage;
  v_released := v_progress.status <> 'not_released';

  if not v_released then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_released');
  end if;

  v_prior_done := p_stage = 1 or stage_completion(p_team_id, p_stage - 1);

  select allowed into v_override from team_stage_overrides where team_id = p_team_id and stage = p_stage;

  if not v_prior_done and coalesce(v_override, false) = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_completed_prior');
  end if;
  if v_prior_done and v_override = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'revoked');
  end if;

  if stage_completion(p_team_id, p_stage) then
    return jsonb_build_object('state', 'COMPLETED', 'reason', null);
  elsif v_progress.status = 'live' then
    return jsonb_build_object('state', 'LIVE', 'reason', null);
  else
    return jsonb_build_object('state', 'RELEASED', 'reason', null);
  end if;
end;
$$;

-- Ranks ready/full teams by the same formula as leaderboard_view
-- (total desc, most-recent-stage-score desc, created_at asc), so a
-- preview/apply always agrees with what the public board would show.
create or replace function _ranked_teams()
returns table (team_id uuid, name text, total numeric, rnk bigint)
language sql
stable
as $$
  select
    t.id,
    t.name,
    coalesce((select sum(points) from scores s where s.team_id = t.id), 0) as total,
    dense_rank() over (
      order by
        coalesce((select sum(points) from scores s where s.team_id = t.id), 0) desc,
        coalesce((select points from scores s where s.team_id = t.id order by s.stage desc limit 1), 0) desc,
        t.created_at asc
    ) as rnk
  from teams t
  where t.status in ('ready', 'full');
$$;

create or replace function admin_preview_cutoff(p_after_stage int, p_keep_mode text, p_keep_value int default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_count int;
  v_keep int;
  v_cut_total numeric;
  v_tie_warning boolean;
  v_teams jsonb;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_keep_mode not in ('half', 'count') then raise exception 'Invalid keep mode' using errcode = 'VI001'; end if;

  select count(*) into v_team_count from teams where status in ('ready', 'full');
  v_keep := case when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int else coalesce(p_keep_value, v_team_count) end;
  v_keep := least(greatest(v_keep, 0), v_team_count);

  select total into v_cut_total from _ranked_teams() where rnk = v_keep;

  -- TIE_AT_CUTOFF = 'include_all': the keep-set is every team whose
  -- TOTAL is >= the cut line, not just the first `keep` dense_ranks.
  -- dense_rank's own tiebreak (most-recent-stage-score, then
  -- created_at) can split two teams with an IDENTICAL total across
  -- two different ranks straddling the cut — comparing raw `total`
  -- here (not `rnk`) is what actually catches that and avoids
  -- silently dropping one of them. `rnk > v_keep` still narrows this
  -- to teams genuinely past the line, not just any equal total.
  select exists (
    select 1 from _ranked_teams() where total = v_cut_total and rnk > v_keep
  ) into v_tie_warning;

  select coalesce(jsonb_agg(
    jsonb_build_object('team_id', team_id, 'name', name, 'rank', rnk, 'total', total, 'would_keep', total >= v_cut_total)
    order by rnk
  ), '[]'::jsonb) into v_teams
  from _ranked_teams();

  return jsonb_build_object(
    'after_stage', p_after_stage,
    'keep', v_keep,
    'total_teams', v_team_count,
    'cut_line_total', v_cut_total,
    'tie_warning', coalesce(v_tie_warning, false),
    'teams', v_teams
  );
end;
$$;

create or replace function admin_apply_cutoff(
  p_after_stage int,
  p_keep_mode text,
  p_keep_value int default null,
  p_extra_include uuid[] default '{}',
  p_extra_exclude uuid[] default '{}',
  p_advance_rule text default 'eliminate'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_count int;
  v_keep int;
  v_cut_total numeric;
  v_label text;
  v_kept_count int;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_keep_mode not in ('half', 'count') then raise exception 'Invalid keep mode' using errcode = 'VI001'; end if;
  if p_advance_rule not in ('eliminate', 'display_only') then raise exception 'Invalid advance rule' using errcode = 'VI001'; end if;

  if not exists (select 1 from stage_progress where stage = p_after_stage and status = 'ended') then
    raise exception 'Stage % has not ended yet', p_after_stage using errcode = 'VI013';
  end if;

  select count(*) into v_team_count from teams where status in ('ready', 'full');
  v_keep := case when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int else coalesce(p_keep_value, v_team_count) end;
  v_keep := least(greatest(v_keep, 0), v_team_count);
  v_label := case when p_keep_mode = 'half' then 'TOP HALF' else 'TOP ' || v_keep end;

  select total into v_cut_total from _ranked_teams() where rnk = v_keep;

  -- Re-applying the same cutoff (e.g. after tweaking include/exclude)
  -- replaces the prior snapshot cleanly rather than layering on it.
  delete from qualifiers where after_stage = p_after_stage;

  -- TIE_AT_CUTOFF = 'include_all' (see admin_preview_cutoff for why
  -- this compares raw `total`, not `rnk`): everyone at or above the
  -- cut-line total is kept by default; extra_exclude is how the
  -- admin breaks a tie down to the exact target count if they want to.
  insert into qualifiers (team_id, after_stage, rank_at_cut, total_at_cut, applied_by)
  select team_id, p_after_stage, rnk, total, auth.uid()
  from _ranked_teams()
  where (total >= v_cut_total or team_id = any(p_extra_include)) and not (team_id = any(p_extra_exclude));

  select count(*) into v_kept_count from qualifiers where after_stage = p_after_stage;

  update event_state set
    current_round = p_after_stage,
    current_round_label = v_label,
    current_advance_rule = p_advance_rule
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('apply_cutoff', jsonb_build_object(
    'after_stage', p_after_stage, 'keep_mode', p_keep_mode, 'keep_value', p_keep_value,
    'kept_count', v_kept_count, 'extra_include', p_extra_include, 'extra_exclude', p_extra_exclude,
    'advance_rule', p_advance_rule
  ), auth.uid());

  return jsonb_build_object('ok', true, 'after_stage', p_after_stage, 'kept_count', v_kept_count, 'label', v_label);
end;
$$;

create or replace function admin_undo_cutoff(p_after_stage int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_prev int;
  v_prev_label text;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  delete from qualifiers where after_stage >= p_after_stage;

  select max(after_stage) into v_prev from qualifiers;
  v_prev := coalesce(v_prev, 0);
  select current_round_label into v_prev_label from event_state where id = 1; -- only meaningful if v_prev stays the same cutoff; recomputed below when v_prev=0

  update event_state set
    current_round = v_prev,
    current_round_label = case when v_prev = 0 then null else current_round_label end,
    current_advance_rule = case when v_prev = 0 then 'eliminate' else current_advance_rule end
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('undo_cutoff', jsonb_build_object('after_stage', p_after_stage, 'reverted_to', v_prev), auth.uid());

  return jsonb_build_object('ok', true, 'current_round', v_prev);
end;
$$;

-- get_leaderboard: same signature as 0006, body updated to apply the
-- qualifier filter once a cutoff exists. p_show_eliminated only has
-- an effect for admin sessions (organizers auditing who got cut);
-- everyone else always sees the filtered view once current_round > 0.
create or replace function get_leaderboard(p_projector_token text default null, p_show_eliminated boolean default false)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_event event_state;
  v_admin boolean;
  v_allowed boolean;
  v_total int;
  v_teams jsonb;
  v_activity jsonb;
  v_round_label text;
begin
  select * into v_event from event_state where id = 1;
  v_admin := is_admin();

  v_allowed := v_event.leaderboard_visibility = 'public'
    or v_admin
    or (p_projector_token is not null and v_event.projector_token is not null and p_projector_token = v_event.projector_token);

  if not v_allowed then
    return jsonb_build_object(
      'visibility', 'hidden', 'round', null, 'total_teams', 0, 'shown_teams', 0,
      'teams', '[]'::jsonb, 'activity', '[]'::jsonb
    );
  end if;

  select count(*) into v_total from leaderboard_view;

  if v_event.current_round > 0 and not (v_admin and p_show_eliminated) then
    select coalesce(jsonb_agg(to_jsonb(lv) order by lv.rank), '[]'::jsonb) into v_teams
    from leaderboard_view lv
    where exists (select 1 from qualifiers q where q.team_id = lv.team_id and q.after_stage = v_event.current_round);

    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_activity
    from (
      select * from activity a2
      where a2.team_id is null or exists (select 1 from qualifiers q where q.team_id = a2.team_id and q.after_stage = v_event.current_round)
      order by created_at desc
      limit 50
    ) a;
  else
    select coalesce(jsonb_agg(to_jsonb(lv) order by lv.rank), '[]'::jsonb) into v_teams from leaderboard_view lv;
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_activity
    from (select * from activity order by created_at desc limit 50) a;
  end if;

  v_round_label := case when v_event.status = 'finished' then 'FINAL' else v_event.current_round_label end;

  return jsonb_build_object(
    'visibility', v_event.leaderboard_visibility,
    'round', v_round_label,
    'total_teams', v_total,
    'shown_teams', jsonb_array_length(v_teams),
    'teams', v_teams,
    'activity', v_activity
  );
end;
$$;

revoke all on function admin_preview_cutoff(int, text, int) from public, anon;
grant execute on function admin_preview_cutoff(int, text, int) to authenticated;
revoke all on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) from public, anon;
grant execute on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) to authenticated;
revoke all on function admin_undo_cutoff(int) from public, anon;
grant execute on function admin_undo_cutoff(int) to authenticated;
