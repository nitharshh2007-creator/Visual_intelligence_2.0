-- ─────────────────────────────────────────────────────────────
-- Team Registration — schema, size trigger, and join RPC
-- ─────────────────────────────────────────────────────────────
-- Team size is fixed at 5 members (TEAM_SIZE in src/data/event.ts).
-- A team is allowed to compete with as few as MIN_TEAM_SIZE (4).
-- This migration is the real-backend counterpart of the mock
-- localStorage store in src/lib/registration.ts.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  is_captain boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (team_id, name)
);

-- ── Enforce TEAM_SIZE on insert ──
-- Rejects the insert outright if the team already has 5 members.
-- This is the source of truth; any client-side check (e.g. the
-- mock store's `joinTeam`) is only a UX nicety on top of this.
create or replace function enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  current_count int;
  team_size constant int := 5; -- keep in sync with TEAM_SIZE
begin
  select count(*) into current_count
  from team_members
  where team_id = new.team_id;

  if current_count >= team_size then
    raise exception 'Team is already full (% / % members)', current_count, team_size
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_team_size on team_members;
create trigger trg_enforce_team_size
  before insert on team_members
  for each row
  execute function enforce_team_size();

-- ── Status view ──
-- status is derived, never stored: 'incomplete' below MIN_TEAM_SIZE,
-- 'ready' from MIN_TEAM_SIZE (4) up to TEAM_SIZE (5) — the 5th slot
-- is optional. `is_full` flags once the TEAM_SIZE cap is hit.
create or replace view team_status as
select
  t.id,
  t.name,
  t.invite_code,
  count(tm.id)::int as member_count,
  case
    when count(tm.id) >= 4 then 'ready'
    else 'incomplete'
  end as status,
  count(tm.id) >= 4 as meets_minimum,
  count(tm.id) >= 5 as is_full
from teams t
left join team_members tm on tm.team_id = t.id
group by t.id, t.name, t.invite_code;

-- ── join_team RPC ──
-- Validates the invite code and delegates the size check to the
-- trigger above, so there is exactly one place the 5-member cap
-- is enforced (defense in depth: RPC validation + DB trigger).
create or replace function join_team(p_invite_code text, p_member_name text)
returns team_members
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_result team_members;
begin
  select id into v_team_id from teams where invite_code = upper(p_invite_code);

  if v_team_id is null then
    raise exception 'No team found for invite code %', p_invite_code
      using errcode = 'P0002';
  end if;

  insert into team_members (team_id, name, is_captain)
  values (v_team_id, trim(p_member_name), false)
  returning * into v_result;

  return v_result;
end;
$$;

-- Enable Realtime so the lobby screen updates live as members join.
alter publication supabase_realtime add table team_members;
