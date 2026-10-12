-- ─────────────────────────────────────────────────────────────
-- Migration 0007: Sequential stage release (Phase 3 spec, Section C)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0006 (not edited). The spec's own text calls this
-- "Migration 0005" — written before Section A (0005) and Section E
-- (0006) claimed those numbers first. Numbers shift; the design does
-- not.
--
-- stage_progress tracks each of the 4 stages' lifecycle independently
-- from event_state.current_stage (which only tracks "what's live
-- RIGHT NOW"). A stage that ENDS before a team submits still counts
-- as completed for that team (see stage_completion below) — a team
-- is never blocked by its own lateness, per the spec.

alter table event_state
  add column if not exists released_stage int not null default 0 check (released_stage between 0 and 4),
  add column if not exists reveal_stage_names boolean not null default false;

-- Bug fix (0006): trg_bump_rev_activity updates event_state from
-- inside activity's AFTER INSERT trigger. That's fine on its own, but
-- log_stage_activity (event_state's BEFORE UPDATE trigger) also
-- inserts into activity whenever current_stage changes — which means
-- an event_state update (e.g. admin_set_stage) cascades into a SECOND
-- update of the very same event_state row while the first one is
-- still mid-flight, which Postgres rejects outright ("tuple to be
-- updated was already modified by an operation triggered by the
-- current command"). Dropping it is safe: log_stage_activity already
-- bumps leaderboard_rev directly for every event_state change
-- (including the ones that insert activity rows), and
-- trg_bump_rev_scores covers every scores-driven activity insert
-- independently. The only case this stops covering instantly is a
-- team crossing into 'ready'/'full' (sync_team_status's activity
-- insert, unrelated to event_state or scores) — the 10s poll still
-- picks that up, just not via realtime.
drop trigger if exists trg_bump_rev_activity on activity;

create table if not exists stage_progress (
  stage int primary key check (stage between 1 and 4),
  status text not null default 'not_released' check (status in ('not_released', 'released', 'live', 'ended')),
  released_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz
);

insert into stage_progress (stage)
  select s from unnest(array[1, 2, 3, 4]) as s
  on conflict (stage) do nothing;

alter table stage_progress enable row level security;
create policy "Admin bypass stage_progress" on stage_progress using (is_admin());
-- Read access for everyone (including anon) — this is just lifecycle
-- status (not_released/released/live/ended), never the stage's
-- content, so there's nothing to leak. get_stage_access() also
-- returns it, but exposing the table directly keeps a cheap, simple
-- read path available without forcing every caller through an RPC
-- for something this inert.
grant select on stage_progress to anon, authenticated;

create table if not exists team_stage_overrides (
  team_id uuid not null references teams(id) on delete cascade,
  stage int not null check (stage between 1 and 4),
  allowed boolean not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (team_id, stage)
);

alter table team_stage_overrides enable row level security;
create policy "Admin bypass team_stage_overrides" on team_stage_overrides using (is_admin());
-- No anon/authenticated grant — overrides are only ever read inside
-- get_stage_access() (SECURITY DEFINER), never directly; a team
-- should never see whether ITS unlock came from a normal completion
-- or a manual admin override, and definitely shouldn't see other
-- teams' overrides.

-- True once a team has a submission for that stage OR the stage has
-- ended — either way, the team is unblocked for whatever comes next.
create or replace function stage_completion(p_team_id uuid, p_stage int)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from submissions s
      join stages st on st.slug = s.stage_slug
      where s.team_id = p_team_id and st.number = p_stage
    )
    or exists (select 1 from stage_progress where stage = p_stage and status = 'ended');
$$;

-- Internal: one team's state for one stage. Not granted to anyone —
-- only called from inside other SECURITY DEFINER functions. Returns
-- {state, reason}: state is one of LOCKED/RELEASED/LIVE/COMPLETED
-- (ELIMINATED is added by migration 0008 once qualifiers exists —
-- same signature, body-only update, so this `create or replace`
-- pattern continues there). reason distinguishes *why* something is
-- LOCKED (not_released vs not_completed_prior) for the UI copy
-- ("Waiting for the host" vs "Complete Stage N to continue") without
-- adding a sixth top-level state.
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
begin
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
    -- An explicit revoke beats an otherwise-earned unlock.
    return jsonb_build_object('state', 'LOCKED', 'reason', 'revoked');
  end if;

  if stage_completion(p_team_id, p_stage) then
    return jsonb_build_object('state', 'COMPLETED', 'reason', null);
  elsif v_progress.status = 'live' then
    return jsonb_build_object('state', 'LIVE', 'reason', null);
  else -- 'released' or 'ended' without a completion row (shouldn't happen — stage_completion covers 'ended')
    return jsonb_build_object('state', 'RELEASED', 'reason', null);
  end if;
end;
$$;

-- Public read path for stage access. With no code (anonymous
-- visitor), returns only the released stage numbers (+ names if
-- event_state.reveal_stage_names) and nothing team-specific. With a
-- valid code, returns the full per-stage state machine for that team.
create or replace function get_stage_access(p_code text default null, p_reg_no text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_reveal boolean;
  v_result jsonb;
begin
  select reveal_stage_names into v_reveal from event_state where id = 1;

  if p_code is not null then
    select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
    if v_team_id is not null and p_reg_no is not null and not exists (
      select 1 from members where team_id = v_team_id and reg_no = p_reg_no
    ) then
      v_team_id := null; -- code+reg_no mismatch: treat as anonymous, not an error (never confirm/deny which part was wrong)
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'stage', st.number,
      'slug', st.slug,
      'name', case
        when v_reveal or is_admin() then st.name
        when v_team_id is not null and (per_team.state->>'state') in ('LIVE', 'COMPLETED') then st.name
        else null
      end,
      'state', coalesce((per_team.state)->>'state', case when sp.status = 'not_released' then 'LOCKED' else 'RELEASED' end),
      'reason', coalesce((per_team.state)->>'reason', case when sp.status = 'not_released' then 'not_released' else null end)
    )
    order by st.number
  ) into v_result
  from stages st
  join stage_progress sp on sp.stage = st.number
  left join lateral (
    select _team_stage_state(v_team_id, st.number) as state
    where v_team_id is not null
  ) per_team on true;

  return jsonb_build_object('stages', coalesce(v_result, '[]'::jsonb));
end;
$$;

grant execute on function get_stage_access(text, text) to anon, authenticated;

-- ── Admin RPCs ──

create or replace function admin_release_stage(p_stage int)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;

  update event_state set released_stage = p_stage where id = 1;

  update stage_progress set status = 'released', released_at = now()
  where stage = p_stage and status = 'not_released';

  insert into admin_audit_log (action, detail, admin_id)
  values ('release_stage', jsonb_build_object('stage', p_stage), auth.uid());

  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$$;

create or replace function admin_set_team_stage_override(p_team_id uuid, p_stage int, p_allowed boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;

  insert into team_stage_overrides (team_id, stage, allowed, note)
  values (p_team_id, p_stage, p_allowed, p_note)
  on conflict (team_id, stage) do update set allowed = excluded.allowed, note = excluded.note, created_at = now();

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_team_stage_override', jsonb_build_object('team_id', p_team_id, 'stage', p_stage, 'allowed', p_allowed, 'note', p_note), auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function admin_set_reveal_stage_names(p_reveal boolean)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  update event_state set reveal_stage_names = p_reveal where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_reveal_stage_names', jsonb_build_object('reveal', p_reveal), auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

-- admin_set_stage/admin_end_stage: same signatures as 0003, bodies
-- extended to also advance stage_progress's own lifecycle.
create or replace function admin_set_stage(p_stage int, p_duration_seconds int)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;
  if p_duration_seconds <= 0 then raise exception 'Invalid duration' using errcode = 'VI001'; end if;

  update event_state set
    current_stage = p_stage,
    status = 'live',
    stage_started_at = now(),
    stage_ends_at = now() + (p_duration_seconds || ' seconds')::interval,
    paused_at = null,
    remaining_ms = null,
    released_stage = greatest(released_stage, p_stage)
  where id = 1;

  update stage_progress set status = 'live', started_at = now(),
    released_at = coalesce(released_at, now())
  where stage = p_stage;

  insert into activity (type, team_id, message)
  values ('stage_complete', null, 'Stage ' || p_stage || ' is now live (' || p_duration_seconds || 's).');
end;
$$;

create or replace function admin_end_stage()
returns void
language plpgsql
security definer
as $$
declare
  v_stage int;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select current_stage into v_stage from event_state where id = 1;

  update event_state set
    stage_ends_at = now(),
    paused_at = null,
    remaining_ms = null
  where id = 1;

  update stage_progress set status = 'ended', ended_at = now() where stage = v_stage;

  insert into activity (type, team_id, message)
  select 'stage_complete', null, 'Stage ' || current_stage || ' ended.'
  from event_state where id = 1;
end;
$$;

-- Everything the Event Flow panel needs in one call: each stage's
-- lifecycle plus every ready/full team's per-stage access state and
-- any manual overrides, so the UI can render "18/24 completed Stage
-- 2" counters and the per-team override table without N+1 calls.
create or replace function admin_get_stage_overview()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_stages jsonb;
  v_teams jsonb;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select jsonb_agg(
    jsonb_build_object(
      'stage', st.number, 'slug', st.slug, 'name', st.name, 'status', sp.status,
      'released_at', sp.released_at, 'started_at', sp.started_at, 'ended_at', sp.ended_at
    ) order by st.number
  ) into v_stages
  from stages st join stage_progress sp on sp.stage = st.number;

  select jsonb_agg(
    jsonb_build_object(
      'team_id', t.id,
      'name', t.name,
      'access', (
        select jsonb_object_agg(s::text, _team_stage_state(t.id, s))
        from unnest(array[1, 2, 3, 4]) as s
      ),
      'overrides', (
        select coalesce(jsonb_object_agg(o.stage::text, jsonb_build_object('allowed', o.allowed, 'note', o.note)), '{}'::jsonb)
        from team_stage_overrides o where o.team_id = t.id
      )
    ) order by t.name
  ) into v_teams
  from teams t where t.status in ('ready', 'full');

  return jsonb_build_object('stages', v_stages, 'teams', coalesce(v_teams, '[]'::jsonb));
end;
$$;

revoke all on function admin_release_stage(int) from public, anon;
grant execute on function admin_release_stage(int) to authenticated;
revoke all on function admin_set_team_stage_override(uuid, int, boolean, text) from public, anon;
grant execute on function admin_set_team_stage_override(uuid, int, boolean, text) to authenticated;
revoke all on function admin_set_reveal_stage_names(boolean) from public, anon;
grant execute on function admin_set_reveal_stage_names(boolean) to authenticated;
revoke all on function admin_get_stage_overview() from public, anon;
grant execute on function admin_get_stage_overview() to authenticated;
