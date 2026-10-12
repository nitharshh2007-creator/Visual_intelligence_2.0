-- ─────────────────────────────────────────────────────────────
-- Migration 0009: Gated stage content + submissions (Phase 3 spec,
-- Section B)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0008 (not edited). Before this migration, /stages
-- and /stages/[slug] queried the `stages`/`stage_assets` tables
-- directly from a server component using the anon-key session —
-- which RLS already blocked for every non-admin visitor (the only
-- policy on those tables is "is_admin() bypass"), so in practice
-- those pages showed nothing to real students. These two RPCs are
-- the actual public/team-scoped read and write path from here on;
-- get_stage_access()/_team_stage_state() (0007/0008) are reused
-- as-is so there is exactly one access-state implementation.

-- Full gated content for one team, one stage. Refuses with LOCKED,
-- NOT_LIVE or ELIMINATED (mapped to VI021/VI022/VI020 below) unless
-- the team's state is LIVE or COMPLETED. Never returns stage_secrets.
create or replace function get_stage_content(p_code text, p_reg_no text, p_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_stage stages;
  v_state jsonb;
  v_assets jsonb;
  v_submissions jsonb;
begin
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null or not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  select * into v_stage from stages where slug = p_slug;
  if v_stage.slug is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  v_state := _team_stage_state(v_team_id, v_stage.number);

  if v_state->>'state' = 'ELIMINATED' then
    raise exception 'Your team did not qualify past the last cutoff' using errcode = 'VI020';
  elsif v_state->>'state' = 'LOCKED' then
    raise exception 'This stage is locked' using errcode = 'VI021';
  elsif v_state->>'state' = 'RELEASED' then
    raise exception 'This stage has not started yet' using errcode = 'VI022';
  end if;
  -- LIVE or COMPLETED from here — allowed to view.

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id, 'kind', a.kind, 'label', a.label, 'sort', a.sort,
      'storage_path', a.storage_path, 'text_value', a.text_value, 'meta', a.meta
    ) order by a.sort
  ), '[]'::jsonb) into v_assets
  from stage_assets a
  where a.stage_slug = p_slug
    and (a.assign_mode = 'all' or exists (
      select 1 from stage_assignments sa where sa.stage_slug = p_slug and sa.team_id = v_team_id and sa.asset_id = a.id
    ));

  select coalesce(jsonb_agg(
    jsonb_build_object('id', s.id, 'version', s.version, 'kind', s.kind, 'text_value', s.text_value, 'url', s.url, 'created_at', s.created_at)
    order by s.version desc
  ), '[]'::jsonb) into v_submissions
  from submissions s where s.team_id = v_team_id and s.stage_slug = p_slug;

  return jsonb_build_object(
    'stage', jsonb_build_object(
      'number', v_stage.number, 'slug', v_stage.slug, 'name', v_stage.name, 'hook', v_stage.hook,
      'tests', v_stage.tests, 'duration_min', v_stage.duration_min, 'overview_md', v_stage.overview_md,
      'rules_md', v_stage.rules_md, 'roles_md', v_stage.roles_md, 'phases', v_stage.phases
    ),
    'state', v_state->>'state',
    'assets', v_assets,
    'submissions', v_submissions
  );
end;
$$;

grant execute on function get_stage_content(text, text, text) to anon, authenticated;

-- Records a submission; only allowed while the team's state for this
-- stage is LIVE (not RELEASED/LOCKED/ELIMINATED, and not a second
-- submission's worth of re-gating once already COMPLETED — teams can
-- still re-submit a new version while LIVE, just not after the stage
-- or their own completion has closed the window).
create or replace function submit_stage_result(
  p_code text,
  p_reg_no text,
  p_slug text,
  p_kind text,
  p_text_value text default null,
  p_url text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_member_id uuid;
  v_stage stages;
  v_state jsonb;
  v_version int;
  v_submission_id uuid;
begin
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  select id into v_member_id from members where team_id = v_team_id and reg_no = p_reg_no;
  if v_team_id is null or v_member_id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  select * into v_stage from stages where slug = p_slug;
  if v_stage.slug is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  v_state := _team_stage_state(v_team_id, v_stage.number);

  if v_state->>'state' = 'ELIMINATED' then
    raise exception 'Your team did not qualify past the last cutoff' using errcode = 'VI020';
  elsif v_state->>'state' <> 'LIVE' then
    raise exception 'This stage is not live' using errcode = 'VI022';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from submissions where team_id = v_team_id and stage_slug = p_slug;

  insert into submissions (team_id, stage_slug, version, kind, text_value, url, member_id)
  values (v_team_id, p_slug, v_version, p_kind, p_text_value, p_url, v_member_id::text)
  returning id into v_submission_id;

  insert into activity (type, team_id, message)
  select 'stage_complete', v_team_id, t.name || ' submitted Stage ' || v_stage.number || '.'
  from teams t where t.id = v_team_id;

  return jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'version', v_version);
