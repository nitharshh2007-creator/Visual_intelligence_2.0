-- Restart the whole event from Stage 1 through a dedicated RPC.
--
-- Restarting used to be an overload of admin_set_event_status('live').
-- When the event was already live that call is a status no-op, so a
-- database without the restart branch silently did nothing while the
-- admin UI reported success. A dedicated function fails loudly if it is
-- missing, and the restart now also clears the previous run's cutoffs:
-- keeping current_round/qualifiers left every cutoff marked as applied
-- (and later stages filtered by stale qualifiers) before the restarted
-- stages had even run.
--
-- Team registrations, scores, submissions, shortlist decisions and
-- per-team overrides are preserved.
create or replace function admin_restart_event()
returns jsonb
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

  select status into v_current_status
  from event_state
  where id = 1
  for update;

  if not found then
    raise exception 'Event state was not found' using errcode = 'VI001';
  end if;

  perform 1 from stage_progress for update;
  if exists (select 1 from stage_progress where status = 'live') then
    raise exception 'End the live stage before restarting the event' using errcode = 'VI001';
  end if;

  delete from qualifiers where true;

  update stage_progress set
    status = 'released',
    released_at = coalesce(released_at, now()),
    started_at = null,
    ended_at = null
  where true;

  update event_state set
    status = 'live',
    current_stage = 0,
    stage_started_at = null,
    stage_ends_at = null,
    paused_at = null,
    remaining_ms = null,
    current_round = 0,
    current_round_label = null,
    current_advance_rule = 'eliminate',
    released_stage = greatest(released_stage, 4),
    updated_at = now()
  where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('restart_event', jsonb_build_object('previous_status', v_current_status), auth.uid());

  insert into activity (type, team_id, message)
  values ('stage_complete', null, 'Event restarted from Stage 1; stage progress and cutoffs were reset.');

  return jsonb_build_object('ok', true, 'status', 'live', 'current_stage', 0, 'current_round', 0);
end;
$$;

-- Same transitions as 0028, with the restart branch delegating to
-- admin_restart_event() so both entry points reset identically.
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
    perform admin_restart_event();
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

revoke all on function admin_restart_event() from public, anon;
grant execute on function admin_restart_event() to authenticated;
revoke all on function admin_set_event_status(text) from public, anon;
grant execute on function admin_set_event_status(text) to authenticated;
