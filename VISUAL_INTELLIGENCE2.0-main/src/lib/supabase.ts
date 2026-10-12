// ─────────────────────────────────────────────────────────────
// Supabase browser client
// ─────────────────────────────────────────────────────────────
// Anon-key only. Never import the service_role key here — this file
// ships to the browser. For /admin, middleware.ts and
// lib/supabase-server.ts need to read the session too, so this uses
// @supabase/ssr's browser client (syncs the session to cookies)
// instead of plain createClient() (localStorage-only, invisible to
// middleware/server code).

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Minimal hand-written schema types ──
// (No `supabase gen types` access from this environment; keep these in
// sync with supabase/migrations/0001_team_registration.sql and
// 0002_realtime_backend.sql by hand.)

// NOTE: these are `type` aliases, not `interface`s, on purpose.
// supabase-js's .rpc()/.from() generics do deep conditional-type
// matching against the Database shape (GenericTable/GenericSchema);
// an `interface` here doesn't structurally unify the same way inside
// those nested conditional types and silently collapses the whole
// inferred Schema to `never` (verified empirically — swapping back to
// `interface` reproduces the breakage). `supabase gen types` output
// uses plain object type literals for exactly this reason — match it.

export type LeaderboardViewRow = {
  team_id: string;
  name: string;
  member_initials: string[]; // first 3
  member_count: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  total: number;
  rank: number;
  updated_at: string;
};

export type EventStateRow = {
  status: "upcoming" | "live" | "paused" | "finished";
  current_stage: number; // 0-4
  stage_started_at: string | null;
  stage_ends_at: string | null;
  registration_deadline: string;
  registration_closed: boolean;
  paused_at: string | null;
  remaining_ms: number | null;
  announcement: string | null;
  scores_locked_stage: number[];
  updated_at: string;
  leaderboard_visibility: "public" | "hidden";
  projector_token: string | null;
  leaderboard_rev: number;
  released_stage: number; // 0-4
  reveal_stage_names: boolean;
  current_round: number; // 0 = no cutoff applied yet
  current_round_label: string | null;
  current_advance_rule: "eliminate" | "display_only";
};

// get_stage_access()'s return shape (supabase/migrations/0007_stage_release.sql).
export type StageState = "LOCKED" | "RELEASED" | "LIVE" | "COMPLETED" | "ELIMINATED";
export type StageAccessEntry = {
  stage: number;
  slug: string;
  name: string | null;
  state: StageState;
  reason: string | null;
};
export type StageAccessPayload = { stages: StageAccessEntry[] };

// get_stage_content()'s return shape (supabase/migrations/0009_stage_content.sql).
export type StageAsset = {
  id: string;
  kind: string;
  label: string | null;
  sort: number;
  storage_path: string | null;
  text_value: string | null;
  meta: Record<string, unknown>;
};
export type StageSubmission = {
  id: string;
  version: number;
  kind: string;
  text_value: string | null;
  url: string | null;
  created_at: string;
};
export type StageContentPayload = {
  stage: {
    number: number;
    slug: string;
    name: string;
    hook: string | null;
    tests: string[] | null;
    duration_min: number | null;
    overview_md: string | null;
    rules_md: string | null;
    roles_md: string | null;
    phases: { name: string; minutes: number; accepts_submission: boolean; releases: string[] }[];
  };
  state: "LIVE" | "COMPLETED";
  assets: StageAsset[];
  submissions: StageSubmission[];
  // supabase/migrations/0013_bugx_vault.sql — true for every stage
  // except bugx-hacker before this team has solved it (no password
  // configured at all also reads as "not locked", since there's
  // nothing to withhold).
  bugx_configured: boolean;
  bugx_locked: boolean;
  bugx_solved: boolean;
  bugx_form_url: string | null;
};

// admin_get_stage_overview()'s return shape.
export type AdminStageOverviewEntry = {
  stage: number;
  slug: string;
  name: string;
  status: "not_released" | "released" | "live" | "ended";
  released_at: string | null;
  started_at: string | null;
  ended_at: string | null;
};
export type AdminStageOverviewTeam = {
  team_id: string;
  name: string;
  access: Record<string, { state: StageState; reason: string | null }>;
  overrides: Record<string, { allowed: boolean; note: string | null }>;
};
export type AdminStageOverview = { stages: AdminStageOverviewEntry[]; teams: AdminStageOverviewTeam[] };

