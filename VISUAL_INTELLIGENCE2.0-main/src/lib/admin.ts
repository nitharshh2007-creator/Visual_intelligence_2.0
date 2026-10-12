// ─────────────────────────────────────────────────────────────
// Admin Control Room — auth + RPC wrappers
// ─────────────────────────────────────────────────────────────
// Every write here goes through a SECURITY DEFINER RPC that checks
// is_admin() server-side (supabase/migrations/0003_admin_control_room.sql).
// This file never imports or references a service_role key — all calls
// use the same anon-key browser client as the public pages; access
// control is enforced by the signed-in user's row in `admins`, not by
// which key is used.

import { getSupabaseClient } from "./supabase";
import type { AdminTeamDetail, ScoreAuditRow, AdminStageOverview, CutoffPreview } from "./supabase";

export type AdminErrorCode =
  | "NOT_ADMIN"
  | "STAGE_LOCKED"
  | "TEAM_FULL"
  | "INVALID_CODE"
  | "ALREADY_REGISTERED"
  | "NAME_TAKEN"
  | "STAGE_NOT_ENDED"
  | "ELIMINATED"
  | "NOT_LIVE"
  | "UNKNOWN";

export class AdminError extends Error {
  code: AdminErrorCode;
  constructor(message: string, code: AdminErrorCode) {
    super(message);
    this.code = code;
  }
}

function mapAdminErrorCode(sqlstate: string | undefined): AdminErrorCode {
  switch (sqlstate) {
    case "VI010": return "NOT_ADMIN";
    case "VI011": return "STAGE_LOCKED";
    case "VI012":
    case "VI002":
    case "P0001": return "TEAM_FULL";
    case "VI001": return "INVALID_CODE";
    case "VI003": return "ALREADY_REGISTERED";
    case "VI005": return "NAME_TAKEN";
    case "VI013": return "STAGE_NOT_ENDED";
    case "VI020": return "ELIMINATED";
    case "VI021": return "STAGE_LOCKED";
    case "VI022": return "NOT_LIVE";
    default: return "UNKNOWN";
  }
}

// Accepts the PostgREST builder directly (it's PromiseLike, not a strict
// Promise — supabase-js's .rpc() return type doesn't structurally match
// Promise<T> for TS, only duck-types as thenable).
async function callRpc<T>(builder: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await builder;
  if (error) {
    throw new AdminError(error.message, mapAdminErrorCode(error.code));
  }
  return data as T;
}

// ── Auth ──

export async function signInAdmin(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AdminError(error.message, "UNKNOWN");
  return data;
}

export async function signOutAdmin() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export async function getAdminSession() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAdminAuthStateChange(cb: (signedIn: boolean) => void) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(Boolean(session)));
  return () => data.subscription.unsubscribe();
}

export async function checkIsAdmin(): Promise<boolean> {
  try {
    return await callRpc(getSupabaseClient().rpc("is_admin", {}));
  } catch {
    return false;
  }
}

// ── Event control ──

export function adminSetStage(stage: number, durationSeconds: number) {
  return callRpc(getSupabaseClient().rpc("admin_set_stage", { p_stage: stage, p_duration_seconds: durationSeconds }));
}
export function adminPause() {
  return callRpc(getSupabaseClient().rpc("admin_pause", {}));
}
export function adminResume() {
  return callRpc(getSupabaseClient().rpc("admin_resume", {}));
}
export function adminExtend(seconds: number) {
  return callRpc(getSupabaseClient().rpc("admin_extend", { p_seconds: seconds }));
}
export function adminEndStage() {
  return callRpc(getSupabaseClient().rpc("admin_end_stage", {}));
}
export function adminSetEventStatus(status: "upcoming" | "live" | "paused" | "finished") {
  return callRpc(getSupabaseClient().rpc("admin_set_event_status", { p_status: status }));
}
export function adminSetAnnouncement(text: string) {
  return callRpc(getSupabaseClient().rpc("admin_set_announcement", { p_text: text }));
}
export function adminSetRegistrationDeadline(iso: string) {
  return callRpc(getSupabaseClient().rpc("admin_set_registration_deadline", { p_ts: iso }));
}
export function adminSetRegistrationClosed(closed: boolean) {
  return callRpc(getSupabaseClient().rpc("admin_set_registration_closed", { p_closed: closed }));
}
export function adminSetLeaderboardVisibility(mode: "public" | "hidden") {
  return callRpc(getSupabaseClient().rpc("admin_set_leaderboard_visibility", { p_mode: mode }));
}
export function adminRotateProjectorToken() {
  return callRpc(getSupabaseClient().rpc("admin_rotate_projector_token", {}));
}

// ── Scores ──

export function adminSetScore(teamId: string, stage: number, points: number, note?: string, force = false) {
  return callRpc(
    getSupabaseClient().rpc("admin_set_score", { p_team_id: teamId, p_stage: stage, p_points: points, p_note: note ?? null, p_force: force })
  );
}
export function adminUndoLastScore(teamId: string, stage: number) {
  return callRpc(getSupabaseClient().rpc("admin_undo_last_score", { p_team_id: teamId, p_stage: stage }));
}
export function adminLockStage(stage: number, locked: boolean) {
  return callRpc(getSupabaseClient().rpc("admin_lock_stage", { p_stage: stage, p_locked: locked }));
}
export function adminListScoreAudit(teamId?: string, stage?: number, limit = 100): Promise<ScoreAuditRow[]> {
  return callRpc(
    getSupabaseClient().rpc("admin_list_score_audit", { p_team_id: teamId ?? null, p_stage: stage ?? null, p_limit: limit })
  );
}

