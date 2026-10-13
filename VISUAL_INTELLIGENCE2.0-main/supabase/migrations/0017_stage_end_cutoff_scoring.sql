-- Stage-end notification, stage-scoped cutoff ranking, and the supplied
-- judging rubrics.

update stages
set rubric = '[
  {"name":"Similarity to the original image (subject, colours, layout and mood)","max_points":40,"round":1},
  {"name":"Prompt quality (specificity of subject, style, colours, lighting and layout)","max_points":25,"round":1},
  {"name":"Teamwork and clear communication","max_points":20,"round":1},
  {"name":"Time management and efficiency (completion within time, fewer attempts)","max_points":10,"round":1},
  {"name":"Creativity in describing or acting","max_points":5,"round":1},
  {"name":"Similarity to the original image (subject, colours, layout and mood)","max_points":40,"round":2},
  {"name":"Prompt quality (specificity of subject, style, colours, lighting and layout)","max_points":25,"round":2},
  {"name":"Teamwork and clear communication","max_points":20,"round":2},
  {"name":"Time management and efficiency (completion within time, fewer attempts)","max_points":10,"round":2},
  {"name":"Creativity in describing or acting","max_points":5,"round":2}
]'::jsonb
where slug = 'prompt-charades';

update stages
set rubric = '[
  {"name":"Match to the given theme","max_points":25,"round":1},
  {"name":"Prompt quality","max_points":25,"round":1},
  {"name":"Visual design and readability","max_points":25,"round":1},
  {"name":"Functionality (the page continues to work as before)","max_points":15,"round":1},
  {"name":"Creativity","max_points":10,"round":1}
]'::jsonb
where slug = 'cyber-styling';

-- Preserve the public lifecycle signal separately from a team's own
-- completion state, which can also become COMPLETED after submission.
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

grant execute on function get_stage_access(text, text) to anon, authenticated;

-- Make the event_state update an explicit Realtime signal for every
-- open student stage page, and reject duplicate/stale end requests.
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
  if v_stage not between 1 and 4 or not exists (
    select 1 from stage_progress where stage = v_stage and status = 'live'
  ) then
    raise exception 'There is no live stage to end' using errcode = 'VI001';
  end if;

  update event_state set
    stage_ends_at = now(),
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1;

  update stage_progress set status = 'ended', ended_at = now()
  where stage = v_stage and status = 'live';

  insert into activity (type, team_id, message)
  values ('stage_complete', null, 'Stage ' || v_stage || ' ended.');
end;
$$;

create or replace function _ranked_teams_through_stage(p_after_stage int)
returns table (team_id uuid, name text, total numeric, rnk bigint)
language sql
stable
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
  if p_after_stage not between 1 and 4 then raise exception 'Invalid cutoff stage' using errcode = 'VI001'; end if;
  if p_keep_mode not in ('half', 'count') then raise exception 'Invalid keep mode' using errcode = 'VI001'; end if;

  select count(*) into v_team_count from teams where status in ('ready', 'full');
  v_keep := case when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int else coalesce(p_keep_value, v_team_count) end;
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
as $$
declare
  v_team_count int;
  v_keep int;
  v_cut_total numeric;
  v_label text;
  v_kept_count int;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_after_stage not between 1 and 4 then raise exception 'Invalid cutoff stage' using errcode = 'VI001'; end if;
  if p_keep_mode not in ('half', 'count') then raise exception 'Invalid keep mode' using errcode = 'VI001'; end if;
  if p_advance_rule not in ('eliminate', 'display_only') then raise exception 'Invalid advance rule' using errcode = 'VI001'; end if;

  if not exists (select 1 from stage_progress where stage = p_after_stage and status = 'ended') then
    raise exception 'Stage % has not ended yet', p_after_stage using errcode = 'VI013';
  end if;

  select count(*) into v_team_count from teams where status in ('ready', 'full');
  v_keep := case when p_keep_mode = 'half' then ceil(v_team_count / 2.0)::int else coalesce(p_keep_value, v_team_count) end;
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

  return jsonb_build_object('ok', true, 'after_stage', p_after_stage, 'kept_count', v_kept_count, 'label', v_label);
end;
$$;

revoke all on function admin_preview_cutoff(int, text, int) from public, anon;
grant execute on function admin_preview_cutoff(int, text, int) to authenticated;
revoke all on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) from public, anon;
grant execute on function admin_apply_cutoff(int, text, int, uuid[], uuid[], text) to authenticated;

-- Persist per-round marks and write the average of Prompt Charades'
-- round totals (not their combined sum) to the leaderboard score.
create or replace function admin_submit_rubric_score(
  p_team_id uuid,
  p_stage_slug text,
  p_criteria jsonb,
  p_comment text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_stage_number int;
  v_rubric jsonb;
  v_round_count int;
  v_round int;
  v_round_total numeric;
  v_total numeric := 0;
  v_expected_count int;
  v_key text;
  v_input jsonb;
  v_points numeric;
  v_max_points numeric;
  v_criterion record;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select number, rubric into v_stage_number, v_rubric
  from stages
  where slug = p_stage_slug;
  if v_stage_number is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;
  if p_criteria is null or jsonb_typeof(p_criteria) <> 'object' then
    raise exception 'Criteria scores must be an object' using errcode = 'VI001';
  end if;

  select greatest(coalesce(max(coalesce((criterion->>'round')::int, 1)), 1), 1),
         count(*)
  into v_round_count, v_expected_count
  from jsonb_array_elements(coalesce(v_rubric, '[]'::jsonb)) as item(criterion);

  if jsonb_object_length(p_criteria) <> v_expected_count then
    raise exception 'Enter a score for every rubric criterion' using errcode = 'VI001';
  end if;

  for v_round in 1..v_round_count loop
    v_round_total := 0;
    for v_criterion in
      select criterion
      from jsonb_array_elements(coalesce(v_rubric, '[]'::jsonb)) as item(criterion)
      where coalesce((criterion->>'round')::int, 1) = v_round
    loop
      v_key := case
        when v_round_count > 1 then 'Round ' || v_round || ' :: ' || (v_criterion.criterion->>'name')
        else v_criterion.criterion->>'name'
      end;
      v_input := p_criteria -> v_key;
      if v_input is null or jsonb_typeof(v_input) <> 'number' then
        raise exception 'Invalid score for %', v_key using errcode = 'VI001';
      end if;
      v_points := (v_input #>> '{}')::numeric;
      v_max_points := coalesce((v_criterion.criterion->>'max_points')::numeric, 10);
      if v_points < 0 or v_points > v_max_points then
        raise exception 'Score for % must be between 0 and %', v_key, v_max_points using errcode = 'VI001';
      end if;
      v_round_total := v_round_total + v_points;
    end loop;
    v_total := v_total + v_round_total;
  end loop;
  v_total := v_total / v_round_count;

  insert into rubric_scores (team_id, stage_slug, judge_id, criteria, comment, updated_at)
  values (p_team_id, p_stage_slug, auth.uid()::text, p_criteria, p_comment, now())
  on conflict (team_id, stage_slug, judge_id) do update
    set criteria = excluded.criteria, comment = excluded.comment, updated_at = now();

  perform admin_set_score(p_team_id, v_stage_number, v_total, 'rubric: ' || p_criteria::text, p_force);

  return jsonb_build_object('ok', true, 'total', v_total);
end;
$$;

revoke all on function admin_submit_rubric_score(uuid, text, jsonb, text, boolean) from public, anon;
grant execute on function admin_submit_rubric_score(uuid, text, jsonb, text, boolean) to authenticated;