// admin_list_submissions()'s return shape (supabase/migrations/0012_submissions_rubric.sql).
export type AdminSubmissionRow = {
  id: string;
  team_id: string;
  team_name: string;
  stage_slug: string;
  version: number;
  kind: string;
  text_value: string | null;
  url: string | null;
  created_at: string;
};

// admin_preview_cutoff()'s return shape.
export type CutoffPreviewTeam = { team_id: string; name: string; rank: number; total: number; would_keep: boolean };
export type CutoffPreview = {
  after_stage: number;
  keep: number;
  total_teams: number;
  cut_line_total: number;
  tie_warning: boolean;
  teams: CutoffPreviewTeam[];
};

// get_leaderboard()'s return shape (supabase/migrations/0006_leaderboard_visibility.sql)
// — the only public read path for teams/activity now that leaderboard_view
// and activity are revoked from anon/authenticated. `round` is always null
// until Section D's qualifier cutoffs ship.
export type LeaderboardPayload = {
  visibility: "public" | "hidden";
  round: string | null;
  total_teams: number;
  shown_teams: number;
  teams: LeaderboardViewRow[];
  activity: ActivityRow[];
};

export type AdminTeamDetail = {
  id: string;
  code: string;
  name: string;
  status: TeamRow["status"];
  captain_id: string | null;
  created_at: string;
  member_count: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  score_updated_at: Record<string, string> | null; // keyed by stage number (as string)
  members: {
    id: string;
    name: string;
    reg_no: string;
    email: string;
    phone: string | null;
    section: string | null;
    year: number | null;
    role: "captain" | "member";
    created_at: string;
  }[];
};

export type ScoreAuditRow = {
  id: string;
  team_id: string;
  team_name: string;
  stage: number;
  old_points: number | null;
  new_points: number;
  note: string | null;
  admin_id: string | null;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  type: "score" | "rank_change" | "stage_complete" | "join";
  team_id: string;
  message: string;
  created_at: string;
};

export type MemberRow = {
  id: string;
  team_id: string;
  name: string;
  reg_no: string | null;
  role: "captain" | "member";
  created_at: string;
};

export type TeamRow = {
  id: string;
  code: string;
  name: string;
  captain_id: string | null;
  status: "incomplete" | "ready" | "full";
  created_at: string;
};

