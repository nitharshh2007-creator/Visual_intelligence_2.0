-- ─────────────────────────────────────────────────────────────
-- Migration 0019: Fix registration bugs
-- ─────────────────────────────────────────────────────────────
-- 1. Backfill any teams still carrying status='ready' from before
--    migration 0018 changed TEAM_MIN=TEAM_MAX=4 (so there is no
--    intermediate 'ready' state — a team of 4 is 'full', anything
--    less is 'incomplete').
-- 2. Fix get_team_lobby to never raise on a null p_reg_no — the
--    frontend calls it without a reg_no for the captain resume flow
--    and the Realtime subscription refresh. The 0005 version already
--    does this correctly; this is a no-op re-apply for safety.
-- 3. Fix join_team to use normalize_team_code consistently (0014
--    reverted to upper(trim()) instead of normalize_team_code()).

-- ── 1. Backfill status ──
update teams
set status = case
  when (select count(*) from members where members.team_id = teams.id) >= 4 then 'full'
  else 'incomplete'
end
where status = 'ready';

-- ── 2. Re-apply get_team_lobby with normalize_team_code (from 0005) ──
-- 0014 did not update get_team_lobby, so it still uses the 0005 body.
-- This is a safety re-apply to ensure the normalize_team_code path is
-- active regardless of migration order.
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

  -- p_reg_no is optional: omit it (or pass null) for the public lobby
  -- preview (captain resume, Realtime refresh). Supply it to verify
  -- the caller is actually on this team (re-enter lobby flow).
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

-- ── 3. Re-apply join_team with normalize_team_code (0014 used upper/trim) ──
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

  if trim(coalesce(p_reg_no, '')) = '' or trim(coalesce(p_email, '')) = '' then
    raise exception 'Registration number and email are required' using errcode = 'VI001';
  end if;

  if not is_allowed_year(p_year) then
    raise exception 'Not eligible for this event' using errcode = 'VI006';
  end if;

  if not is_allowed_email(p_email) then
    raise exception 'Email domain is not eligible' using errcode = 'VI006';
  end if;

  -- Use normalize_team_code so "dum1234", "DUM 1234", "DUM-1234" all match.
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  if exists (select 1 from members where reg_no = p_reg_no) then
    raise exception 'This registration number is already on a team' using errcode = 'VI003';
  end if;

  if exists (select 1 from members where team_id = v_team_id and lower(name) = lower(trim(p_member_name))) then
    raise exception 'That name is already on this roster' using errcode = 'VI005';
  end if;

  -- TEAM_MAX enforced by trg_enforce_team_size (race-safe row lock).
  insert into members (team_id, name, reg_no, email, phone, section, year, role)
  values (v_team_id, trim(p_member_name), p_reg_no, p_email, p_phone, p_section, p_year, 'member')
  returning id into v_member_id;

  return jsonb_build_object('team_id', v_team_id, 'member_id', v_member_id);
exception
  when sqlstate 'P0001' then
    raise exception 'Team is full' using errcode = 'VI002';
end;
$$;
