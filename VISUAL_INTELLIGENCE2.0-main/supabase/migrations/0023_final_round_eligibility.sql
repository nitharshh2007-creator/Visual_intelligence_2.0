-- Keep round transitions and final-round eligibility enforced in the
-- database, not only by the admin controls.

create or replace function admin_set_stage(p_stage int, p_duration_seconds int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_status text;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;
  if p_stage not between 1 and 4 then
    raise exception 'Invalid stage' using errcode = 'VI001';
  end if;
  if p_duration_seconds <= 0 then
    raise exception 'Invalid duration' using errcode = 'VI001';
  end if;

  select status into v_event_status
  from event_state
  where id = 1
  for update;

  if v_event_status = 'finished' then
    raise exception 'The event has finished' using errcode = 'VI001';
  end if;
  if exists (select 1 from stage_progress where status = 'live') then
    raise exception 'End the live stage before starting another stage' using errcode = 'VI001';
  end if;
  if not exists (select 1 from stage_progress where stage = p_stage and status = 'released') then
    raise exception 'Stage % must be released before it can start', p_stage using errcode = 'VI001';
  end if;
  if p_stage > 1 and not exists (
    select 1 from stage_progress where stage = p_stage - 1 and status = 'ended'
  ) then
    raise exception 'Stage % cannot start until Stage % has ended', p_stage, p_stage - 1
      using errcode = 'VI001';
  end if;
  if p_stage = 3 and not exists (
    select 1 from shortlist sl
    join teams t on t.id = sl.team_id
    where sl.decision = 'shortlisted' and t.status in ('ready', 'full')
  ) then
    raise exception 'Shortlist eligible teams before starting Stage 3' using errcode = 'VI031';
  end if;
  if p_stage = 4 and (
    not exists (select 1 from event_state where id = 1 and current_round = 3)
    or not exists (select 1 from qualifiers where after_stage = 3)
  ) then
    raise exception 'Apply the Stage 3 cutoff before starting the final stage' using errcode = 'VI013';
  end if;

  update event_state set
    current_stage = p_stage,
    status = 'live',
    stage_started_at = now(),
    stage_ends_at = now() + (p_duration_seconds || ' seconds')::interval,
    paused_at = null,
    remaining_ms = null,
    released_stage = greatest(released_stage, p_stage),
    updated_at = now()
  where id = 1;

  update stage_progress set
    status = 'live',
    started_at = now(),
    released_at = coalesce(released_at, now())
  where stage = p_stage and status = 'released';

  insert into activity (type, team_id, message)
  values ('stage_complete', null, 'Stage ' || p_stage || ' is now live (' || p_duration_seconds || 's).');
end;
$$;

create or replace function admin_end_stage()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage int;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select current_stage into v_stage
  from event_state
  where id = 1
  for update;

  if v_stage not between 1 and 4 or not exists (
    select 1 from stage_progress where stage = v_stage and status = 'live'
  ) then
    raise exception 'There is no live stage to end' using errcode = 'VI001';
  end if;

  update event_state set
    status = case when v_stage = 4 then 'finished' else status end,
    stage_ends_at = now(),
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1;

  update stage_progress set status = 'ended', ended_at = now()
  where stage = v_stage and status = 'live';

  insert into activity (type, team_id, message)
  values (
    'stage_complete',
    null,
    case when v_stage = 4 then 'Final Stage 4 ended. Event finished.'
      else 'Stage ' || v_stage || ' ended.' end
  );
end;
$$;

create or replace function _ranked_teams_through_stage(p_after_stage int)
returns table (team_id uuid, name text, total numeric, rnk bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    t.id,
    t.name,
    coalesce((
      select sum(s.points)
      from scores s
      where s.team_id = t.id and s.stage <= p_after_stage
    ), 0) as total,
    row_number() over (
      order by
        coalesce((
          select sum(s.points)
          from scores s
          where s.team_id = t.id and s.stage <= p_after_stage
        ), 0) desc,
        coalesce((
          select s.points
          from scores s
          where s.team_id = t.id and s.stage <= p_after_stage
          order by s.stage desc
          limit 1
        ), 0) desc,
        t.created_at asc,
        t.id asc
    ) as rnk
  from teams t
  where t.status in ('ready', 'full')
    and (
      p_after_stage < 3
      or exists (
        select 1 from shortlist sl
        where sl.team_id = t.id and sl.decision = 'shortlisted'
      )
    );
$$;

create or replace function admin_preview_cutoff(p_after_stage int, p_keep_mode text, p_keep_value int default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_count int;
  v_keep int;
  v_cut_total numeric;
  v_tie_warning boolean;
  v_teams jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;
  if p_after_stage not between 1 and 3 then
    raise exception 'Cutoffs are only available after Stages 1–3; Stage 4 is final'
      using errcode = 'VI001';
  end if;
  if p_keep_mode not in ('half', 'count') then
    raise exception 'Invalid keep mode' using errcode = 'VI001';
  end if;

  select count(*) into v_team_count from _ranked_teams_through_stage(p_after_stage);
  v_keep := case
    when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int
    else coalesce(p_keep_value, v_team_count)
  end;
  v_keep := least(greatest(v_keep, 0), v_team_count);

  select total into v_cut_total
  from _ranked_teams_through_stage(p_after_stage)
  where rnk = v_keep;

  select exists (
    select 1 from _ranked_teams_through_stage(p_after_stage)
    where total = v_cut_total and rnk > v_keep
  ) into v_tie_warning;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'team_id', team_id,
      'name', name,
      'rank', rnk,
      'total', total,
      'would_keep', (v_keep > 0 and total >= v_cut_total)
    )
    order by rnk
  ), '[]'::jsonb) into v_teams
  from _ranked_teams_through_stage(p_after_stage);

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
set search_path = public, pg_temp
as $$
declare
  v_team_count int;
  v_keep int;
  v_cut_total numeric;
  v_label text;
  v_kept_count int;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;
  if p_after_stage not between 1 and 3 then
    raise exception 'Cutoffs are only available after Stages 1–3; Stage 4 is final'
      using errcode = 'VI001';
  end if;
  if p_keep_mode not in ('half', 'count') then
    raise exception 'Invalid keep mode' using errcode = 'VI001';
  end if;
  if p_advance_rule not in ('eliminate', 'display_only') then
    raise exception 'Invalid advance rule' using errcode = 'VI001';
  end if;
  if p_after_stage = 3 and p_advance_rule <> 'eliminate' then
    raise exception 'The Stage 3 cutoff must eliminate non-finalists' using errcode = 'VI001';
  end if;
  if not exists (
    select 1 from stage_progress where stage = p_after_stage and status = 'ended'
  ) then
    raise exception 'Stage % has not ended yet', p_after_stage using errcode = 'VI013';
  end if;

  perform 1 from event_state where id = 1 for update;
  if p_after_stage = 3 and exists (
    select 1 from stage_progress where stage = 4 and status in ('live', 'ended')
  ) then
    raise exception 'The final stage has started; its cutoff can no longer be changed'
      using errcode = 'VI013';
  end if;

  select count(*) into v_team_count from _ranked_teams_through_stage(p_after_stage);
  if v_team_count = 0 then
    raise exception 'There are no eligible teams for this cutoff' using errcode = 'VI001';
  end if;
  v_keep := case
    when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int
    else coalesce(p_keep_value, v_team_count)
  end;
  v_keep := least(greatest(v_keep, 0), v_team_count);
  v_label := case when p_keep_mode = 'half' then 'TOP HALF' else 'TOP ' || v_keep end;

  select total into v_cut_total
  from _ranked_teams_through_stage(p_after_stage)
  where rnk = v_keep;

  delete from qualifiers where after_stage >= p_after_stage;

  insert into qualifiers (team_id, after_stage, rank_at_cut, total_at_cut, applied_by)
  select team_id, p_after_stage, rnk, total, auth.uid()
  from _ranked_teams_through_stage(p_after_stage)
  where case
    when coalesce(cardinality(p_extra_include), 0) + coalesce(cardinality(p_extra_exclude), 0) > 0
      then team_id = any(coalesce(p_extra_include, '{}'::uuid[]))
    else (v_keep > 0 and total >= v_cut_total)
  end
  and not (team_id = any(coalesce(p_extra_exclude, '{}'::uuid[])));

  select count(*) into v_kept_count from qualifiers where after_stage = p_after_stage;
  v_label := 'AFTER STAGE ' || p_after_stage || ' · ' || v_label || ' (' || v_kept_count || ' ADVANCE)';

  update event_state set
    current_round = p_after_stage,
    current_round_label = v_label,
    current_advance_rule = p_advance_rule,
    updated_at = now()
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('apply_cutoff', jsonb_build_object(
    'after_stage', p_after_stage,
    'keep_mode', p_keep_mode,
    'keep_value', p_keep_value,
    'kept_count', v_kept_count,
    'extra_include', p_extra_include,
    'extra_exclude', p_extra_exclude,
    'advance_rule', p_advance_rule
  ), auth.uid());

  return jsonb_build_object(
    'ok', true,
    'after_stage', p_after_stage,
    'kept_count', v_kept_count,
    'label', v_label
  );