// supabase-js's generic inference requires every table to carry
// Row/Insert/Update/Relationships (GenericTable) — without all four,
// the whole Database['public'] schema silently fails its structural
// check and every other inference (including .rpc()'s Args/Returns)
// falls back to `never`. We never write to these tables directly
// (all writes go through the RPCs), so Insert/Update are untyped.
type ReadOnlyTable<Row> = { Row: Row; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      teams: ReadOnlyTable<TeamRow>;
      members: ReadOnlyTable<MemberRow>;
      event_state: ReadOnlyTable<EventStateRow>;
      scores: ReadOnlyTable<{ id: string; team_id: string; stage: number; points: number; detail: unknown; created_at: string; updated_at: string }>;
      activity: ReadOnlyTable<ActivityRow>;
      // Fixed stage definitions (supabase/migrations/0004_stage_pages.sql)
      // — admin-only reads from Server Components (src/app/admin/stages*),
      // never fetched from a Client Component (that's get_stage_content()'s
      // job, gated — see 0009_stage_content.sql and stageAccess.ts).
      stages: ReadOnlyTable<{
        slug: string;
        number: number;
        name: string;
        hook: string | null;
        tests: string[] | null;
        duration_min: number | null;
        overview_md: string | null;
        rules_md: string | null;
        roles_md: string | null;
        faq: unknown;
        rubric: { name: string; max_points?: number }[] | null;
        phases: { name: string; minutes: number; accepts_submission: boolean; releases: string[] }[] | null;
        submission_config: unknown;
        status: string | null;
      }>;
      stage_assets: ReadOnlyTable<{
        id: string;
        stage_slug: string | null;
        kind: string;
        label: string | null;
        sort: number | null;
        storage_path: string | null;
        text_value: string | null;
        release: string | null;
        assign_mode: string | null;
        meta: unknown;
      }>;
      stage_secrets: ReadOnlyTable<{
        stage_slug: string;
        bugx_password_hash: string | null;
        bugx_form_url: string | null;
        bugx_pdf_asset_id: string | null;
      }>;
    };
    Views: {
      leaderboard_view: { Row: LeaderboardViewRow; Relationships: [] };
    };
    Functions: {
      create_team: {
        Args: { p_team_name: string; p_captain_name: string; p_reg_no?: string | null; p_email?: string | null; p_section?: string | null; p_year?: number | null };
        Returns: { code: string; team_id: string };
      };
      join_team: {
        Args: { p_code: string; p_member_name: string; p_reg_no?: string | null; p_email?: string | null; p_phone?: string | null; p_section?: string | null; p_year?: number | null };
        Returns: { team_id: string; member_id: string };
      };
      get_team_lobby: {
        Args: { p_code: string; p_reg_no?: string | null };
        Returns: {
          id: string;
          code: string;
          name: string;
          status: TeamRow["status"];
          created_at: string;
          members: { name: string; role: "captain" | "member"; created_at: string }[] | null;
        };
      };
      find_team_by_code: {
        Args: { p_code: string };
        Returns: { name: string; member_count: number; status: TeamRow["status"]; captain_first_name: string };
      };
      get_leaderboard: {
        Args: { p_projector_token?: string | null; p_show_eliminated?: boolean };
        Returns: LeaderboardPayload;
      };
      admin_set_leaderboard_visibility: {
        Args: { p_mode: "public" | "hidden" };
        Returns: { ok: boolean; visibility: "public" | "hidden" };
      };
      admin_rotate_projector_token: {
        Args: Record<PropertyKey, never>;
        Returns: { ok: boolean; projector_token: string };
      };
      remove_member: {
        Args: { p_code: string; p_captain_reg_no: string; p_member_name: string };
        Returns: { ok: boolean };
      };
      rename_team: {
        Args: { p_code: string; p_captain_reg_no: string; p_new_name: string };
        Returns: { ok: boolean };
      };
      server_now: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      admin_set_stage: {
        Args: { p_stage: number; p_duration_seconds: number };
        Returns: void;
      };
      admin_pause: { Args: Record<PropertyKey, never>; Returns: void };
      admin_resume: { Args: Record<PropertyKey, never>; Returns: void };
      admin_extend: { Args: { p_seconds: number }; Returns: void };
      admin_end_stage: { Args: Record<PropertyKey, never>; Returns: void };
      admin_set_event_status: { Args: { p_status: string }; Returns: void };
      admin_set_announcement: { Args: { p_text: string }; Returns: void };
      admin_set_score: {
        Args: { p_team_id: string; p_stage: number; p_points: number; p_note?: string | null; p_force?: boolean };
        Returns: void;
      };
      admin_undo_last_score: { Args: { p_team_id: string; p_stage: number }; Returns: void };
      admin_lock_stage: { Args: { p_stage: number; p_locked: boolean }; Returns: void };
      admin_get_teams: { Args: Record<PropertyKey, never>; Returns: AdminTeamDetail[] };
      admin_add_member: {
        Args: { p_team_id: string; p_name: string; p_reg_no: string; p_email: string; p_phone?: string | null; p_section?: string | null; p_year?: number | null };
        Returns: string;
      };
      admin_remove_member: { Args: { p_member_id: string }; Returns: void };
      admin_move_member: { Args: { p_member_id: string; p_to_team_id: string }; Returns: void };
      admin_rename_team: { Args: { p_team_id: string; p_new_name: string }; Returns: void };
      admin_delete_team: { Args: { p_team_id: string }; Returns: void };
      admin_set_registration_deadline: { Args: { p_ts: string }; Returns: void };
      admin_set_registration_closed: { Args: { p_closed: boolean }; Returns: { ok: boolean; registration_closed: boolean } };
      admin_list_score_audit: {
        Args: { p_team_id?: string | null; p_stage?: number | null; p_limit?: number };
        Returns: ScoreAuditRow[];
      };
      get_stage_access: {
        Args: { p_code?: string | null; p_reg_no?: string | null };
        Returns: StageAccessPayload;
      };
      get_stage_content: {
        Args: { p_code: string; p_reg_no: string; p_slug: string };
        Returns: StageContentPayload;
      };
      submit_stage_result: {
        Args: { p_code: string; p_reg_no: string; p_slug: string; p_kind: string; p_text_value?: string | null; p_url?: string | null };
        Returns: { ok: boolean; submission_id: string; version: number };
      };
      admin_release_stage: { Args: { p_stage: number }; Returns: { ok: boolean; stage: number } };
      admin_set_team_stage_override: {
        Args: { p_team_id: string; p_stage: number; p_allowed: boolean; p_note?: string | null };
        Returns: { ok: boolean };
      };
      admin_set_reveal_stage_names: { Args: { p_reveal: boolean }; Returns: { ok: boolean } };
      admin_get_stage_overview: { Args: Record<PropertyKey, never>; Returns: AdminStageOverview };
      admin_preview_cutoff: {
        Args: { p_after_stage: number; p_keep_mode: "half" | "count"; p_keep_value?: number | null };
        Returns: CutoffPreview;
      };
      admin_apply_cutoff: {
        Args: {
          p_after_stage: number;
          p_keep_mode: "half" | "count";
          p_keep_value?: number | null;
          p_extra_include?: string[];
          p_extra_exclude?: string[];
          p_advance_rule?: "eliminate" | "display_only";
        };
        Returns: { ok: boolean; after_stage: number; kept_count: number; label: string };
      };
      admin_undo_cutoff: { Args: { p_after_stage: number }; Returns: { ok: boolean; current_round: number } };
      admin_generate_stage_assignments: { Args: { p_stage_slug: string }; Returns: { ok: boolean; assigned: number } };
      admin_set_team_assignment: {
        Args: { p_team_id: string; p_stage_slug: string; p_asset_id: string };
        Returns: { ok: boolean };
      };
      admin_get_stage_assignments: {
        Args: { p_stage_slug: string };
        Returns: { team_id: string; team_name: string; asset_id: string | null; asset_label: string | null }[];
      };
      get_team_cut_result: {
        Args: { p_code: string; p_reg_no: string };
        Returns: { after_stage: number; rank: number; total: number; total_teams: number } | null;
      };
      // supabase/migrations/0012_submissions_rubric.sql
      admin_list_submissions: {
        Args: { p_stage_slug?: string | null; p_team_id?: string | null };
        Returns: AdminSubmissionRow[];
      };
      admin_get_rubric_scores: {
        Args: { p_stage_slug: string };
        Returns: Record<string, { criteria: Record<string, number>; comment: string | null; updated_at: string }>;
      };
      admin_submit_rubric_score: {
        Args: { p_team_id: string; p_stage_slug: string; p_criteria: Record<string, number>; p_comment?: string | null; p_force?: boolean };
        Returns: { ok: boolean; total: number };
      };
      // supabase/migrations/0013_bugx_vault.sql
      admin_set_bugx_password: {
        Args: { p_stage_slug: string; p_password: string };
        Returns: { ok: boolean };
      };
      submit_bugx_password: {
        Args: { p_code: string; p_reg_no: string; p_slug: string; p_password: string };
        Returns: { ok: boolean; success: boolean; already_solved: boolean; form_url: string | null };
      };
    };
  };
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True when Supabase env vars are present AND the mock hasn't been
// force-enabled. lib/registration.ts and hooks/useLeaderboard.ts both
// branch on this at call time, so flipping NEXT_PUBLIC_USE_MOCK or
// removing the env vars falls back to the mock without a code change.
export function isSupabaseConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return false;
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars are missing. Check isSupabaseConfigured() before calling getSupabaseClient()."
    );
  }
  if (!client) {
    client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
