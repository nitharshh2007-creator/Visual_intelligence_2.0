import { CYBER_THEMES } from '../src/data/cyberThemes.ts';
import fs from 'fs';

const sqlHeader = `-- ==============================================================================
-- VISUAL INTELLIGENCE 2.0: ROUND 1 CYBER THEMES SQL MIGRATION
-- Apply this in your Supabase Dashboard -> SQL Editor
-- Contains the exact 38 catalog themes, table schema, unique constraints, and RPCs.
-- ==============================================================================

begin;

-- 1. Theme Catalog Table
create table if not exists public.cyber_theme_catalog (
  theme_id text primary key,
  title text not null unique,
  description_line1 text not null,
  description_line2 text not null,
  instructions text not null,
  palette jsonb not null check (jsonb_typeof(palette) = 'array' and jsonb_array_length(palette) between 3 and 4),
  visual_style text not null unique,
  sort_order smallint not null unique check (sort_order between 1 and 38)
);

-- Seed the official 38 themes
insert into public.cyber_theme_catalog (theme_id, title, description_line1, description_line2, instructions, palette, visual_style, sort_order) values
`;

const rows = CYBER_THEMES.map((t, idx) => {
  const esc = (s) => s.replace(/'/g, "''");
  const pal = JSON.stringify(t.palette).replace(/'/g, "''");
  const comma = idx === CYBER_THEMES.length - 1 ? "" : ",";
  return `  ('${esc(t.theme_id)}', '${esc(t.title)}', '${esc(t.description_line1)}', '${esc(t.description_line2)}', '${esc(t.instructions)}', '${pal}'::jsonb, '${esc(t.visual_style)}', ${t.sort_order})${comma}`;
}).join('\n');

const sqlMiddle = `
on conflict (theme_id) do update set
  title = excluded.title,
  description_line1 = excluded.description_line1,
  description_line2 = excluded.description_line2,
  instructions = excluded.instructions,
  palette = excluded.palette,
  visual_style = excluded.visual_style,
  sort_order = excluded.sort_order;

-- 2. Team Theme Assignments Table (Strictly 1:1, unique per team and unique per theme)
create table if not exists public.cyber_theme_assignments (
  team_id uuid primary key references public.teams(id) on delete cascade,
  theme_id text not null unique references public.cyber_theme_catalog(theme_id) on delete restrict,
  assigned_at timestamptz not null default now()
);

-- Row Level Security
alter table public.cyber_theme_catalog enable row level security;
alter table public.cyber_theme_assignments enable row level security;

-- Catalog is publicly readable
drop policy if exists "Allow read cyber_theme_catalog" on public.cyber_theme_catalog;
create policy "Allow read cyber_theme_catalog"
  on public.cyber_theme_catalog for select
  using (true);

-- Team assignments are protected: only admin or service role
drop policy if exists "Admin read cyber_theme_assignments" on public.cyber_theme_assignments;
create policy "Admin read cyber_theme_assignments"
  on public.cyber_theme_assignments for select
  using (is_admin());

drop policy if exists "Admin manage cyber_theme_assignments" on public.cyber_theme_assignments;
create policy "Admin manage cyber_theme_assignments"
  on public.cyber_theme_assignments for all
  using (is_admin());

-- 3. Atomic Single Team Theme Allocator (Zero repetition, concurrency safe via advisory lock)
create or replace function assign_team_cyber_theme(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_theme_id text;
  v_theme cyber_theme_catalog;
  v_chosen_theme_id text;
begin
  if not exists (select 1 from teams where id = p_team_id) then
    raise exception 'Team not found' using errcode = 'VI001';
  end if;

  -- 1. Check if team already has an assignment
  select theme_id into v_existing_theme_id
  from cyber_theme_assignments
  where team_id = p_team_id;

  if v_existing_theme_id is not null then
    select * into v_theme from cyber_theme_catalog where theme_id = v_existing_theme_id;
    return jsonb_build_object(
      'theme_id', v_theme.theme_id,
      'title', v_theme.title,
      'description_line1', v_theme.description_line1,
      'description_line2', v_theme.description_line2,
      'instructions', v_theme.instructions,
      'palette', v_theme.palette,
      'visual_style', v_theme.visual_style
    );
  end if;

  -- 2. Concurrency lock to prevent race conditions across parallel requests
  perform pg_advisory_xact_lock(hashtext('cyber_theme_allocation')::bigint);

  -- Recheck after acquiring transaction lock
  select theme_id into v_existing_theme_id
  from cyber_theme_assignments
  where team_id = p_team_id;

  if v_existing_theme_id is not null then
    select * into v_theme from cyber_theme_catalog where theme_id = v_existing_theme_id;
    return jsonb_build_object(
      'theme_id', v_theme.theme_id,
      'title', v_theme.title,
      'description_line1', v_theme.description_line1,
      'description_line2', v_theme.description_line2,
      'instructions', v_theme.instructions,
      'palette', v_theme.palette,
      'visual_style', v_theme.visual_style
    );
  end if;

  -- 3. Select an unused theme randomly (Zero repetition)
  select theme_id into v_chosen_theme_id
  from cyber_theme_catalog
  where theme_id not in (select theme_id from cyber_theme_assignments)
  order by gen_random_uuid()
  limit 1;

  if v_chosen_theme_id is null then
    raise exception 'All 38 themes have already been allocated' using errcode = 'VI001';
  end if;

  -- 4. Store assignment persistently
  insert into cyber_theme_assignments (team_id, theme_id, assigned_at)
  values (p_team_id, v_chosen_theme_id, now())
  on conflict (team_id) do nothing;

  select * into v_theme from cyber_theme_catalog where theme_id = v_chosen_theme_id;
  return jsonb_build_object(
    'theme_id', v_theme.theme_id,
    'title', v_theme.title,
    'description_line1', v_theme.description_line1,
    'description_line2', v_theme.description_line2,
    'instructions', v_theme.instructions,
    'palette', v_theme.palette,
    'visual_style', v_theme.visual_style
  );
end;
$$;

-- 4. Participant RPC: Authenticated team theme lookup
create or replace function get_my_team_cyber_theme(p_code text, p_reg_no text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
  v_team_name text;
  v_theme jsonb;
begin
  select t.id, t.name into v_team_id, v_team_name
  from teams t
  where normalize_team_code(t.code) = normalize_team_code(p_code);

  if v_team_id is null then
    raise exception 'Invalid team code' using errcode = 'VI001';
  end if;

  if not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    raise exception 'Member not found in team' using errcode = 'VI001';
  end if;

  v_theme := assign_team_cyber_theme(v_team_id);

  return jsonb_build_object(
    'team_id', v_team_id,
    'team_name', v_team_name,
    'theme', v_theme
  );
end;
$$;

-- 5. Admin RPC: Get all team assignments and remaining count
create or replace function admin_get_cyber_theme_allocations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_teams int;
  v_assigned_teams int;
  v_stage1_status text;
  v_allocations jsonb;
  v_themes jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select count(*) into v_total_teams from teams;
  select count(*) into v_assigned_teams from cyber_theme_assignments;
  select status into v_stage1_status from stage_progress where stage = 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'team_id', t.id,
      'team_name', t.name,
      'team_code', t.code,
      'team_status', t.status,
      'theme_id', c.theme_id,
      'theme_title', c.title,
      'description_line1', c.description_line1,
      'description_line2', c.description_line2,
      'visual_style', c.visual_style,
      'palette', c.palette,
      'assigned_at', a.assigned_at
    ) order by t.name
  ), '[]'::jsonb) into v_allocations
  from teams t
  left join cyber_theme_assignments a on a.team_id = t.id
  left join cyber_theme_catalog c on c.theme_id = a.theme_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'theme_id', theme_id,
      'title', title,
      'description_line1', description_line1,
      'description_line2', description_line2,
      'instructions', instructions,
      'palette', palette,
      'visual_style', visual_style,
      'sort_order', sort_order
    ) order by sort_order
  ), '[]'::jsonb) into v_themes
  from cyber_theme_catalog;

  return jsonb_build_object(
    'total_teams', v_total_teams,
    'assigned_teams', v_assigned_teams,
    'unassigned_teams', greatest(0, v_total_teams - v_assigned_teams),
    'total_catalogue_themes', 38,
    'available_themes', greatest(0, 38 - v_assigned_teams),
    'round1_status', coalesce(v_stage1_status, 'not_released'),
    'can_reassign', coalesce(v_stage1_status, 'not_released') not in ('live', 'ended'),
    'allocations', v_allocations,
    'themes', v_themes
  );
end;
$$;

-- 6. Admin RPC: Bulk allocate unassigned teams (Zero repetition)
create or replace function admin_allocate_all_cyber_themes(p_reassign boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage1_status text;
  v_team record;
  v_assigned_count int := 0;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select status into v_stage1_status from stage_progress where stage = 1;

  if p_reassign and v_stage1_status in ('live', 'ended') then
    raise exception 'Cannot reassign themes after Round 1 has started or ended' using errcode = 'VI001';
  end if;

  perform pg_advisory_xact_lock(hashtext('cyber_theme_allocation')::bigint);

  if p_reassign then
    delete from cyber_theme_assignments;
  end if;

  for v_team in
    select id from teams
    where id not in (select team_id from cyber_theme_assignments)
    order by random()
  loop
    -- Stop if all 38 themes are consumed
    if (select count(*) from cyber_theme_assignments) >= 38 then
      exit;
    end if;

    perform assign_team_cyber_theme(v_team.id);
    v_assigned_count := v_assigned_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'allocated_count', v_assigned_count,
    'reassigned', p_reassign
  );
end;
$$;

grant execute on function get_my_team_cyber_theme(text, text) to anon, authenticated;
grant execute on function assign_team_cyber_theme(uuid) to anon, authenticated;
grant execute on function admin_get_cyber_theme_allocations() to authenticated;
grant execute on function admin_allocate_all_cyber_themes(boolean) to authenticated;

commit;
`;

const completeSql = sqlHeader + rows + sqlMiddle;
fs.writeFileSync('supabase/manual/apply_0030_cyber_themes.sql', completeSql);
fs.writeFileSync('supabase/migrations/0030_cyber_theme_random_allocation.sql', completeSql);
console.log('Successfully wrote apply_0030_cyber_themes.sql and 0030_cyber_theme_random_allocation.sql');
