-- ─────────────────────────────────────────────────────────────
-- Migration 0013: BugX password vault (verification, not just storage)
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0012 (not edited).
--
-- Before this migration, stage_secrets.bugx_password_hash was a raw
-- text field an admin had to paste a pre-computed bcrypt hash into —
-- with no way to produce one from the app (no SQL editor access, no
-- in-app hashing). Nothing ever verified anything against it, and
-- bugx_attempts/bugx_solves (schema since 0004) were never read or
-- written by anything.
--
-- admin_set_bugx_password hashes server-side so the admin only ever
-- types a plaintext answer once, never a hash. submit_bugx_password
-- is the team-facing check: a wrong guess is a normal result (logged
-- to bugx_attempts, not an exception), a right one records the solve
-- + its 1-indexed rank (first-to-solve, per the stage's own design —
-- see the hook text) under an advisory lock so two simultaneous
-- correct guesses can't both claim rank 1. It deliberately does NOT
-- auto-write a points value: the spec says BugX rewards being first,
-- but never says how many points that's worth, and this migration
-- doesn't invent a real event's scoring formula. The judge sees each
-- team's rank (once surfaced in the admin UI) and sets points via the
-- existing /admin/submissions or /admin/judge, same as every other
-- stage.
--
-- get_stage_content is redefined (not edited in 0009) to withhold the
-- one asset stage_secrets.bugx_pdf_asset_id points at until that
-- team has a bugx_solves row — everything else about it (LOCKED/
-- NOT_LIVE/ELIMINATED, assign_mode filtering) is identical to 0009's
-- version. Also adds `bugx_solved` to the stage payload so the UI
-- knows whether to show the password form or the unlocked PDF.

create extension if not exists pgcrypto;

