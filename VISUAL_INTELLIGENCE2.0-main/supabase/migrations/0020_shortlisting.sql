-- ─────────────────────────────────────────────────────────────
-- Migration 0020: Stage 1/2 scoring cutoff + manual shortlisting
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0019 (not edited).
--
-- Design:
--   • shortlist_config  — singleton row: cutoff (default 60/100),
--                         optional per-stage minimums.
--   • shortlist         — one row per team: admin decision
--                         (shortlisted / rejected / on_hold),
--                         override flag, timestamps, admin id.
--   • _team_stage_state — extended: stages 3/4 require shortlisted.
--   • New RPCs (all SECURITY DEFINER, is_admin() gated):
--       admin_get_shortlist_config
--       admin_set_shortlist_config
--       admin_get_preliminary_scores   (teams + s1/s2 + decision)
--       admin_set_shortlist_decision   (shortlist / reject / hold)
--       admin_bulk_shortlist           (bulk approve eligible teams)
--
-- Scores for stages 1 and 2 continue to live in the existing `scores`
-- table (team_id, stage, points) — no schema change there.
-- The combined score is always derived (s1 + s2), never stored, to
-- avoid inconsistency.
--
-- Stage max marks: stage 1 = 50, stage 2 = 50, combined = 100.

-- ── 1. shortlist_config ──────────────────────────────────────
create table if not exists shortlist_config (
  id int primary key default 1 check (id = 1),   -- singleton
  combined_cutoff numeric not null default 60
    check (combined_cutoff >= 0 and combined_cutoff <= 100),
  stage1_min numeric not null default 0
    check (stage1_min >= 0 and stage1_min <= 50),
  stage2_min numeric not null default 0
    check (stage2_min >= 0 and stage2_min <= 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into shortlist_config (id) values (1) on conflict (id) do nothing;

alter table shortlist_config enable row level security;
-- No direct grants — read/write only via RPCs.

-- ── 2. shortlist ─────────────────────────────────────────────
create table if not exists shortlist (
  team_id uuid primary key references teams(id) on delete cascade,
  decision text not null check (decision in ('shortlisted', 'rejected', 'on_hold')),
  is_override boolean not null default false,
  note text,
  decided_at timestamptz not null default now(),
  decided_by uuid references auth.users(id)
);

alter table shortlist enable row level security;
-- No direct grants — read/write only via RPCs.

-- ── 3. Stage-max helper ──────────────────────────────────────
create or replace function stage_max_points(p_stage int)
returns numeric
language sql
immutable
as $$
  select case p_stage when 1 then 50 when 2 then 50 else 100 end;
$$;

-- ── 4. admin_set_score — add stage-max validation ────────────
-- Replaces the 0003/0017 version. Same signature, adds upper-bound check.
create or replace function admin_set_score(
  p_team_id uuid,
  p_stage int,
  p_points numeric,
  p_note text default null,
  p_force boolean default false
)
returns void
language plpgsql
security definer
as $$
declare
  v_old_points numeric;
  v_locked_stages int[];
  v_max numeric;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;
  if p_points < 0 then raise exception 'Score cannot be negative' using errcode = 'VI001'; end if;

  v_max := stage_max_points(p_stage);
  if p_points > v_max then
    raise exception 'Score exceeds maximum (%) for stage %', v_max, p_stage using errcode = 'VI001';
  end if;

  select scores_locked_stage into v_locked_stages from event_state where id = 1;
  if p_stage = any(v_locked_stages) and not p_force then
    raise exception 'Stage % is locked', p_stage using errcode = 'VI011';
  end if;

  perform 1 from teams where id = p_team_id for update;

  select points into v_old_points from scores where team_id = p_team_id and stage = p_stage;

  insert into scores (team_id, stage, points, detail, updated_at)
  values (p_team_id, p_stage, p_points,
    case when p_note is not null then jsonb_build_object('note', p_note) else null end,
    now())
  on conflict (team_id, stage) do update
    set points = excluded.points, detail = excluded.detail, updated_at = now();

  insert into score_audit (team_id, stage, old_points, new_points, note, admin_id)
  values (p_team_id, p_stage, v_old_points, p_points, p_note, auth.uid());
end;
$$;

-- ── 5. admin_get_shortlist_config ────────────────────────────
create or replace function admin_get_shortlist_config()
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  return (select row_to_json(sc)::jsonb from shortlist_config sc where id = 1);
end;
$$;

-- ── 6. admin_set_shortlist_config ────────────────────────────
create or replace function admin_set_shortlist_config(
  p_combined_cutoff numeric,
  p_stage1_min numeric default 0,
  p_stage2_min numeric default 0
)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_combined_cutoff < 0 or p_combined_cutoff > 100 then
    raise exception 'Combined cutoff must be 0-100' using errcode = 'VI001';
  end if;
  if p_stage1_min < 0 or p_stage1_min > 50 then
    raise exception 'Stage 1 minimum must be 0-50' using errcode = 'VI001';
  end if;
  if p_stage2_min < 0 or p_stage2_min > 50 then
    raise exception 'Stage 2 minimum must be 0-50' using errcode = 'VI001';
  end if;

  update shortlist_config set
    combined_cutoff = p_combined_cutoff,
    stage1_min = p_stage1_min,
    stage2_min = p_stage2_min,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_shortlist_config', jsonb_build_object(
    'combined_cutoff', p_combined_cutoff,
    'stage1_min', p_stage1_min,
    'stage2_min', p_stage2_min
  ), auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 7. admin_get_preliminary_scores ──────────────────────────
-- Returns every ready/full team with s1, s2, combined, cutoff
-- eligibility, and current shortlist decision.
-- s1/s2 are null when no score row exists (pending), not 0 —
-- this is the "pending vs genuine zero" distinction.
-- combined is null until BOTH s1 and s2 exist.
create or replace function admin_get_preliminary_scores()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cfg shortlist_config;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select * into v_cfg from shortlist_config where id = 1;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'team_id',        t.id,
        'team_name',      t.name,
        'team_code',      t.code,
        'member_count',   (select count(*) from members m where m.team_id = t.id),
        's1',             (select points from scores s where s.team_id = t.id and s.stage = 1),
        's2',             (select points from scores s where s.team_id = t.id and s.stage = 2),
        's1_updated_at',  (select updated_at from scores s where s.team_id = t.id and s.stage = 1),
        's2_updated_at',  (select updated_at from scores s where s.team_id = t.id and s.stage = 2),
        'combined',       (
          select
            case when s1pts is not null and s2pts is not null then s1pts + s2pts else null end
          from
            (select points as s1pts from scores where team_id = t.id and stage = 1) sq1
            full outer join
            (select points as s2pts from scores where team_id = t.id and stage = 2) sq2
            on true
        ),
        'cutoff',         v_cfg.combined_cutoff,
        'stage1_min',     v_cfg.stage1_min,
        'stage2_min',     v_cfg.stage2_min,
        'decision',       sl.decision,
        'is_override',    sl.is_override,
        'decided_at',     sl.decided_at,
        'decided_by',     sl.decided_by,
        'created_at',     t.created_at
      ) order by t.name
    ), '[]'::jsonb)
    from teams t
    left join shortlist sl on sl.team_id = t.id
    where t.status in ('ready', 'full')
  );
