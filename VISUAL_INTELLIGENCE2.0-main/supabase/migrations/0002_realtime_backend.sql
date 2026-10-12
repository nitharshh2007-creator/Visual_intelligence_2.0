-- ─────────────────────────────────────────────────────────────
-- Phase 1 real backend: registration, leaderboard, event state
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001_team_registration.sql (not edited). Renames/extends
-- its tables to the richer Phase 1 schema, adds scores/event_state/
-- activity/admins, RLS, SECURITY DEFINER RPCs, and Realtime.
--
-- TEAM_MIN / TEAM_MAX below MUST stay in sync with src/data/event.ts.
-- They're inlined as constants in each function (no app_config table
-- yet — see the "config" comment near is_allowed_year below).
--
-- RPC error codes: `errcode` must be a 5-char SQLSTATE, so the human
-- -readable error codes from the spec map to custom SQLSTATEs. Client
-- code (src/lib/registration.ts) maps these back:
--   VI001 = INVALID_CODE          VI004 = REGISTRATION_CLOSED
--   VI002 = TEAM_FULL             VI005 = NAME_TAKEN
--   VI003 = ALREADY_REGISTERED    P0001 = TEAM_FULL (from the trigger)

-- ── 1. Extend `teams` (was: id, name, invite_code, created_at) ──
alter table teams rename column invite_code to code;

alter table teams
  add column if not exists captain_id uuid,
  add column if not exists status text not null default 'incomplete'
    check (status in ('incomplete', 'ready', 'full'));

-- `name` must be globally unique per the spec (was previously unique
-- only implicitly via no constraint at all).
alter table teams add constraint teams_name_unique unique (name);

-- ── 2. Rename + extend `team_members` → `members` ──
alter table team_members rename to members;

alter table members
  add column if not exists reg_no text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists section text,
  add column if not exists year int,
  add column if not exists role text;

update members set role = case when is_captain then 'captain' else 'member' end
  where role is null;

alter table members
  alter column role set not null,
  add constraint members_role_check check (role in ('captain', 'member'));

alter table members drop column if exists is_captain;
alter table members rename column joined_at to created_at;

-- reg_no/email are unique when present, but Postgres allows multiple
-- NULLs through a unique index — so teams can still be created today
-- (current UI only collects name) without every member having a
-- reg_no/email yet. Tighten this to NOT NULL once the richer
-- registration form collects these fields.
create unique index if not exists members_reg_no_unique on members (reg_no) where reg_no is not null;
create unique index if not exists members_email_unique on members (email) where email is not null;

alter table teams add constraint teams_captain_fk foreign key (captain_id) references members(id);