create or replace function admin_set_bugx_password(p_stage_slug text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;
  if p_password is null or length(p_password) < 1 then
    raise exception 'Password cannot be empty' using errcode = 'VI001';
  end if;
  if not exists (select 1 from stages where slug = p_stage_slug) then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  insert into stage_secrets (stage_slug, bugx_password_hash)
  values (p_stage_slug, crypt(p_password, gen_salt('bf')))
  on conflict (stage_slug) do update set bugx_password_hash = excluded.bugx_password_hash;

  insert into admin_audit_log (action, detail, admin_id)
  values ('set_bugx_password', jsonb_build_object('stage_slug', p_stage_slug), auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function admin_set_bugx_password(text, text) from public, anon;
grant execute on function admin_set_bugx_password(text, text) to authenticated;

create or replace function submit_bugx_password(p_code text, p_reg_no text, p_slug text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_stage stages;
  v_state jsonb;
  v_hash text;
  v_success boolean;
  v_already_solved boolean;
  v_rank int;
  v_form_url text;
begin
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null or not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  select * into v_stage from stages where slug = p_slug;
  if v_stage.slug is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  v_state := _team_stage_state(v_team_id, v_stage.number);
  if v_state->>'state' = 'ELIMINATED' then
    raise exception 'Your team did not qualify past the last cutoff' using errcode = 'VI020';
  elsif v_state->>'state' <> 'LIVE' then
    raise exception 'This stage is not live' using errcode = 'VI022';
  end if;

  select bugx_password_hash, bugx_form_url into v_hash, v_form_url from stage_secrets where stage_slug = p_slug;
  if v_hash is null then
    raise exception 'No password has been configured for this stage' using errcode = 'VI001';
  end if;

  v_success := crypt(p_password, v_hash) = v_hash;

  insert into bugx_attempts (team_id, attempt_hash, success)
  values (v_team_id, encode(digest(p_password, 'sha256'), 'hex'), v_success);

  select exists(select 1 from bugx_solves where team_id = v_team_id) into v_already_solved;

  if v_success and not v_already_solved then
    -- Serializes concurrent first-solves so rank is never double-assigned.
    perform pg_advisory_xact_lock(hashtext('bugx_solves:' || p_slug));
    select coalesce(max(rank), 0) + 1 into v_rank from bugx_solves;
    insert into bugx_solves (team_id, solved_at, rank)
    values (v_team_id, now(), v_rank)
    on conflict (team_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'success', v_success,
    'already_solved', v_already_solved,
    'form_url', case when v_success or v_already_solved then v_form_url else null end
  );
end;
$$;

grant execute on function submit_bugx_password(text, text, text, text) to anon, authenticated;

-- Redefines get_stage_content from 0009: identical except the
-- bugx_pdf_asset_id asset is withheld until bugx_solves has a row for
-- this team, and the payload now reports `bugx_solved`.
create or replace function get_stage_content(p_code text, p_reg_no text, p_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_team_id uuid;
  v_stage stages;
  v_state jsonb;
  v_assets jsonb;
  v_submissions jsonb;
  v_pdf_asset_id uuid;
  v_solved boolean;
begin
  select id into v_team_id from teams where normalize_team_code(code) = normalize_team_code(p_code);
  if v_team_id is null or not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    raise exception 'No team found for that code' using errcode = 'VI001';
  end if;

  select * into v_stage from stages where slug = p_slug;
  if v_stage.slug is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  v_state := _team_stage_state(v_team_id, v_stage.number);

  if v_state->>'state' = 'ELIMINATED' then
    raise exception 'Your team did not qualify past the last cutoff' using errcode = 'VI020';
  elsif v_state->>'state' = 'LOCKED' then
    raise exception 'This stage is locked' using errcode = 'VI021';
  elsif v_state->>'state' = 'RELEASED' then
    raise exception 'This stage has not started yet' using errcode = 'VI022';
  end if;
  -- LIVE or COMPLETED from here — allowed to view.

  select bugx_pdf_asset_id into v_pdf_asset_id from stage_secrets where stage_slug = p_slug;
  select exists(select 1 from bugx_solves where team_id = v_team_id) into v_solved;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id, 'kind', a.kind, 'label', a.label, 'sort', a.sort,
      'storage_path', a.storage_path, 'text_value', a.text_value, 'meta', a.meta
    ) order by a.sort
  ), '[]'::jsonb) into v_assets
  from stage_assets a
  where a.stage_slug = p_slug
    and (a.assign_mode = 'all' or exists (
      select 1 from stage_assignments sa where sa.stage_slug = p_slug and sa.team_id = v_team_id and sa.asset_id = a.id
    ))
    and (v_pdf_asset_id is null or a.id <> v_pdf_asset_id or v_solved);

  select coalesce(jsonb_agg(
    jsonb_build_object('id', s.id, 'version', s.version, 'kind', s.kind, 'text_value', s.text_value, 'url', s.url, 'created_at', s.created_at)
    order by s.version desc
  ), '[]'::jsonb) into v_submissions
  from submissions s where s.team_id = v_team_id and s.stage_slug = p_slug;

  return jsonb_build_object(
    'stage', jsonb_build_object(
      'number', v_stage.number, 'slug', v_stage.slug, 'name', v_stage.name, 'hook', v_stage.hook,
      'tests', v_stage.tests, 'duration_min', v_stage.duration_min, 'overview_md', v_stage.overview_md,
      'rules_md', v_stage.rules_md, 'roles_md', v_stage.roles_md, 'phases', v_stage.phases
    ),
    'state', v_state->>'state',
    'assets', v_assets,
    'submissions', v_submissions,
    -- bugx_solves has no stage_slug column (there's only one BugX
    -- stage per event) — bugx_configured is what scopes all of this
    -- to the stage that actually has a PDF withheld, so a team that
    -- solved BugX doesn't see this panel on every other stage too.
    'bugx_configured', v_pdf_asset_id is not null,
    'bugx_locked', v_pdf_asset_id is not null and not v_solved,
    'bugx_solved', v_pdf_asset_id is not null and v_solved,
    'bugx_form_url', case when v_pdf_asset_id is not null and v_solved then (select bugx_form_url from stage_secrets where stage_slug = p_slug) else null end
  );
end;
$$;

grant execute on function get_stage_content(text, text, text) to anon, authenticated;
