-- ─────────────────────────────────────────────────────────────
-- Phase 2: Admin Control Room — schema, RPCs, RLS
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001/0002 (not edited). Every admin write goes through a
-- SECURITY DEFINER RPC that calls is_admin() first; nothing here grants
-- anon/non-admin authenticated users any new table access.
--
-- Additional SQLSTATEs (see 0002's header for VI001-VI005):
--   VI010 = NOT_ADMIN            VI012 = TEAM_FULL (admin move/add)
--   VI011 = STAGE_LOCKED

-- ── 0. Phase 1 fix: require name/reg_no/email on every member ──
-- NOTE: this ALTER will fail if any existing member row has a null
-- reg_no/email (e.g. rows created before this migration, when the
-- registration form didn't collect them yet). We populate them with dummy values here to allow the migration.
update members set reg_no = 'TEMP-' || substr(md5(random()::text), 1, 6) where reg_no is null;
update members set email = 'temp-' || substr(md5(random()::text), 1, 6) || '@example.com' where email is null;

alter table members alter column name set not null;
alter table members alter column reg_no set not null;
alter table members alter column email set not null;

alter table members add constraint members_name_not_blank check (trim(name) <> '');
alter table members add constraint members_reg_no_not_blank check (trim(reg_no) <> '');
alter table members add constraint members_email_not_blank check (trim(email) <> '');

-- create_team/join_team (0002) now reject empty reg_no/email instead of
-- accepting null — same signatures (default null kept so existing
-- callers that don't pass them yet get a clear VI001, not a silent
-- constraint violation from the NOT NULL columns above).
create or replace function create_team(p_team_name text, p_captain_name text, p_reg_no text default null, p_email text default null, p_section text default null, p_year int default null)
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

  if trim(coalesce(p_team_name, '')) = '' or trim(coalesce(p_captain_name, '')) = '' then
    raise exception 'Team name and captain name are required' using errcode = 'VI001';
  end if;
  if trim(coalesce(p_reg_no, '')) = '' or trim(coalesce(p_email, '')) = '' then
    raise exception 'Registration number and email are required' using errcode = 'VI001';
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
  if exists (select 1 from members where reg_no = p_reg_no) then
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
  v_deadline timestamptz;
  v_member_id uuid;
begin
  select registration_deadline into v_deadline from event_state where id = 1;
  if now() > v_deadline then
    raise exception 'Registration is closed' using errcode = 'VI004';
  end if;

  if trim(coalesce(p_reg_no, '')) = '' or trim(coalesce(p_email, '')) = '' then
    raise exception 'Registration number and email are required' using errcode = 'VI001';
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

  if exists (select 1 from members where reg_no = p_reg_no) then
    raise exception 'This registration number is already on a team' using errcode = 'VI003';
  end if;

  if exists (select 1 from members where team_id = v_team_id and lower(name) = lower(trim(p_member_name))) then
    raise exception 'That name is already on this roster' using errcode = 'VI005';
  end if;

  insert into members (team_id, name, reg_no, email, phone, section, year, role)
  values (v_team_id, trim(p_member_name), p_reg_no, p_email, p_phone, p_section, p_year, 'member')
  returning id into v_member_id;

  return jsonb_build_object('team_id', v_team_id, 'member_id', v_member_id);
exception
  when sqlstate 'P0001' then
    raise exception 'Team is full' using errcode = 'VI002';
end;
$$;

-- ── 1. is_admin() ──
create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$ select exists (select 1 from admins where user_id = auth.uid()); $$;

grant execute on function is_admin() to authenticated;
revoke execute on function is_admin() from anon, public;

-- ── 2. Extend event_state ──
alter table event_state drop constraint if exists event_state_status_check;
alter table event_state add constraint event_state_status_check
  check (status in ('upcoming', 'live', 'paused', 'finished'));

alter table event_state
  add column if not exists paused_at timestamptz,
  add column if not exists remaining_ms bigint,
  add column if not exists announcement text,
  add column if not exists scores_locked_stage int[] not null default '{}';

-- ── 3. score_audit ──
create table if not exists score_audit (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage int not null check (stage between 1 and 4),
  old_points numeric,
  new_points numeric,
  note text,
  admin_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table score_audit enable row level security;
-- No policies: score_audit is readable only via admin_list_score_audit().

-- ── 4. Admin RPCs ──
-- Every one starts the same way: `if not is_admin() then raise ... VI010`.

create or replace function admin_set_stage(p_stage int, p_duration_seconds int)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;
  if p_duration_seconds <= 0 then raise exception 'Invalid duration' using errcode = 'VI001'; end if;

  update event_state set
    current_stage = p_stage,
    status = 'live',
    stage_started_at = now(),
    stage_ends_at = now() + (p_duration_seconds || ' seconds')::interval,
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1;

  insert into activity (type, team_id, message)
  values ('stage_complete', null, 'Stage ' || p_stage || ' is now live (' || p_duration_seconds || 's).');
end;
$$;

create or replace function admin_pause()
returns void
language plpgsql
security definer
as $$
declare
  v_ends_at timestamptz;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select stage_ends_at into v_ends_at from event_state where id = 1;

  update event_state set
    status = 'paused',
    paused_at = now(),
    remaining_ms = greatest(0, extract(epoch from (v_ends_at - now())) * 1000)::bigint,
    updated_at = now()
  where id = 1 and status = 'live';
end;
$$;

create or replace function admin_resume()
returns void
language plpgsql
security definer
as $$
declare
  v_remaining_ms bigint;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select remaining_ms into v_remaining_ms from event_state where id = 1;

  update event_state set
    status = 'live',
    stage_ends_at = now() + (coalesce(v_remaining_ms, 0) || ' milliseconds')::interval,
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1 and status = 'paused';
end;
$$;

create or replace function admin_extend(p_seconds int)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  update event_state set
    stage_ends_at = stage_ends_at + (p_seconds || ' seconds')::interval,
    updated_at = now()
  where id = 1 and status = 'live';

  update event_state set
    remaining_ms = greatest(0, remaining_ms + p_seconds * 1000),
    updated_at = now()
  where id = 1 and status = 'paused';
end;
$$;

create or replace function admin_end_stage()
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  update event_state set
    stage_ends_at = now(),
    paused_at = null,
    remaining_ms = null,
    updated_at = now()
  where id = 1;

  insert into activity (type, team_id, message)
  select 'stage_complete', null, 'Stage ' || current_stage || ' ended.'
  from event_state where id = 1;
end;
$$;

create or replace function admin_set_event_status(p_status text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_status not in ('upcoming', 'live', 'paused', 'finished') then
    raise exception 'Invalid status' using errcode = 'VI001';
  end if;

  update event_state set status = p_status, updated_at = now() where id = 1;
end;
$$;

create or replace function admin_set_announcement(p_text text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  update event_state set announcement = nullif(trim(p_text), ''), updated_at = now() where id = 1;
end;
$$;

create or replace function admin_set_score(
  p_team_id uuid,
  p_stage int,
  p_points numeric,
  p_note text default null,
  p_force boolean default false
)
returns void
language plpgsql
security definer
as $$
declare
  v_old_points numeric;
  v_locked_stages int[];
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;

  select scores_locked_stage into v_locked_stages from event_state where id = 1;
  if p_stage = any(v_locked_stages) and not p_force then
    raise exception 'Stage % is locked', p_stage using errcode = 'VI011';
  end if;

  perform 1 from teams where id = p_team_id for update;

  select points into v_old_points from scores where team_id = p_team_id and stage = p_stage;

  insert into scores (team_id, stage, points, detail, updated_at)
  values (p_team_id, p_stage, p_points, case when p_note is not null then jsonb_build_object('note', p_note) else null end, now())
  on conflict (team_id, stage) do update
    set points = excluded.points, detail = excluded.detail, updated_at = now();

  insert into score_audit (team_id, stage, old_points, new_points, note, admin_id)
  values (p_team_id, p_stage, v_old_points, p_points, p_note, auth.uid());
end;
$$;

create or replace function admin_undo_last_score(p_team_id uuid, p_stage int)
returns void
language plpgsql
security definer
as $$
declare
  v_last score_audit;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select * into v_last from score_audit
  where team_id = p_team_id and stage = p_stage
  order by created_at desc
  limit 1;

  if v_last.id is null then
    raise exception 'No audit history for this cell' using errcode = 'VI001';
  end if;

  update scores set points = coalesce(v_last.old_points, 0), updated_at = now()
  where team_id = p_team_id and stage = p_stage;

  insert into score_audit (team_id, stage, old_points, new_points, note, admin_id)
  values (p_team_id, p_stage, v_last.new_points, coalesce(v_last.old_points, 0), 'undo', auth.uid());
end;
$$;

create or replace function admin_lock_stage(p_stage int, p_locked boolean)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  if p_locked then
    update event_state set
      scores_locked_stage = array(select distinct unnest(scores_locked_stage || p_stage)),
      updated_at = now()
    where id = 1;
  else
    update event_state set
      scores_locked_stage = array_remove(scores_locked_stage, p_stage),
      updated_at = now()
    where id = 1;
  end if;
end;
$$;

-- Full roster incl. email/phone — admin-only, via RPC (never via a
-- directly-grantable view/table, since that data must never reach anon).
create or replace function admin_get_teams()
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'code', t.code,
      'name', t.name,
      'status', t.status,
      'captain_id', t.captain_id,
      'created_at', t.created_at,
      'member_count', (select count(*) from members m where m.team_id = t.id),
      's1', coalesce((select points from scores s where s.team_id = t.id and s.stage = 1), 0),
      's2', coalesce((select points from scores s where s.team_id = t.id and s.stage = 2), 0),
      's3', coalesce((select points from scores s where s.team_id = t.id and s.stage = 3), 0),
      's4', coalesce((select points from scores s where s.team_id = t.id and s.stage = 4), 0),
      'score_updated_at', (
        select jsonb_object_agg(s.stage, s.updated_at) from scores s where s.team_id = t.id
      ),
      'members', (
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'reg_no', m.reg_no,
          'email', m.email,
          'phone', m.phone,
          'section', m.section,
          'year', m.year,
          'role', m.role,
          'created_at', m.created_at
        ) order by m.created_at)
        from members m where m.team_id = t.id
      )
    ) order by t.name)
    from teams t
  );