-- ── 3. New tables ──
create table if not exists event_state (
  id int primary key default 1 check (id = 1), -- singleton row
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'finished')),
  current_stage int not null default 0 check (current_stage between 0 and 4),
  stage_started_at timestamptz,
  stage_ends_at timestamptz,
  registration_deadline timestamptz not null,
  updated_at timestamptz not null default now()
);
insert into event_state (id, registration_deadline)
  values (1, '2026-10-14T08:30:00+05:30')
  on conflict (id) do nothing;

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage int not null check (stage between 1 and 4),
  points numeric not null default 0,
  detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, stage)
);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('score', 'rank_change', 'stage_complete', 'join')),
  team_id uuid references teams(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists admins (
  user_id uuid primary key references auth.users(id)
  -- Phase 2: admin dashboard authorization. Unused in Phase 1.
);

-- ── 4. TEAM_MAX trigger — race-safe via row lock ──
drop trigger if exists trg_enforce_team_size on members;
drop function if exists enforce_team_size();

create or replace function enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  current_count int;
  team_max constant int := 5; -- keep in sync with TEAM_MAX in src/data/event.ts
begin
  -- Lock the team row so two simultaneous 5th-member joins can't both
  -- read "4 members" and both insert. The second transaction blocks
  -- here until the first commits, then re-reads the now-current count.
  perform 1 from teams where id = new.team_id for update;

  select count(*) into current_count from members where team_id = new.team_id;

  if current_count >= team_max then
    raise exception 'Team is already full (% / % members)', current_count, team_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_team_size
  before insert on members
  for each row
  execute function enforce_team_size();

-- ── 5. Keep teams.status in sync with member_count ──
create or replace function sync_team_status()
returns trigger
language plpgsql
as $$
declare
  v_team_id uuid := coalesce(new.team_id, old.team_id);
  current_count int;
  team_min constant int := 4; -- keep in sync with TEAM_MIN
  team_max constant int := 5; -- keep in sync with TEAM_MAX
  new_status text;
  old_status text;
begin
  select count(*) into current_count from members where team_id = v_team_id;

  new_status := case
    when current_count >= team_max then 'full'
    when current_count >= team_min then 'ready'
    else 'incomplete'
  end;

  select status into old_status from teams where id = v_team_id;

  update teams set status = new_status where id = v_team_id;

  -- Fire a "team ready" activity row exactly once, on the transition.
  if old_status is distinct from new_status and new_status in ('ready', 'full') then
    insert into activity (type, team_id, message)
    select 'join', v_team_id, (select name from teams where id = v_team_id) || ' is ' || new_status || ' to compete!'
    where old_status is distinct from 'ready' and old_status is distinct from 'full';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_team_status_insert on members;
create trigger trg_sync_team_status_insert
  after insert on members
  for each row
  execute function sync_team_status();

drop trigger if exists trg_sync_team_status_delete on members;
create trigger trg_sync_team_status_delete
  after delete on members
  for each row
  execute function sync_team_status();

-- ── 6. Activity on score insert/update ──
create or replace function log_score_activity()
returns trigger
language plpgsql
as $$
declare
  v_team_name text;
begin
  select name into v_team_name from teams where id = new.team_id;

  insert into activity (type, team_id, message)
  values (
    'score',
    new.team_id,
    v_team_name || ' scored ' || new.points || ' pts in Stage ' || new.stage
  );

  return new;
end;
$$;

drop trigger if exists trg_log_score_activity on scores;
create trigger trg_log_score_activity
  after insert or update of points on scores
  for each row
  execute function log_score_activity();

-- ── 7. Activity on stage change ──
create or replace function log_stage_activity()
returns trigger
language plpgsql
as $$
begin
  if new.current_stage is distinct from old.current_stage then
    insert into activity (type, team_id, message)
    values ('stage_complete', null, 'Stage ' || new.current_stage || ' is now ' || new.status || '.');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_log_stage_activity on event_state;
create trigger trg_log_stage_activity
  before update on event_state
  for each row
  execute function log_stage_activity();

-- ── 8. leaderboard_view ──
-- Owned by the migration role (postgres), which has BYPASSRLS in
-- Supabase, so the view can safely read the RLS-locked `members`
-- table while only ever exposing initials — never phone/email. Only
-- 'ready' or 'full' teams are listed (a team with 1-3 members hasn't
-- registered enough to compete yet).
create or replace view leaderboard_view as
select
  t.id as team_id,
  t.name,
  (
    select array_agg(upper(left(m.name, 1)) order by m.created_at)
    from (select * from members m2 where m2.team_id = t.id order by m2.created_at limit 3) m
  ) as member_initials,
  (select count(*) from members m3 where m3.team_id = t.id)::int as member_count,
  coalesce((select points from scores s where s.team_id = t.id and s.stage = 1), 0) as s1,
  coalesce((select points from scores s where s.team_id = t.id and s.stage = 2), 0) as s2,
  coalesce((select points from scores s where s.team_id = t.id and s.stage = 3), 0) as s3,
  coalesce((select points from scores s where s.team_id = t.id and s.stage = 4), 0) as s4,
  coalesce((select sum(points) from scores s where s.team_id = t.id), 0) as total,
  dense_rank() over (
    order by
      coalesce((select sum(points) from scores s where s.team_id = t.id), 0) desc,
      coalesce((
        select points from scores s
        where s.team_id = t.id
        order by s.stage desc
        limit 1
      ), 0) desc,
      t.created_at asc
  ) as rank,
  greatest(
    t.created_at,
    coalesce((select max(updated_at) from scores s where s.team_id = t.id), t.created_at)
  ) as updated_at
from teams t
where t.status in ('ready', 'full');

-- ── 9. RPCs (the only public write path) ──
-- All SECURITY DEFINER so anon can call them despite RLS locking the
-- base tables directly. Each returns either the row/jsonb payload or
-- raises with one of: INVALID_CODE, TEAM_FULL, ALREADY_REGISTERED,
-- REGISTRATION_CLOSED, NAME_TAKEN.

create or replace function server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

-- Generates a DUM-XXXX code using unambiguous characters (no 0/O/1/I).
create or replace function generate_team_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
begin
  loop
    result := 'DUM-';
    for i in 1..4 loop
      result := result || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from teams where code = result);
  end loop;
  return result;
end;
$$;

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
    raise exception 'Not eligible for this event' using errcode = 'VI001';
  end if;

  if not is_allowed_email(p_email) then
    raise exception 'Email domain is not eligible' using errcode = 'VI001';
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

