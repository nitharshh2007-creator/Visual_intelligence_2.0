-- Removes exactly the rows seed.sql created (team names prefixed
-- "TEST ", member reg_nos prefixed "TEST-") and nothing else.
-- Safe to re-run; also cleans up ad-hoc teams created during manual
-- verification if you prefix them "TEST " / "TEST-" too.

-- members/scores/activity all have `on delete cascade` on their
-- team_id FK, so deleting the team is enough. (Deleting members first
-- would violate teams.captain_id -> members.id instead.)
delete from teams where name like 'TEST %';
-- Catches any stray TEST- member rows left on a non-TEST-named team
-- from manual testing.
delete from members where reg_no like 'TEST-%';

update event_state set status = 'upcoming', current_stage = 0, stage_started_at = null, stage_ends_at = null, updated_at = now() where id = 1;
