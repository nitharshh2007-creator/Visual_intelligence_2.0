-- ─────────────────────────────────────────────────────────────
-- Migration 0014: manual registration close (independent of deadline)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0013 (not edited). Until now the ONLY thing that
-- closed registration was event_state.registration_deadline — to
-- close early an admin had to compute a past timestamp and type it
-- into the deadline field on /admin/teams. This adds a plain on/off
-- switch that's independent of the deadline entirely: closing it
-- doesn't change the deadline, and reopening doesn't require picking
-- a new one. Both checks stay in force — closed OR past-deadline
-- still refuses with the same VI004 the UI already handles.

alter table event_state
  add column if not exists registration_closed boolean not null default false;

create or replace function admin_set_registration_closed(p_closed boolean)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  
  update event_state set registration_closed = p_closed, updated_at = now() where id = 1;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_registration_closed', jsonb_build_object('closed', p_closed), auth.uid());

  return jsonb_build_object('ok', true, 'registration_closed', p_closed);
end;
$$;

revoke all on function admin_set_registration_closed(boolean) from public, anon;
grant execute on function admin_set_registration_closed(boolean) to authenticated;

-- Redefines create_team/join_team from 0005 (not edited): identical
-- except for the added registration_closed check, raised before the
-- existing deadline check so a manually-closed event never leaks the
-- deadline-specific codepath.
create or replace function create_team(
  p_team_name text,
  p_captain_name text,
  p_reg_no text default null,
  p_email text default null,
  p_section text default null,
  p_year int default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_closed boolean;
  v_deadline timestamptz;
  v_team_id uuid;
  v_captain_id uuid;
  v_code text;
begin
  select registration_closed, registration_deadline into v_closed, v_deadline from event_state where id = 1;
  if v_closed or now() > v_deadline then
    raise exception 'Registration is closed' using errcode = 'VI004';
  end if;

  if trim(p_team_name) = '' or trim(p_captain_name) = '' then
    raise exception 'Team name and captain name are required' using errcode = 'VI001';
  end if;

  if not is_allowed_year(p_year) then
    raise exception 'Not eligible for this event' using errcode = 'VI006';
  end if;

  if not is_allowed_email(p_email) then
    raise exception 'Email domain is not eligible' using errcode = 'VI006';
  end if;

  if exists (select 1 from teams where name = trim(p_team_name)) then
    raise exception 'Team name already taken' using errcode = 'VI005';
  end if;

  if p_reg_no is not null and exists (select 1 from members where reg_no = p_reg_no) then
    raise exception 'This registration number is already on a team' using errcode = 'VI003';
  end if;

  v_code := generate_team_code();

  insert into teams (name, code) values (trim(p_team_name), v_code)
  returning id into v_team_id;

  insert into members (team_id, name, reg_no, email, section, year, role)
  values (v_team_id, trim(p_captain_name), p_reg_no, p_email, p_section, p_year, 'captain')
  returning id into v_captain_id;

  update teams set captain_id = v_captain_id where id = v_team_id;

  return jsonb_build_object('team_id', v_team_id, 'code', v_code);
end;
$$;

create or replace function join_team(
  p_code text,
  p_member_name text,
  p_reg_no text default null,
  p_email text default null,
  p_phone text default null,
  p_section text default null,
  p_year int default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_closed boolean;
  v_deadline timestamptz;
  v_member_id uuid;
begin
  select registration_closed, registration_deadline into v_closed, v_deadline from event_state where id = 1;
  if v_closed or now() > v_deadline then
    raise exception 'Registration is closed' using errcode = 'VI004';
  end if;

  if not is_allowed_year(p_year) then
    raise exception 'Not eligible for this event' using errcode = 'VI006';
  end if;

  if not is_allowed_email(p_email) then
    raise exception 'Email domain is not eligible' using errcode = 'VI006';
  end if;

  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  if p_reg_no is not null and exists (select 1 from members where reg_no = p_reg_no) then
    raise exception 'This registration number is already on a team' using errcode = 'VI003';
  end if;

  if exists (select 1 from members where team_id = v_team_id and lower(name) = lower(trim(p_member_name))) then
    raise exception 'That name is already on this roster' using errcode = 'VI005';
  end if;

  -- TEAM_MAX is enforced by trg_enforce_team_size (race-safe row lock);
  -- this insert is the single write path, so the trigger always runs.
  insert into members (team_id, name, reg_no, email, phone, section, year, role)
  values (v_team_id, trim(p_member_name), p_reg_no, p_email, p_phone, p_section, p_year, 'member')
  returning id into v_member_id;

  return jsonb_build_object('team_id', v_team_id, 'member_id', v_member_id);
exception
  when sqlstate 'P0001' then
    raise exception 'Team is full' using errcode = 'VI002';
end;
$$;