end;
$$;

create or replace function admin_add_member(
  p_team_id uuid,
  p_name text,
  p_reg_no text,
  p_email text,
  p_phone text default null,
  p_section text default null,
  p_year int default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_reg_no, '')) = '' or trim(coalesce(p_email, '')) = '' then
    raise exception 'Name, reg_no and email are required' using errcode = 'VI001';
  end if;
  if exists (select 1 from members where reg_no = p_reg_no) then
    raise exception 'That registration number is already on a team' using errcode = 'VI003';
  end if;

  -- TEAM_MAX is enforced by trg_enforce_team_size (the same race-safe
  -- row-locked trigger join_team uses — this insert goes through it too).
  insert into members (team_id, name, reg_no, email, phone, section, year, role)
  values (p_team_id, trim(p_name), p_reg_no, p_email, p_phone, p_section, p_year, 'member')
  returning id into v_member_id;

  return v_member_id;
exception
  when sqlstate 'P0001' then
    raise exception 'Team is full' using errcode = 'VI012';
end;
$$;

create or replace function admin_remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  update teams set captain_id = null where captain_id = p_member_id;
  delete from members where id = p_member_id;
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
  team_max constant int := 5; -- keep in sync with TEAM_MAX
  team_min constant int := 4; -- keep in sync with TEAM_MIN
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select team_id into v_from_team_id from members where id = p_member_id;
  if v_from_team_id is null then
    raise exception 'Member not found' using errcode = 'VI001';
  end if;
  if v_from_team_id = p_to_team_id then
    return;
  end if;

  -- Lock the destination team row so two concurrent moves/joins can't
  -- both see room for a 5th member and both proceed.
  perform 1 from teams where id = p_to_team_id for update;
  select count(*) into v_dest_count from members where team_id = p_to_team_id;
  if v_dest_count >= team_max then
    raise exception 'Destination team is full' using errcode = 'VI012';
  end if;

  update members set team_id = p_to_team_id where id = p_member_id;
  -- The member-count triggers only fire on insert/delete, not on this
  -- update, so recompute both teams' status by hand.
  update teams set status = case
    when (select count(*) from members where team_id = teams.id) >= team_max then 'full'
    when (select count(*) from members where team_id = teams.id) >= team_min then 'ready'
    else 'incomplete'
  end where id in (v_from_team_id, p_to_team_id);

  update teams set captain_id = null where id = v_from_team_id and captain_id = p_member_id;