// ── Teams & members ──

export function adminGetTeams(): Promise<AdminTeamDetail[]> {
  return callRpc(getSupabaseClient().rpc("admin_get_teams", {}));
}
export function adminAddMember(teamId: string, name: string, regNo: string, email: string, phone?: string, section?: string, year?: number) {
  return callRpc(
    getSupabaseClient().rpc("admin_add_member", {
      p_team_id: teamId, p_name: name, p_reg_no: regNo, p_email: email,
      p_phone: phone ?? null, p_section: section ?? null, p_year: year ?? null,
    })
  );
}
export function adminRemoveMember(memberId: string) {
  return callRpc(getSupabaseClient().rpc("admin_remove_member", { p_member_id: memberId }));
}
export function adminMoveMember(memberId: string, toTeamId: string) {
  return callRpc(getSupabaseClient().rpc("admin_move_member", { p_member_id: memberId, p_to_team_id: toTeamId }));
}
export function adminRenameTeam(teamId: string, newName: string) {
  return callRpc(getSupabaseClient().rpc("admin_rename_team", { p_team_id: teamId, p_new_name: newName }));
}
export function adminDeleteTeam(teamId: string) {
  return callRpc(getSupabaseClient().rpc("admin_delete_team", { p_team_id: teamId }));
}

// ── Stage release / gating (Phase 3, Section C) ──

export function adminReleaseStage(stage: number) {
  return callRpc(getSupabaseClient().rpc("admin_release_stage", { p_stage: stage }));
}
export function adminSetTeamStageOverride(teamId: string, stage: number, allowed: boolean, note?: string) {
  return callRpc(
    getSupabaseClient().rpc("admin_set_team_stage_override", { p_team_id: teamId, p_stage: stage, p_allowed: allowed, p_note: note ?? null })
  );
}
export function adminSetRevealStageNames(reveal: boolean) {
  return callRpc(getSupabaseClient().rpc("admin_set_reveal_stage_names", { p_reveal: reveal }));
}
export function adminGetStageOverview(): Promise<AdminStageOverview> {
  return callRpc(getSupabaseClient().rpc("admin_get_stage_overview", {}));
}

// ── Qualification cutoffs (Phase 3, Section D) ──

export function adminPreviewCutoff(afterStage: number, keepMode: "half" | "count", keepValue?: number): Promise<CutoffPreview> {
  return callRpc(getSupabaseClient().rpc("admin_preview_cutoff", { p_after_stage: afterStage, p_keep_mode: keepMode, p_keep_value: keepValue ?? null }));
}
export function adminApplyCutoff(
  afterStage: number,
  keepMode: "half" | "count",
  keepValue?: number,
  extraInclude: string[] = [],
  extraExclude: string[] = [],
  advanceRule: "eliminate" | "display_only" = "eliminate"
) {
  return callRpc(
    getSupabaseClient().rpc("admin_apply_cutoff", {
      p_after_stage: afterStage, p_keep_mode: keepMode, p_keep_value: keepValue ?? null,
      p_extra_include: extraInclude, p_extra_exclude: extraExclude, p_advance_rule: advanceRule,
    })
  );
}
export function adminUndoCutoff(afterStage: number) {
  return callRpc(getSupabaseClient().rpc("admin_undo_cutoff", { p_after_stage: afterStage }));
}

// ── Stage assets / assignments (Phase 3, Section B) ──

export function adminGenerateStageAssignments(stageSlug: string) {
  return callRpc(getSupabaseClient().rpc("admin_generate_stage_assignments", { p_stage_slug: stageSlug }));
}
export function adminSetTeamAssignment(teamId: string, stageSlug: string, assetId: string) {
  return callRpc(getSupabaseClient().rpc("admin_set_team_assignment", { p_team_id: teamId, p_stage_slug: stageSlug, p_asset_id: assetId }));
}
export function adminGetStageAssignments(stageSlug: string) {
  return callRpc(getSupabaseClient().rpc("admin_get_stage_assignments", { p_stage_slug: stageSlug }));
}

// ── Submissions viewer + rubric judging (0012_submissions_rubric.sql) ──

export function adminListSubmissions(stageSlug?: string, teamId?: string) {
  return callRpc(getSupabaseClient().rpc("admin_list_submissions", { p_stage_slug: stageSlug ?? null, p_team_id: teamId ?? null }));
}
export function adminGetRubricScores(stageSlug: string) {
  return callRpc(getSupabaseClient().rpc("admin_get_rubric_scores", { p_stage_slug: stageSlug }));
}
export function adminSubmitRubricScore(teamId: string, stageSlug: string, criteria: Record<string, number>, comment?: string, force = false) {
  return callRpc(
    getSupabaseClient().rpc("admin_submit_rubric_score", {
      p_team_id: teamId,
      p_stage_slug: stageSlug,
      p_criteria: criteria,
      p_comment: comment ?? null,
      p_force: force,
    })
  );
}

// ── BugX password vault (0013_bugx_vault.sql) ──

// Admin types a plaintext answer once; it's hashed server-side
// (crypt()/bcrypt) and only the hash is ever stored — this never
// sends or stores the plaintext anywhere else.
export function adminSetBugxPassword(stageSlug: string, password: string) {
  return callRpc(getSupabaseClient().rpc("admin_set_bugx_password", { p_stage_slug: stageSlug, p_password: password }));
}

// ── Realtime subscription for admin lists (teams/members/scores/event_state) ──

export function subscribeAdminRealtime(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel("admin-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
