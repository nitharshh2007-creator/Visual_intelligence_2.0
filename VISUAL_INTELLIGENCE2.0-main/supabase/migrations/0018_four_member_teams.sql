-- Limit every team to exactly four members for eligibility and cap.
-- Existing fifth-member records are preserved; the new cap prevents
-- further additions without deleting roster data.

create or replace function enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  current_count int;
  team_max constant int := 4;
begin
  perform 1 from teams where id = new.team_id for update;

  select count(*) into current_count
  from members
  where team_id = new.team_id;

  if current_count >= team_max then
    raise exception 'Team is already full (% / % members)', current_count, team_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function sync_team_status()
returns trigger
language plpgsql
as $$
declare
  v_team_id uuid := coalesce(new.team_id, old.team_id);
  current_count int;
  team_max constant int := 4;
  new_status text;
  old_status text;
begin
  select count(*) into current_count
  from members
  where team_id = v_team_id;

  new_status := case
    when current_count >= team_max then 'full'
    else 'incomplete'
  end;

  select status into old_status from teams where id = v_team_id;
  update teams set status = new_status where id = v_team_id;

  if old_status is distinct from new_status and new_status in ('ready', 'full') then
    insert into activity (type, team_id, message)
    select 'join', v_team_id,
      (select name from teams where id = v_team_id) || ' is ' || new_status || ' to compete!'
    where old_status is distinct from 'ready' and old_status is distinct from 'full';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function admin_move_member(p_member_id uuid, p_to_team_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_from_team_id uuid;
  v_dest_count int;
  team_max constant int := 4;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select team_id into v_from_team_id from members where id = p_member_id;
  if v_from_team_id is null then
    raise exception 'Member not found' using errcode = 'VI001';
  end if;
  if v_from_team_id = p_to_team_id then
    return;
  end if;

  perform 1 from teams where id = p_to_team_id for update;
  select count(*) into v_dest_count from members where team_id = p_to_team_id;
  if v_dest_count >= team_max then
    raise exception 'Destination team is full' using errcode = 'VI012';
  end if;

  update members set team_id = p_to_team_id where id = p_member_id;

  update teams set status = case
    when (select count(*) from members where team_id = teams.id) >= team_max then 'full'
    else 'incomplete'
  end where id in (v_from_team_id, p_to_team_id);

  update teams set captain_id = null
  where id = v_from_team_id and captain_id = p_member_id;
end;
$$;

update teams
set status = case
  when (select count(*) from members where members.team_id = teams.id) >= 4 then 'full'
  else 'incomplete'
end;