end;
$$;

create or replace function admin_rename_team(p_team_id uuid, p_new_name text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if trim(coalesce(p_new_name, '')) = '' then
    raise exception 'Team name is required' using errcode = 'VI001';
  end if;
  if exists (select 1 from teams where name = trim(p_new_name) and id <> p_team_id) then
    raise exception 'Team name already taken' using errcode = 'VI005';
  end if;

  update teams set name = trim(p_new_name) where id = p_team_id;
end;
$$;

create or replace function admin_delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  delete from teams where id = p_team_id; -- cascades to members/scores/activity
end;
$$;

create or replace function admin_set_registration_deadline(p_ts timestamptz)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  update event_state set registration_deadline = p_ts, updated_at = now() where id = 1;
end;
$$;

-- Admin-only read of the audit log (score_audit has no public policies).
create or replace function admin_list_score_audit(p_team_id uuid default null, p_stage int default null, p_limit int default 100)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  -- LIMIT/ORDER BY must apply to the raw rows before aggregation —
  -- putting them on the same query as jsonb_agg() tries to order/limit
  -- an already-collapsed single aggregate row, which Postgres rejects.
  return (
    select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    from (
      select sa.id, sa.team_id, t.name as team_name, sa.stage, sa.old_points,
             sa.new_points, sa.note, sa.admin_id, sa.created_at
      from score_audit sa
      join teams t on t.id = sa.team_id
      where (p_team_id is null or sa.team_id = p_team_id)
        and (p_stage is null or sa.stage = p_stage)
      order by sa.created_at desc
      limit p_limit
    ) x
  );
end;
$$;

-- ── 5. Lock down grants ──
-- New functions default to EXECUTE granted to PUBLIC in Postgres —
-- revoke that explicitly for every admin_* function (and is_admin,
-- handled above) so anon truly has zero path to them. is_admin() still
-- gates the logic even for authenticated non-admins; this is defense
-- in depth so the attempt doesn't even reach the function for anon.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin_%'
  loop
    execute format('revoke all on function %s from public, anon;', fn.sig);
    execute format('grant execute on function %s to authenticated;', fn.sig);
  end loop;
end $$;

-- ── 6. Realtime ──
-- scores/event_state/activity/teams are already in supabase_realtime
-- (from 0002); score_audit intentionally is NOT added — admins read it
-- only via admin_list_score_audit(), never a live subscription on the
-- raw table (keeps the "RPC-only" boundary consistent).
