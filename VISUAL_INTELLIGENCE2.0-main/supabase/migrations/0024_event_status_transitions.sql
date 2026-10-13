-- Serialize event status transitions and close any live stage when the
-- event is finished, so the event and stage lifecycle cannot disagree.
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
  if v_current_status = 'finished' and p_status <> 'finished' then
    raise exception 'A finished event cannot be restarted' using errcode = 'VI001';
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

revoke all on function admin_set_event_status(text) from public, anon;
grant execute on function admin_set_event_status(text) to authenticated;