end;
$$;

grant execute on function submit_stage_result(text, text, text, text, text, text) to anon, authenticated;

-- Fills in a random unassigned asset (assign_mode='random') per
-- ready/full team for a stage. Idempotent by default — teams that
-- already have an assignment for this stage are skipped, so running
-- it again only fills gaps (new teams, or ones an admin cleared).
create or replace function admin_generate_stage_assignments(p_stage_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_assigned int := 0;
  v_team record;
  v_asset_id uuid;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  for v_team in select id from teams where status in ('ready', 'full') loop
    if exists (select 1 from stage_assignments where stage_slug = p_stage_slug and team_id = v_team.id) then
      continue;
    end if;

    select id into v_asset_id from stage_assets
    where stage_slug = p_stage_slug and assign_mode = 'random'
    order by random() limit 1;

    if v_asset_id is not null then
      insert into stage_assignments (team_id, stage_slug, asset_id) values (v_team.id, p_stage_slug, v_asset_id);
      v_assigned := v_assigned + 1;
    end if;
  end loop;

  insert into admin_audit_log (action, detail, admin_id)
  values ('generate_stage_assignments', jsonb_build_object('stage_slug', p_stage_slug, 'assigned', v_assigned), auth.uid());

  return jsonb_build_object('ok', true, 'assigned', v_assigned);
end;
$$;

create or replace function admin_set_team_assignment(p_team_id uuid, p_stage_slug text, p_asset_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  delete from stage_assignments where team_id = p_team_id and stage_slug = p_stage_slug;
  insert into stage_assignments (team_id, stage_slug, asset_id) values (p_team_id, p_stage_slug, p_asset_id);

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_team_assignment', jsonb_build_object('team_id', p_team_id, 'stage_slug', p_stage_slug, 'asset_id', p_asset_id), auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

-- Admin read of assignments for the Assignments tab (team name +
-- asset label), since stage_assignments has no anon/authenticated
-- grant at all (only is_admin() RLS bypass on the base table, which
-- the admin UI's direct `.from("stage_assignments")` calls already
-- rely on — this just adds the join so it's one call, not N+1).
create or replace function admin_get_stage_assignments(p_stage_slug text)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', t.id, 'team_name', t.name, 'asset_id', sa.asset_id, 'asset_label', a.label
    ) order by t.name)
    from stage_assignments sa
    join teams t on t.id = sa.team_id
    left join stage_assets a on a.id = sa.asset_id
    where sa.stage_slug = p_stage_slug
  ), '[]'::jsonb);
end;
$$;

-- The "You finished #N of M" card needs the team's own rank — not
-- exposed by get_stage_access() (that's purely per-stage state, not
-- leaderboard-shaped). Returns null when the team hasn't been
-- eliminated (never cut, or no cutoff has been applied yet). Rank/
-- total are computed live via _ranked_teams() rather than frozen at
-- cut time: an eliminated team's own total can't change (they can't
-- submit anymore), but their RANK can still shift as other teams
-- keep scoring in later stages — showing the current rank is more
-- honest than a stale snapshot, and qualifiers only stores rows for
-- teams that WERE kept, so there's no cut-time rank recorded for an
-- eliminated team to begin with.
create or replace function get_team_cut_result(p_code text, p_reg_no text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_round int;
  v_rule text;
  v_total_teams int;
  v_qualified boolean;
  v_rank bigint;
  v_total numeric;
begin
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null or not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    return null;
  end if;

  select current_round, current_advance_rule into v_round, v_rule from event_state where id = 1;
  if v_round = 0 or v_rule <> 'eliminate' then
    return null;
  end if;

  select exists (select 1 from qualifiers where team_id = v_team_id and after_stage = v_round) into v_qualified;
  if v_qualified then
    return null;
  end if;

  select rnk, total into v_rank, v_total from _ranked_teams() where team_id = v_team_id;
  select count(*) into v_total_teams from teams where status in ('ready', 'full');

  return jsonb_build_object('after_stage', v_round, 'rank', v_rank, 'total', v_total, 'total_teams', v_total_teams);
end;
$$;

grant execute on function get_team_cut_result(text, text) to anon, authenticated;

revoke all on function admin_generate_stage_assignments(text) from public, anon;
grant execute on function admin_generate_stage_assignments(text) to authenticated;
revoke all on function admin_set_team_assignment(uuid, text, uuid) from public, anon;
grant execute on function admin_set_team_assignment(uuid, text, uuid) to authenticated;
revoke all on function admin_get_stage_assignments(text) from public, anon;
grant execute on function admin_get_stage_assignments(text) to authenticated;
