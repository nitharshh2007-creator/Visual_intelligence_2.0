  -- Enforce shortlist rules for every admin scoring and assignment RPC.
  -- Apply after 0020_shortlisting.sql.

  create or replace function admin_get_preliminary_scores()
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_cfg shortlist_config;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    select * into v_cfg from shortlist_config where id = 1;

    return (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'team_id', t.id,
          'team_name', t.name,
          'team_code', t.code,
          'member_count', (select count(*) from members m where m.team_id = t.id),
          's1', (select points from scores s where s.team_id = t.id and s.stage = 1),
          's2', (select points from scores s where s.team_id = t.id and s.stage = 2),
          's1_updated_at', (select updated_at from scores s where s.team_id = t.id and s.stage = 1),
          's2_updated_at', (select updated_at from scores s where s.team_id = t.id and s.stage = 2),
          'combined', (
            select case when s1pts is not null and s2pts is not null then s1pts + s2pts else null end
            from (select points as s1pts from scores where team_id = t.id and stage = 1) sq1
            full outer join (select points as s2pts from scores where team_id = t.id and stage = 2) sq2 on true
          ),
          'cutoff', v_cfg.combined_cutoff,
          'stage1_min', v_cfg.stage1_min,
          'stage2_min', v_cfg.stage2_min,
          'decision', sl.decision,
          'is_override', sl.is_override,
          'decided_at', sl.decided_at,
          'decided_by', sl.decided_by,
          'created_at', t.created_at
        ) order by t.name
      ), '[]'::jsonb)
      from teams t
      left join shortlist sl on sl.team_id = t.id
    );
  end;
  $$;

  revoke all on function admin_get_preliminary_scores() from public, anon;
  grant execute on function admin_get_preliminary_scores() to authenticated;

  create or replace function admin_set_shortlist_decision(
    p_team_id uuid,
    p_decision text,
    p_note text default null,
    p_force_override boolean default false
  )
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_cfg shortlist_config;
    v_s1 numeric;
    v_s2 numeric;
    v_combined numeric;
    v_is_override boolean := false;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    if p_decision not in ('shortlisted', 'rejected', 'on_hold') then
      raise exception 'Invalid decision' using errcode = 'VI001';
    end if;
    perform 1 from teams where id = p_team_id for update;
    if not found then raise exception 'Team not found' using errcode = 'VI001'; end if;

    select * into v_cfg from shortlist_config where id = 1 for share;
    select points into v_s1 from scores where team_id = p_team_id and stage = 1;
    select points into v_s2 from scores where team_id = p_team_id and stage = 2;

    if v_s1 is not null and v_s2 is not null then
      v_combined := v_s1 + v_s2;
    end if;

    if p_decision = 'shortlisted' then
      if v_combined is null then
        raise exception 'Both Stage 1 and Stage 2 scores are required before shortlisting.' using errcode = 'VI001';
      end if;
      if v_combined < v_cfg.combined_cutoff
        or v_s1 < v_cfg.stage1_min
        or v_s2 < v_cfg.stage2_min
      then
        if not p_force_override then
          raise exception 'Team is below cutoff. Pass force_override=true to shortlist anyway.' using errcode = 'VI030';
        end if;
        v_is_override := true;
      end if;
    end if;

    insert into shortlist (team_id, decision, is_override, note, decided_at, decided_by)
    values (p_team_id, p_decision, v_is_override, p_note, now(), auth.uid())
    on conflict (team_id) do update set
      decision = excluded.decision,
      is_override = excluded.is_override,
      note = excluded.note,
      decided_at = excluded.decided_at,
      decided_by = excluded.decided_by;

    insert into admin_audit_log (action, detail, admin_id)
    values ('set_shortlist_decision', jsonb_build_object(
      'team_id', p_team_id,
      'decision', p_decision,
      'is_override', v_is_override,
      'note', p_note,
      's1', v_s1,
      's2', v_s2,
      'combined', v_combined
    ), auth.uid());

    return jsonb_build_object('ok', true, 'is_override', v_is_override);
  end;
  $$;

  revoke all on function admin_set_shortlist_decision(uuid, text, text, boolean) from public, anon;
  grant execute on function admin_set_shortlist_decision(uuid, text, text, boolean) to authenticated;

  -- Replace the unscoped legacy bulk RPC with the selected-team RPC below.
  revoke all on function admin_bulk_shortlist(boolean) from public, anon, authenticated;

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
    v_max numeric;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    if p_stage < 1 or p_stage > 4 then raise exception 'Invalid stage' using errcode = 'VI001'; end if;
    if p_points is null or p_points < 0 then
      raise exception 'Score must be zero or greater' using errcode = 'VI001';
    end if;

    v_max := stage_max_points(p_stage);
    if p_points > v_max then
      raise exception 'Score exceeds maximum (%) for stage %', v_max, p_stage using errcode = 'VI001';
    end if;

    perform 1 from teams where id = p_team_id for update;
    if not found then raise exception 'Team not found' using errcode = 'VI001'; end if;

    if p_stage >= 3 and not exists (
      select 1 from shortlist where team_id = p_team_id and decision = 'shortlisted'
    ) then
      raise exception 'Only shortlisted teams may be scored in Stage 3 or Stage 4.' using errcode = 'VI031';
    end if;

    select scores_locked_stage into v_locked_stages from event_state where id = 1;
    if p_stage = any(v_locked_stages) and not p_force then
      raise exception 'Stage % is locked', p_stage using errcode = 'VI011';
    end if;

    select points into v_old_points from scores where team_id = p_team_id and stage = p_stage;

    insert into scores (team_id, stage, points, detail, updated_at)
    values (p_team_id, p_stage, p_points,
      case when p_note is not null then jsonb_build_object('note', p_note) else null end,
      now())
    on conflict (team_id, stage) do update
      set points = excluded.points, detail = excluded.detail, updated_at = now();

    insert into score_audit (team_id, stage, old_points, new_points, note, admin_id)
    values (p_team_id, p_stage, v_old_points, p_points, p_note, auth.uid());
  end;
  $$;

  revoke all on function admin_set_score(uuid, int, numeric, text, boolean) from public, anon;
  grant execute on function admin_set_score(uuid, int, numeric, text, boolean) to authenticated;

  -- Write either or both preliminary marks atomically. A false update flag
  -- means "leave the existing mark untouched", never "clear the mark".
  create or replace function admin_save_preliminary_scores(
    p_team_id uuid,
    p_s1 numeric,
    p_s2 numeric,
    p_update_s1 boolean,
    p_update_s2 boolean
  )
  returns jsonb
  language plpgsql
  security definer
  as $$
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    if not coalesce(p_update_s1, false) and not coalesce(p_update_s2, false) then
      raise exception 'Enter at least one score to save.' using errcode = 'VI001';
    end if;
    if p_update_s1 and (p_s1 is null or p_s1 < 0 or p_s1 > 50) then
      raise exception 'Stage 1 score must be between 0 and 50.' using errcode = 'VI001';
    end if;
    if p_update_s2 and (p_s2 is null or p_s2 < 0 or p_s2 > 50) then
      raise exception 'Stage 2 score must be between 0 and 50.' using errcode = 'VI001';
    end if;

    perform 1 from teams where id = p_team_id for update;
    if not found then raise exception 'Team not found' using errcode = 'VI001'; end if;

    if p_update_s1 then
      perform admin_set_score(p_team_id, 1, p_s1, 'Preliminary score entry', false);
    end if;
    if p_update_s2 then
      perform admin_set_score(p_team_id, 2, p_s2, 'Preliminary score entry', false);
    end if;

    return jsonb_build_object('ok', true);
  end;
  $$;

  revoke all on function admin_save_preliminary_scores(uuid, numeric, numeric, boolean, boolean) from public, anon;
  grant execute on function admin_save_preliminary_scores(uuid, numeric, numeric, boolean, boolean) to authenticated;

  create or replace function admin_bulk_shortlist_teams(p_team_ids uuid[])
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_cfg shortlist_config;
    v_team record;
    v_s1 numeric;
    v_s2 numeric;
    v_count int := 0;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    if coalesce(cardinality(p_team_ids), 0) = 0 then
      raise exception 'Select at least one team.' using errcode = 'VI001';
    end if;

    select * into v_cfg from shortlist_config where id = 1 for share;

    for v_team in
      select t.id
      from teams t
      where t.id = any(p_team_ids)
      order by t.id
      for update
    loop
      if exists (select 1 from shortlist where team_id = v_team.id) then continue; end if;
      select points into v_s1 from scores where team_id = v_team.id and stage = 1;
      select points into v_s2 from scores where team_id = v_team.id and stage = 2;
      if v_s1 is null or v_s2 is null then continue; end if;

      if v_s1 + v_s2 >= v_cfg.combined_cutoff
        and v_s1 >= v_cfg.stage1_min
        and v_s2 >= v_cfg.stage2_min
      then
        insert into shortlist (team_id, decision, is_override, decided_at, decided_by)
        values (v_team.id, 'shortlisted', false, now(), auth.uid());
        v_count := v_count + 1;
      end if;
    end loop;

    insert into admin_audit_log (action, detail, admin_id)
    values ('bulk_shortlist_selected', jsonb_build_object(
      'requested_team_ids', p_team_ids,
      'shortlisted_count', v_count
    ), auth.uid());

    return jsonb_build_object('ok', true, 'shortlisted_count', v_count);
  end;
  $$;

  revoke all on function admin_bulk_shortlist_teams(uuid[]) from public, anon;
  grant execute on function admin_bulk_shortlist_teams(uuid[]) to authenticated;

  create or replace function admin_generate_stage_assignments(p_stage_slug text)
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_assigned int := 0;
    v_team record;
    v_asset_id uuid;
    v_stage_number int;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    select number into v_stage_number from stages where slug = p_stage_slug;
    if v_stage_number is null then raise exception 'Stage not found' using errcode = 'VI001'; end if;

    for v_team in
      select t.id from teams t
      where t.status in ('ready', 'full')
        and (v_stage_number < 3 or exists (
          select 1 from shortlist sl where sl.team_id = t.id and sl.decision = 'shortlisted'
        ))
    loop
      if exists (select 1 from stage_assignments where stage_slug = p_stage_slug and team_id = v_team.id) then
        continue;
      end if;

      select id into v_asset_id from stage_assets
      where stage_slug = p_stage_slug and assign_mode = 'random'
      order by random() limit 1;

      if v_asset_id is not null then
        insert into stage_assignments (team_id, stage_slug, asset_id) values (v_team.id, p_stage_slug, v_asset_id);
        v_assigned := v_assigned + 1;
      end if;
    end loop;

    insert into admin_audit_log (action, detail, admin_id)
    values ('generate_stage_assignments', jsonb_build_object('stage_slug', p_stage_slug, 'assigned', v_assigned), auth.uid());
    return jsonb_build_object('ok', true, 'assigned', v_assigned);
  end;
  $$;

  create or replace function admin_set_team_assignment(p_team_id uuid, p_stage_slug text, p_asset_id uuid)
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_stage_number int;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    select number into v_stage_number from stages where slug = p_stage_slug;
    if v_stage_number is null then raise exception 'Stage not found' using errcode = 'VI001'; end if;
    if v_stage_number >= 3 and not exists (
      select 1 from shortlist where team_id = p_team_id and decision = 'shortlisted'
    ) then
      raise exception 'Only shortlisted teams may receive Stage 3 or Stage 4 assignments.' using errcode = 'VI031';
    end if;
    if not exists (select 1 from stage_assets where id = p_asset_id and stage_slug = p_stage_slug) then
      raise exception 'Asset does not belong to this stage.' using errcode = 'VI001';
    end if;

    delete from stage_assignments where team_id = p_team_id and stage_slug = p_stage_slug;
    insert into stage_assignments (team_id, stage_slug, asset_id) values (p_team_id, p_stage_slug, p_asset_id);
    insert into admin_audit_log (action, detail, admin_id)
    values ('set_team_assignment', jsonb_build_object(
      'team_id', p_team_id, 'stage_slug', p_stage_slug, 'asset_id', p_asset_id
    ), auth.uid());
    return jsonb_build_object('ok', true);
  end;
  $$;

  revoke all on function admin_generate_stage_assignments(text) from public, anon;
  grant execute on function admin_generate_stage_assignments(text) to authenticated;
  revoke all on function admin_set_team_assignment(uuid, text, uuid) from public, anon;
  grant execute on function admin_set_team_assignment(uuid, text, uuid) to authenticated;

  create or replace function admin_get_stage_assignments(p_stage_slug text)
  returns jsonb
  language plpgsql
  security definer
  as $$
  declare
    v_stage_number int;
  begin
    if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
    select number into v_stage_number from stages where slug = p_stage_slug;
    if v_stage_number is null then raise exception 'Stage not found' using errcode = 'VI001'; end if;

    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'team_name', t.name, 'asset_id', sa.asset_id, 'asset_label', a.label
      ) order by t.name)
      from stage_assignments sa
      join teams t on t.id = sa.team_id
      left join stage_assets a on a.id = sa.asset_id
      where sa.stage_slug = p_stage_slug
        and (v_stage_number < 3 or exists (
          select 1 from shortlist sl where sl.team_id = t.id and sl.decision = 'shortlisted'
        ))
    ), '[]'::jsonb);
  end;
  $$;

  revoke all on function admin_get_stage_assignments(text) from public, anon;
  grant execute on function admin_get_stage_assignments(text) to authenticated;