end;
$$;

create or replace function admin_undo_cutoff(p_after_stage int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prev int;
  v_prev_count int;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;
  if p_after_stage not between 1 and 3 then
    raise exception 'Invalid cutoff stage' using errcode = 'VI001';
  end if;

  perform 1 from event_state where id = 1 for update;
  if exists (
    select 1 from stage_progress
    where stage > p_after_stage and status in ('live', 'ended')
  ) then
    raise exception 'A later stage has started; this cutoff can no longer be undone'
      using errcode = 'VI013';
  end if;

  delete from qualifiers where after_stage >= p_after_stage;
  select max(after_stage) into v_prev from qualifiers;
  v_prev := coalesce(v_prev, 0);
  select count(*) into v_prev_count from qualifiers where after_stage = v_prev;

  update event_state set
    current_round = v_prev,
    current_round_label = case
      when v_prev = 0 then null
      else 'AFTER STAGE ' || v_prev || ' (' || v_prev_count || ' ADVANCE)'
    end,
    current_advance_rule = case when v_prev = 0 then 'eliminate' else current_advance_rule end,
    updated_at = now()
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('undo_cutoff', jsonb_build_object('after_stage', p_after_stage, 'reverted_to', v_prev), auth.uid());

  return jsonb_build_object('ok', true, 'current_round', v_prev);
end;
$$;

create or replace function _team_stage_state(p_team_id uuid, p_stage int)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_progress stage_progress;
  v_prior_done boolean;
  v_override boolean;
  v_round int;
  v_rule text;
  v_qualified boolean;
  v_shortlist_decision text;
begin
  if p_stage >= 3 then
    if not exists (
      select 1 from teams
      where id = p_team_id and status in ('ready', 'full')
    ) then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'team_not_eligible');
    end if;

    select decision into v_shortlist_decision
    from shortlist
    where team_id = p_team_id;

    if coalesce(v_shortlist_decision, 'not_decided') <> 'shortlisted' then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'not_shortlisted');
    end if;
  end if;

  select current_round, current_advance_rule
  into v_round, v_rule
  from event_state
  where id = 1;

  if p_stage = 4 then
    if v_round < 3 then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'cutoff_after_stage_3_pending');
    end if;
    select exists (
      select 1 from qualifiers where team_id = p_team_id and after_stage = 3
    ) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_3');
    end if;
  elsif v_round > 0 and v_rule = 'eliminate' and p_stage > v_round then
    select exists (
      select 1 from qualifiers where team_id = p_team_id and after_stage = v_round
    ) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_' || v_round);
    end if;
  end if;

  select * into v_progress from stage_progress where stage = p_stage;
  if v_progress.status = 'not_released' then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_released');
  end if;

  v_prior_done := p_stage = 1 or stage_completion(p_team_id, p_stage - 1);
  select allowed into v_override
  from team_stage_overrides
  where team_id = p_team_id and stage = p_stage;

  if not v_prior_done and coalesce(v_override, false) = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_completed_prior');
  end if;
  if v_prior_done and v_override = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'revoked');
  end if;

  if stage_completion(p_team_id, p_stage) then
    return jsonb_build_object('state', 'COMPLETED', 'reason', null);
  elsif v_progress.status = 'ended' then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'stage_ended');
  elsif v_progress.status = 'live' then
    return jsonb_build_object('state', 'LIVE', 'reason', null);
  end if;

  return jsonb_build_object('state', 'RELEASED', 'reason', null);
end;
$$;

revoke all on function admin_set_stage(int, int) from public, anon;
grant execute on function admin_set_stage(int, int) to authenticated;
revoke all on function admin_end_stage() from public, anon;
grant execute on function admin_end_stage() to authenticated;
revoke all on function _ranked_teams_through_stage(int) from public, anon, authenticated;
revoke all on function admin_preview_cutoff(int, text, int) from public, anon;
grant execute on function admin_preview_cutoff(int, text, int) to authenticated;
revoke all on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) from public, anon;
grant execute on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) to authenticated;
revoke all on function admin_undo_cutoff(int) from public, anon;
grant execute on function admin_undo_cutoff(int) to authenticated;
revoke all on function _team_stage_state(uuid, int) from public, anon, authenticated;
