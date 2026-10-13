-- Tell "cut after Level 2" apart from "shortlist not decided yet".
-- Before this, both came back as LOCKED/not_shortlisted, so the stage
-- pages couldn't show eliminated teams a proper "not found" screen
-- without also showing it to teams still waiting on the shortlist.
--   rejected                 → ELIMINATED / cut_after_stage_2
--   undecided / on_hold      → LOCKED     / shortlist_pending
-- Everything else is unchanged from 0023.
create or replace function _team_stage_state(p_team_id uuid, p_stage int)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_progress stage_progress;
  v_prior_done boolean;
  v_override boolean;
  v_round int;
  v_rule text;
  v_qualified boolean;
  v_shortlist_decision text;
begin
  if p_stage >= 3 then
    if not exists (
      select 1 from teams
      where id = p_team_id and status in ('ready', 'full')
    ) then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'team_not_eligible');
    end if;

    select decision into v_shortlist_decision
    from shortlist
    where team_id = p_team_id;

    if v_shortlist_decision = 'rejected' then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_2');
    end if;
    if coalesce(v_shortlist_decision, 'not_decided') <> 'shortlisted' then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'shortlist_pending');
    end if;
  end if;

  select current_round, current_advance_rule
  into v_round, v_rule
  from event_state
  where id = 1;

  if p_stage = 4 then
    if v_round < 3 then
      return jsonb_build_object('state', 'LOCKED', 'reason', 'cutoff_after_stage_3_pending');
    end if;
    select exists (
      select 1 from qualifiers where team_id = p_team_id and after_stage = 3
    ) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_3');
    end if;
  elsif v_round > 0 and v_rule = 'eliminate' and p_stage > v_round then
    select exists (
      select 1 from qualifiers where team_id = p_team_id and after_stage = v_round
    ) into v_qualified;
    if not v_qualified then
      return jsonb_build_object('state', 'ELIMINATED', 'reason', 'cut_after_stage_' || v_round);
    end if;
  end if;

  select * into v_progress from stage_progress where stage = p_stage;
  if v_progress.status = 'not_released' then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_released');
  end if;

  v_prior_done := p_stage = 1 or stage_completion(p_team_id, p_stage - 1);
  select allowed into v_override
  from team_stage_overrides
  where team_id = p_team_id and stage = p_stage;

  if not v_prior_done and coalesce(v_override, false) = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'not_completed_prior');
  end if;
  if v_prior_done and v_override = false then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'revoked');
  end if;

  if stage_completion(p_team_id, p_stage) then
    return jsonb_build_object('state', 'COMPLETED', 'reason', null);
  elsif v_progress.status = 'ended' then
    return jsonb_build_object('state', 'LOCKED', 'reason', 'stage_ended');
  elsif v_progress.status = 'live' then
    return jsonb_build_object('state', 'LIVE', 'reason', null);
  end if;

  return jsonb_build_object('state', 'RELEASED', 'reason', null);
end;
$$;

revoke all on function _team_stage_state(uuid, int) from public, anon, authenticated;