end;
$$;

-- ── 8. admin_set_shortlist_decision ──────────────────────────
create or replace function admin_set_shortlist_decision(
  p_team_id uuid,
  p_decision text,
  p_note text default null,
  p_force_override boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cfg shortlist_config;
  v_s1 numeric;
  v_s2 numeric;
  v_combined numeric;
  v_is_override boolean := false;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_decision not in ('shortlisted', 'rejected', 'on_hold') then
    raise exception 'Invalid decision' using errcode = 'VI001';
  end if;
  if not exists (select 1 from teams where id = p_team_id) then
    raise exception 'Team not found' using errcode = 'VI001';
  end if;

  select * into v_cfg from shortlist_config where id = 1;
  select points into v_s1 from scores where team_id = p_team_id and stage = 1;
  select points into v_s2 from scores where team_id = p_team_id and stage = 2;

  if v_s1 is not null and v_s2 is not null then
    v_combined := v_s1 + v_s2;
  end if;

  -- If shortlisting a below-cutoff team, require explicit override flag.
  if p_decision = 'shortlisted' and v_combined is not null then
    if v_combined < v_cfg.combined_cutoff
       or v_s1 < v_cfg.stage1_min
       or v_s2 < v_cfg.stage2_min
    then
      if not p_force_override then
        raise exception 'Team is below cutoff. Pass force_override=true to shortlist anyway.' using errcode = 'VI030';
      end if;
      v_is_override := true;
    end if;
  end if;

  insert into shortlist (team_id, decision, is_override, note, decided_at, decided_by)
  values (p_team_id, p_decision, v_is_override, p_note, now(), auth.uid())
  on conflict (team_id) do update set
    decision    = excluded.decision,
    is_override = excluded.is_override,
    note        = excluded.note,
    decided_at  = excluded.decided_at,
    decided_by  = excluded.decided_by;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_shortlist_decision', jsonb_build_object(
    'team_id', p_team_id, 'decision', p_decision,
    'is_override', v_is_override, 'note', p_note,
    's1', v_s1, 's2', v_s2, 'combined', v_combined
  ), auth.uid());

  return jsonb_build_object('ok', true, 'is_override', v_is_override);
