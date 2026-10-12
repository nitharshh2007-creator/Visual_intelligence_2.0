-- ─────────────────────────────────────────────────────────────
-- Migration 0005: Join-by-code lookup (Phase 3 spec, Section A)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0004 (not edited). Adds a minimal, no-PII team
-- lookup RPC so /register can offer a "type your code" flow instead
-- of only working via the shared invite link/QR. Also hardens the
-- existing join_team/get_team_lobby code matching to tolerate a
-- missing dash, lowercase input, and stray spaces — same signatures,
-- bodies only, so this is a safe `create or replace` with no
-- overload-ambiguity risk (see 0002's join_team comment for why that
-- matters here).
--
-- Also splits a new VI006 (NOT_ELIGIBLE) off VI001 for the
-- is_allowed_year/is_allowed_email checks in create_team/join_team.
-- Both predate this migration and previously raised VI001 — harmless
-- while the registration form never sent a real `year`, but this is
-- the first form that actually collects one (per the Phase 3 spec),
-- so "Not eligible" was about to surface client-side as the wrong
-- message ("No team found for that code").

-- Strips everything except letters/digits and uppercases, so
-- "dum 1234", "DUM1234" and "DUM-1234" all normalize identically.
create or replace function normalize_team_code(p_code text)
returns text
language sql
immutable
as $$ select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); $$;

-- Minimal public preview for the "Find team" step — deliberately
-- returns no reg_no/email/phone and no member names other than the
-- captain's first name (per spec). Used before a prospective joiner
-- has entered any of their own details.
create or replace function find_team_by_code(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team teams;
  v_captain_name text;
begin
  select * into v_team from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team.id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  select name into v_captain_name from members where id = v_team.captain_id;

  return jsonb_build_object(
    'name', v_team.name,
    'member_count', (select count(*) from members where team_id = v_team.id),
    'status', v_team.status,
    'captain_first_name', split_part(coalesce(v_captain_name, ''), ' ', 1)
  );
end;
$$;

grant execute on function find_team_by_code(text) to anon, authenticated;

-- join_team: same signature as 0002, body updated to use
-- normalize_team_code for the code lookup and to raise VI006 (not
-- VI001) for eligibility rejections.
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
  v_deadline timestamptz;
  v_member_id uuid;
begin
  select registration_deadline into v_deadline from event_state where id = 1;
  if now() > v_deadline then
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

-- get_team_lobby: same signature as 0002, body updated to use
-- normalize_team_code for the code lookup.
create or replace function get_team_lobby(p_code text, p_reg_no text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team teams;
  v_result jsonb;
begin
  select * into v_team from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team.id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  if p_reg_no is not null and not exists (
    select 1 from members where team_id = v_team.id and reg_no = p_reg_no
  ) then
    raise exception 'That registration number is not on this team' using errcode = 'VI001';
  end if;

  select jsonb_build_object(
    'id', v_team.id,
    'code', v_team.code,
    'name', v_team.name,
    'status', v_team.status,
    'created_at', v_team.created_at,
    'members', (
      select jsonb_agg(jsonb_build_object(
        'name', m.name,
        'role', m.role,
        'created_at', m.created_at
      ) order by m.created_at)
      from members m where m.team_id = v_team.id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- create_team: same signature as 0002, body updated only for the
-- VI001 -> VI006 split above (join_team is the one actually exercised
-- by the current UI; this keeps both consistent for when /register's
-- create flow collects year/email-domain-sensitive data too).
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
  v_deadline timestamptz;
  v_team_id uuid;
  v_captain_id uuid;
  v_code text;
begin
  select registration_deadline into v_deadline from event_state where id = 1;
  if now() > v_deadline then
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
