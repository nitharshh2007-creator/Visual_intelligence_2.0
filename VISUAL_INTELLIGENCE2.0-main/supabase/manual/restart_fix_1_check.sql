-- READ-ONLY. Run in the Supabase SQL Editor before and after
-- restart_fix_2_apply.sql. Not a migration; changes nothing.

-- A. Which version of each restart-related function is live.
select
  p.proname as function,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as returns,
  case
    when p.proname = 'stage_completion' and pg_get_functiondef(p.oid) like '%when sp.status = ''ended'' then true%' then '0028'
    when p.proname = 'stage_completion' and pg_get_functiondef(p.oid) like '%s.created_at >= sp.started_at%' then '0027'
    when p.proname = 'stage_completion' then 'pre-0027'
    when p.proname = 'admin_set_event_status' and pg_get_functiondef(p.oid) like '%perform admin_restart_event()%' then '0029'
    when p.proname = 'admin_set_event_status' and pg_get_functiondef(p.oid) like '%Event restarted from Stage 1%' then '0028'
    when p.proname = 'admin_set_event_status' and pg_get_functiondef(p.oid) like '%Final Stage 4 restarted%' then '0027'
    when p.proname = 'admin_set_event_status' and pg_get_functiondef(p.oid) like '%can only be restarted as live%' then '0026'
    when p.proname = 'admin_set_event_status' then '0024 or earlier'
    when p.proname = 'admin_restart_event' then '0029'
    else 'present'
  end as live_version
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('stage_completion', 'admin_set_event_status', 'admin_restart_event', 'is_admin')
order by 1;

-- B. Missing dependencies. Expect ZERO rows.
select need as missing
from (values
  ('function is_admin()',                 to_regprocedure('public.is_admin()') is not null),
  ('table qualifiers',                    to_regclass('public.qualifiers') is not null),
  ('table admin_audit_log',               to_regclass('public.admin_audit_log') is not null),
  ('table activity',                      to_regclass('public.activity') is not null),
  ('table submissions',                   to_regclass('public.submissions') is not null),
  ('table stages',                        to_regclass('public.stages') is not null),
  ('table stage_progress',                to_regclass('public.stage_progress') is not null)
) t(need, ok)
where not ok
union all
select table_name || '.' || column_name
from (values
  ('event_state', 'current_round'), ('event_state', 'current_round_label'),
  ('event_state', 'current_advance_rule'), ('event_state', 'released_stage'),
  ('event_state', 'paused_at'), ('event_state', 'remaining_ms'),
  ('event_state', 'stage_started_at'), ('event_state', 'stage_ends_at'),
  ('stage_progress', 'released_at'), ('stage_progress', 'started_at'), ('stage_progress', 'ended_at'),
  ('submissions', 'stage_slug'), ('submissions', 'created_at'), ('stages', 'number'),
  ('admin_audit_log', 'detail'), ('admin_audit_log', 'admin_id')
) c(table_name, column_name)
where not exists (
  select 1 from information_schema.columns ic
  where ic.table_schema = 'public' and ic.table_name = c.table_name and ic.column_name = c.column_name
);

-- C. Current stage state (no stage should be 'live' when you click Restart).
select stage, status, started_at, ended_at from stage_progress order by stage;

-- D. Rollback backup: copy BOTH cells into a local file before applying.
select pg_get_functiondef('public.stage_completion(uuid,int)'::regprocedure) as stage_completion_backup;
select pg_get_functiondef('public.admin_set_event_status(text)'::regprocedure) as admin_set_event_status_backup;