end;
$$;

-- ── 9. admin_bulk_shortlist ───────────────────────────────────
-- Shortlists every team that meets the cutoff and has no existing
-- decision (or whose existing decision is 'on_hold' if p_include_on_hold).
-- Never touches teams already explicitly shortlisted or rejected.
create or replace function admin_bulk_shortlist(p_include_on_hold boolean default false)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cfg shortlist_config;
  v_count int := 0;
  v_team record;
  v_s1 numeric;
  v_s2 numeric;
  v_combined numeric;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select * into v_cfg from shortlist_config where id = 1;

  for v_team in
    select t.id
    from teams t
    left join shortlist sl on sl.team_id = t.id
    where t.status in ('ready', 'full')
      and (
        sl.decision is null
        or (p_include_on_hold and sl.decision = 'on_hold')
      )
      and sl.decision is distinct from 'rejected'
      and sl.decision is distinct from 'shortlisted'
  loop
    select points into v_s1 from scores where team_id = v_team.id and stage = 1;
    select points into v_s2 from scores where team_id = v_team.id and stage = 2;

    if v_s1 is null or v_s2 is null then continue; end if;
    v_combined := v_s1 + v_s2;

    if v_combined >= v_cfg.combined_cutoff
       and v_s1 >= v_cfg.stage1_min
       and v_s2 >= v_cfg.stage2_min
    then
      insert into shortlist (team_id, decision, is_override, decided_at, decided_by)
      values (v_team.id, 'shortlisted', false, now(), auth.uid())
      on conflict (team_id) do update set
        decision    = 'shortlisted',
        is_override = false,
        decided_at  = now(),
        decided_by  = auth.uid();
      v_count := v_count + 1;
    end if;
  end loop;

  insert into admin_audit_log (action, detail, admin_id)
  values ('bulk_shortlist', jsonb_build_object('shortlisted_count', v_count), auth.uid());

  return jsonb_build_object('ok', true, 'shortlisted_count', v_count);
end;
$$;

-- ── 10. _team_stage_state — enforce shortlisting for stages 3/4 ──
-- Replaces the 0008/0017 version. Same signature, adds shortlist check.
-- A team with no shortlist row is treated as blocked (not_shortlisted).
-- Only teams with decision = 'shortlisted' may access stages 3 and 4.
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
  v_shortlist_decision text;
begin
  -- ── Shortlist gate (stages 3 and 4 only) ──────────────────
  if p_stage >= 3 then
    select decision into v_shortlist_decision
    from shortlist where team_id = p_team_id;

    -- NULL (no row) or any value other than 'shortlisted' blocks access.
    if coalesce(v_shortlist_decision, 'not_decided') <> 'shortlisted' then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'not_shortlisted');
    end if;
  end if;

  -- ── Existing elimination check (0008) ─────────────────────
  select current_round, current_advance_rule into v_round, v_rule from event_state where id = 1;

  if v_round > 0 and v_rule = 'eliminate' and p_stage > v_round then
    select exists (select 1 from qualifiers where team_id = p_team_id and after_stage = v_round) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_' || v_round);
    end if;
  end if;

  -- ── Stage lifecycle ────────────────────────────────────────
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

-- ── 11. get_stage_access — expose not_shortlisted reason ─────
-- Same signature as 0017. Body updated to pass stage_status through.
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
      v_team_id := null;
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
      'reason', coalesce((per_team.state)->>'reason', case when sp.status = 'not_released' then 'not_released' else null end),
      'stage_status', sp.status
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

-- ── 12. Grants ───────────────────────────────────────────────
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_get_shortlist_config',
        'admin_set_shortlist_config',
        'admin_get_preliminary_scores',
        'admin_set_shortlist_decision',
        'admin_bulk_shortlist',
        'stage_max_points',
        'admin_set_score'
      )
  loop
    execute format('revoke all on function %s from public, anon;', fn.sig);
    execute format('grant execute on function %s to authenticated;', fn.sig);
  end loop;
end $$;

-- get_stage_access is already granted to anon/authenticated (0007).
-- Re-grant after replace to be safe.
grant execute on function get_stage_access(text, text) to anon, authenticated;
