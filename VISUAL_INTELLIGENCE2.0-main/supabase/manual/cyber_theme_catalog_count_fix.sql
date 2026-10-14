-- ==============================================================================
-- OPTIONAL — run after add_cyber_themes_39_40.sql. Apply manually in the SQL Editor.
--
-- Migration 0030 hard-codes "38" in two admin RPCs:
--   * admin_get_cyber_theme_allocations: total_catalogue_themes = 38 and
--     available_themes = 38 - assigned  -> admin page under-counts by 2.
--   * admin_allocate_all_cyber_themes: bulk allocation stops at 38 assignments
--     -> teams 39-40 are skipped by "Allocate all" (they still get a theme on
--     their own first lookup via assign_team_cyber_theme).
-- Both bodies below are identical to 0030 except "38" -> the live catalog size.
-- CREATE OR REPLACE keeps the existing owner and EXECUTE grants.
-- ==============================================================================

begin;

create or replace function public.admin_get_cyber_theme_allocations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_teams int;
  v_assigned_teams int;
  v_catalog_size int;
  v_stage1_status text;
  v_allocations jsonb;
  v_themes jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select count(*) into v_total_teams from teams;
  select count(*) into v_assigned_teams from cyber_theme_assignments;
  select count(*) into v_catalog_size from cyber_theme_catalog;
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
    'total_catalogue_themes', v_catalog_size,
    'available_themes', greatest(0, v_catalog_size - v_assigned_teams),
    'round1_status', coalesce(v_stage1_status, 'not_released'),
    'can_reassign', coalesce(v_stage1_status, 'not_released') not in ('live', 'ended'),
    'allocations', v_allocations,
    'themes', v_themes
  );
end;
$$;

create or replace function public.admin_allocate_all_cyber_themes(p_reassign boolean default false)
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
    -- Stop if every catalog theme is consumed
    if (select count(*) from cyber_theme_assignments) >= (select count(*) from cyber_theme_catalog) then
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

notify pgrst, 'reload schema';
commit;
