-- ─────────────────────────────────────────────────────────────
-- Migration 0012: /admin/submissions viewer + rubric-based judging
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0011 (not edited).
--
-- admin_list_submissions: every submission (all versions, not just
-- latest — organizers reviewing a dispute need the history), joined
-- to the team name, for the new /admin/submissions page.
--
-- rubric_scores existed since 0004 but nothing ever read or wrote it
-- — /admin/judge only ever set one flat aggregate number via
-- admin_set_score. admin_submit_rubric_score lets a judge score each
-- of a stage's rubric criteria individually, persists that per-judge
-- breakdown in rubric_scores (unique per team+stage+judge, so
-- multiple judges can score the same team independently), and rolls
-- the sum straight into scores via admin_set_score — scores stays the
-- single aggregate the leaderboard/cutoffs/everything else already
-- reads, rubric_scores is the audit trail behind that number.
--
-- NOTE: every stage's `rubric` column is still an empty [] right now
-- — migration 0004 never populated one. This migration does not
-- invent judging criteria for a real event; the UI below degrades to
-- a single "Overall" field when a stage has no rubric defined, same
-- as /admin/judge today, until the organizers decide real criteria
-- and someone seeds `update stages set rubric = ... where slug = ...`.

create or replace function admin_list_submissions(p_stage_slug text default null, p_team_id uuid default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id, 'team_id', s.team_id, 'team_name', t.name, 'stage_slug', s.stage_slug,
      'version', s.version, 'kind', s.kind, 'text_value', s.text_value, 'url', s.url,
      'created_at', s.created_at
    ) order by s.stage_slug, t.name, s.version desc
  ), '[]'::jsonb) into v_result
  from submissions s
  join teams t on t.id = s.team_id
  where (p_stage_slug is null or s.stage_slug = p_stage_slug)
    and (p_team_id is null or s.team_id = p_team_id);

  return v_result;
end;
$$;

revoke all on function admin_list_submissions(text, uuid) from public, anon;
grant execute on function admin_list_submissions(text, uuid) to authenticated;

-- This judge's (auth.uid()'s) own prior rubric entries for a stage,
-- keyed by team — so the scoring UI can re-open a team already
-- scored and show what was entered instead of blank fields.
create or replace function admin_get_rubric_scores(p_stage_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select coalesce(jsonb_object_agg(r.team_id, jsonb_build_object('criteria', r.criteria, 'comment', r.comment, 'updated_at', r.updated_at)), '{}'::jsonb)
  into v_result
  from rubric_scores r
  where r.stage_slug = p_stage_slug and r.judge_id = auth.uid()::text;

  return v_result;
end;
$$;

revoke all on function admin_get_rubric_scores(text) from public, anon;
grant execute on function admin_get_rubric_scores(text) to authenticated;

create or replace function admin_submit_rubric_score(
  p_team_id uuid,
  p_stage_slug text,
  p_criteria jsonb,
  p_comment text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_stage_number int;
  v_total numeric;
begin
  if not is_admin() then raise exception 'Admin access required' using errcode = 'VI010'; end if;

  select number into v_stage_number from stages where slug = p_stage_slug;
  if v_stage_number is null then
    raise exception 'Stage not found' using errcode = 'VI001';
  end if;

  select coalesce(sum(value::numeric), 0) into v_total
  from jsonb_each_text(p_criteria) as kv(key, value);

  insert into rubric_scores (team_id, stage_slug, judge_id, criteria, comment, updated_at)
  values (p_team_id, p_stage_slug, auth.uid()::text, p_criteria, p_comment, now())
  on conflict (team_id, stage_slug, judge_id) do update
    set criteria = excluded.criteria, comment = excluded.comment, updated_at = now();

  perform admin_set_score(p_team_id, v_stage_number, v_total, 'rubric: ' || p_criteria::text, p_force);

  return jsonb_build_object('ok', true, 'total', v_total);
end;
$$;

revoke all on function admin_submit_rubric_score(uuid, text, jsonb, text, boolean) from public, anon;
grant execute on function admin_submit_rubric_score(uuid, text, jsonb, text, boolean) to authenticated;
