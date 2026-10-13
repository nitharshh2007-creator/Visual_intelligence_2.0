-- Repair stale parallel "live" stage rows left by older stage-start
-- behavior. The End control closes every stage currently marked live.
create or replace function admin_end_stage()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_live_stages int[];
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  perform 1 from event_state where id = 1 for update;
  perform 1 from stage_progress where status = 'live' for update;

  select array_agg(stage order by stage)
  into v_live_stages
  from stage_progress
  where status = 'live';

  if coalesce(cardinality(v_live_stages), 0) = 0 then
    raise exception 'There are no live stages to end' using errcode = 'VI001';
  end if;

  update stage_progress set status = 'ended', ended_at = now()
  where stage = any(v_live_stages) and status = 'live';

  update event_state set
    stage_ends_at = now(),
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1;

  insert into activity (type, team_id, message)
  select
    'stage_complete',
    null,
    'Stage ' || stage || ' ended.'
  from unnest(v_live_stages) as ended_stage(stage);
end;
$$;

revoke all on function admin_end_stage() from public, anon;
grant execute on function admin_end_stage() to authenticated;
