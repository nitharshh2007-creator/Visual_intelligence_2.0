-- ─────────────────────────────────────────────────────────────
-- Migration 0010: team_stage_overrides bumps leaderboard_rev too
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0009 (not edited). Phase 3 Section C asks for stage
-- unlocks to update in realtime off "the leaderboard_rev/event_state
-- channel" — the client subscribes to event_state only (same single
-- row scores/activity/qualifiers already bump, see 0006/0008) and
-- refetches get_stage_access() on every change. admin_release_stage
-- already bumps it for free (it writes event_state.released_stage,
-- which log_stage_activity's own trigger bumps directly). But
-- admin_set_team_stage_override only ever touches
-- team_stage_overrides — nothing bumped leaderboard_rev for it, so a
-- per-team grant/revoke would silently not reach anyone's open tab
-- until the 10s poll fallback caught up. Giving it the same trigger
-- every other leaderboard-relevant table has closes that gap.

drop trigger if exists trg_bump_rev_team_stage_overrides on team_stage_overrides;
create trigger trg_bump_rev_team_stage_overrides
  after insert or update or delete on team_stage_overrides
  for each row
  execute function bump_leaderboard_rev();