-- 0001 defined join_team(text, text) on the old invite_code/team_members
-- shape. `create or replace` can't change a function's argument list, so
-- it would otherwise sit alongside the new signature as an ambiguous
-- overload (both are callable as join_team(text, text) once the new
-- function's extra params default to null).
drop function if exists join_team(text, text);

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
    raise exception 'Not eligible for this event' using errcode = 'VI001';
  end if;

  if not is_allowed_email(p_email) then
    raise exception 'Email domain is not eligible' using errcode = 'VI001';
  end if;

  select id into v_team_id from teams where code = upper(trim(p_code));
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

-- Returns the team + member NAMES (no phone/email) for the lobby
-- screen. If p_reg_no is supplied, it must match a member of this
-- team — used for the "re-enter lobby" flow. If omitted, still
-- returns the public roster preview (names/initials only, same data
-- a prospective joiner already sees on /register/[code]).
create or replace function get_team_lobby(p_code text, p_reg_no text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team teams;
  v_result jsonb;
begin
  select * into v_team from teams where code = upper(trim(p_code));
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

-- Captain-only, and only before the team reaches 'ready' — once a team
-- is competing, the roster is locked to avoid mid-event disputes.
create or replace function remove_member(p_code text, p_captain_reg_no text, p_member_name text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team teams;
begin
  select * into v_team from teams where code = upper(trim(p_code));
  if v_team.id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  if v_team.status <> 'incomplete' then
    raise exception 'Roster is locked once the team is ready' using errcode = 'VI002';
  end if;

  if not exists (
    select 1 from members where id = v_team.captain_id and reg_no = p_captain_reg_no
  ) then
    raise exception 'Only the captain can remove a member' using errcode = 'VI001';
  end if;

  delete from members
  where team_id = v_team.id
    and lower(name) = lower(trim(p_member_name))
    and id <> v_team.captain_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function rename_team(p_code text, p_captain_reg_no text, p_new_name text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team teams;
begin
  select * into v_team from teams where code = upper(trim(p_code));
  if v_team.id is null then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  if not exists (
    select 1 from members where id = v_team.captain_id and reg_no = p_captain_reg_no
  ) then
    raise exception 'Only the captain can rename the team' using errcode = 'VI001';
  end if;

  if exists (select 1 from teams where name = trim(p_new_name) and id <> v_team.id) then
    raise exception 'Team name already taken' using errcode = 'VI005';
  end if;

  update teams set name = trim(p_new_name) where id = v_team.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Config note: "year and email-domain rules" — there's no app_config
-- table yet (not needed until the richer registration form ships).
-- is_allowed_year below is the single place to tighten eligibility
-- (e.g. `year = 1` for "first-year students only", per eventDetails
-- .eligibility in src/data/event.ts) once the form collects `year`.
create or replace function is_allowed_year(p_year int)
returns boolean
language sql
immutable
as $$ select p_year is null or p_year = 1; $$;

-- No institutional email domain restriction is defined yet (event.ts
-- doesn't specify one). Always permissive until a domain is set here,
-- e.g. `select p_email is null or p_email ilike '%@college.edu';`.
create or replace function is_allowed_email(p_email text)
returns boolean
language sql
immutable
as $$ select true; $$;

-- ── 10. Row Level Security ──
alter table teams enable row level security;
alter table members enable row level security;
alter table event_state enable row level security;
alter table scores enable row level security;
alter table activity enable row level security;
alter table admins enable row level security;

-- No policies are created for anon/authenticated on teams, members,
-- scores, or admins — default-deny means direct table access is
-- impossible for those roles. All reads of team/member data go
-- through get_team_lobby (SECURITY DEFINER, name-only) or
-- leaderboard_view (owned by postgres, which bypasses RLS).
drop policy if exists anon_read_event_state on event_state;
create policy anon_read_event_state on event_state for select to anon, authenticated using (true);

drop policy if exists anon_read_activity on activity;
create policy anon_read_activity on activity for select to anon, authenticated using (true);

grant select on leaderboard_view to anon, authenticated;
grant select on event_state to anon, authenticated;
grant select on activity to anon, authenticated;

grant execute on function create_team(text, text, text, text, text, int) to anon, authenticated;
grant execute on function join_team(text, text, text, text, text, text, int) to anon, authenticated;
grant execute on function get_team_lobby(text, text) to anon, authenticated;
grant execute on function remove_member(text, text, text) to anon, authenticated;
grant execute on function rename_team(text, text, text) to anon, authenticated;
grant execute on function server_now() to anon, authenticated;

-- Explicitly confirm no insert/update/delete grants exist on base
-- tables for anon — this is also the default, but stated for clarity.
revoke insert, update, delete on teams, members, scores, activity, event_state from anon, authenticated;

-- ── 11. Realtime ──
-- team_members was already added to supabase_realtime in 0001; it
-- carries over automatically under its new name `members`.
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table event_state;
alter publication supabase_realtime add table activity;
