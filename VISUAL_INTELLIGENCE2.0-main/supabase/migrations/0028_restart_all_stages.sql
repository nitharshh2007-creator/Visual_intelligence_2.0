-- Restart all four stages in sequence without deleting team registrations,
-- scores, submissions, shortlist decisions, or qualifier records.
create or replace function stage_completion(p_team_id uuid, p_stage int)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when sp.status = 'ended' then true
    when sp.status = 'live' and sp.started_at is not null then exists (
      select 1
      from submissions s
      join stages st on st.slug = s.stage_slug
      where s.team_id = p_team_id
        and st.number = p_stage
        and s.created_at >= sp.started_at
    )
    else false
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

  if p_status = 'live' and (
    v_current_status = 'finished'
    or (
      v_current_status = 'live'
      and exists (select 1 from stage_progress where stage = 4 and status = 'ended')
    )
  ) then
    if exists (select 1 from stage_progress where status = 'live') then
      raise exception 'End the live stage before restarting the event' using errcode = 'VI001';
    end if;

    update stage_progress set
      status = 'released',
      released_at = coalesce(released_at, now()),
      started_at = null,
      ended_at = null;

    update event_state set
      status = 'live',
      current_stage = 0,
      stage_started_at = null,
      stage_ends_at = null,
      paused_at = null,
      remaining_ms = null,
      released_stage = greatest(released_stage, 4),
      updated_at = now()
    where id = 1;

    insert into activity (type, team_id, message)
    values ('stage_complete', null, 'Event restarted from Stage 1; existing registrations, scores, submissions, and cutoff decisions were preserved.');
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
