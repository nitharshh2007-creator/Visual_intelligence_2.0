-- Treat submissions from a previous live run as history when that stage
-- is reopened. Once the stage ends, any submission (or the ended stage)
-- still counts as completion for normal progression.
create or replace function stage_completion(p_team_id uuid, p_stage int)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when sp.status = 'live' then exists (
      select 1
      from submissions s
      join stages st on st.slug = s.stage_slug
      where s.team_id = p_team_id
        and st.number = p_stage
        and s.created_at >= sp.started_at
    )
    else exists (
      select 1
      from submissions s
      join stages st on st.slug = s.stage_slug
      where s.team_id = p_team_id and st.number = p_stage
    ) or sp.status = 'ended'
  end
  from stage_progress sp
  where sp.stage = p_stage;
$$;

create or replace function admin_set_event_status(p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status text;
  v_last_ended_stage int;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;
  if p_status not in ('upcoming', 'live', 'paused', 'finished') then
    raise exception 'Invalid status' using errcode = 'VI001';
  end if;

  select status into v_current_status
  from event_state
  where id = 1
  for update;

  if not found then
    raise exception 'Event state was not found' using errcode = 'VI001';
  end if;

  if v_current_status = 'finished' and p_status = 'live' then
    select max(stage) into v_last_ended_stage
    from stage_progress
    where status = 'ended';

    if v_last_ended_stage <> 4
       or not exists (select 1 from stage_progress where stage = 4 and status = 'ended') then
      raise exception 'The final stage is not available to restart' using errcode = 'VI013';
    end if;
    if exists (select 1 from stage_progress where status = 'live') then
      raise exception 'A stage is already live' using errcode = 'VI001';
    end if;

    update stage_progress
    set status = 'live', started_at = now(), ended_at = null
    where stage = 4 and status = 'ended';

    update event_state set
      status = 'live',
      current_stage = 4,
      stage_started_at = now(),
      stage_ends_at = now() + interval '4 hours',
      paused_at = null,
      remaining_ms = null,
      released_stage = greatest(released_stage, 4),
      updated_at = now()
    where id = 1;

    insert into activity (type, team_id, message)
    values ('stage_complete', null, 'Final Stage 4 restarted; existing submissions and scores were preserved.');
    return;
  end if;

  if v_current_status = 'finished' and p_status not in ('finished') then
    raise exception 'A finished event can only be restarted as live' using errcode = 'VI001';
  end if;

  if v_current_status is distinct from p_status then
    update event_state set
      status = p_status,
      stage_ends_at = case when p_status = 'finished' then now() else stage_ends_at end,
      paused_at = case when p_status = 'finished' then null else paused_at end,
      remaining_ms = case when p_status = 'finished' then null else remaining_ms end,
      updated_at = now()
    where id = 1;

    if p_status = 'finished' then
      update stage_progress set status = 'ended', ended_at = now()
      where status = 'live';
    end if;
  end if;
end;
$$;

revoke all on function stage_completion(uuid, int) from public, anon, authenticated;
revoke all on function admin_set_event_status(text) from public, anon;
grant execute on function admin_set_event_status(text) to authenticated;
