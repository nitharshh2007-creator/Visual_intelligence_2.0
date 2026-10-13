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
import type { AdminTeamDetail, ScoreAuditRow, AdminStageOverview, CutoffPreview, ShortlistConfig, PreliminaryScoreRow, EventStateRow } from "./supabase";

export type AdminErrorCode =
  | "NOT_ADMIN"
  | "STAGE_LOCKED"
  | "TEAM_FULL"
  | "INVALID_CODE"
  | "ALREADY_REGISTERED"
  | "NAME_TAKEN"
  | "STAGE_NOT_ENDED"
  | "ELIMINATED"
  | "BELOW_CUTOFF"
  | "NOT_SHORTLISTED"
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
    case "VI030": return "BELOW_CUTOFF";
    case "VI031": return "NOT_SHORTLISTED";
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
export async function adminSetEventStatus(status: "upcoming" | "live" | "paused" | "finished"): Promise<EventStateRow> {
  const supabase = getSupabaseClient();
  await callRpc(supabase.rpc("admin_set_event_status", { p_status: status }));

  const { data: savedState, error: savedStateError } = await supabase
    .from("event_state")
    .select("*")
    .eq("id" as never, 1)
    .single();

  if (savedStateError) throw new AdminError(savedStateError.message, "UNKNOWN");
  if (savedState.status !== status) {
    throw new AdminError(`The database still reports the event as ${savedState.status}.`, "UNKNOWN");
  }
  return savedState;
}
// Resets every stage to released and clears the previous run's cutoffs
// (migration 0029). The saved row is re-read so the caller only reports
// success once the database confirms the reset.
export async function adminRestartEvent(): Promise<EventStateRow> {
  const supabase = getSupabaseClient();
  await callRpc(supabase.rpc("admin_restart_event", {}));

  const { data: savedState, error: savedStateError } = await supabase
    .from("event_state")
    .select("*")
    .eq("id" as never, 1)
    .single();

  if (savedStateError) throw new AdminError(savedStateError.message, "UNKNOWN");
  if (savedState.status !== "live" || savedState.current_stage !== 0 || savedState.current_round !== 0) {
    throw new AdminError("The database did not confirm the event restart.", "UNKNOWN");
  }
  return savedState;
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
export function adminSavePreliminaryScores(
  teamId: string,
  s1: number | null,
  s2: number | null,
  updateS1: boolean,
  updateS2: boolean
) {
  return callRpc(getSupabaseClient().rpc("admin_save_preliminary_scores", {
    p_team_id: teamId,
    p_s1: s1,
    p_s2: s2,
    p_update_s1: updateS1,
    p_update_s2: updateS2,
  }));
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

// ── Shortlisting ──

export function adminGetShortlistConfig(): Promise<ShortlistConfig> {
  return callRpc(getSupabaseClient().rpc("admin_get_shortlist_config", {}));
}
export function adminSetShortlistConfig(combinedCutoff: number, stage1Min = 0, stage2Min = 0) {
  return callRpc(getSupabaseClient().rpc("admin_set_shortlist_config", {
    p_combined_cutoff: combinedCutoff, p_stage1_min: stage1Min, p_stage2_min: stage2Min,
  }));
}
export function adminGetPreliminaryScores(): Promise<PreliminaryScoreRow[]> {
  return callRpc(getSupabaseClient().rpc("admin_get_preliminary_scores", {}));
}
export function adminSetShortlistDecision(
  teamId: string, decision: "shortlisted" | "rejected" | "on_hold",
  note?: string, forceOverride = false
) {
  return callRpc(getSupabaseClient().rpc("admin_set_shortlist_decision", {
    p_team_id: teamId, p_decision: decision,
    p_note: note ?? null, p_force_override: forceOverride,
  }));
}
export function adminBulkShortlistTeams(teamIds: string[]) {
  return callRpc(getSupabaseClient().rpc("admin_bulk_shortlist_teams", { p_team_ids: teamIds }));
}

// ── Master Team Directory & Dedicated Shortlisting Dashboards ──

export interface MasterTeamRecord {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  member_count: number;
  members: Array<{
    id: string;
    name: string;
    reg_no: string;
    email: string;
    phone: string | null;
    section: string | null;
    year: number | null;
    role: string;
  }>;
  scores: {
    s1: number | null;
    s2: number | null;
    combined_prelim: number | null;
    s3: number | null;
    s4: number | null;
    total: number;
  };
  level1_status: "participating" | "completed";
  level2_status: "eligible" | "pending" | "completed";
  shortlist_l3: {
    decision: "shortlisted" | "rejected" | "on_hold" | "undecided";
    is_override: boolean;
    note: string | null;
    decided_at: string | null;
    decided_by: string | null;
  };
  shortlist_l4: {
    qualified: boolean;
    rank_at_cut: number | null;
    total_at_cut: number | null;
    reason: string | null;
    decided_at: string | null;
  };
  current_level: 1 | 2 | 3 | 4;
  overall_status: "participating" | "qualified" | "not_shortlisted" | "eliminated" | "completed" | "pending";
  elimination_info: {
    level: number | null;
    reason: string | null;
    decided_at: string | null;
  } | null;
}

export interface MasterShortlistResponse {
  teams: MasterTeamRecord[];
  stats: {
    total: number;
    level1: number;
    level2: number;
    level3_shortlisted: number;
    level4_finalists: number;
    eliminated: number;
  };
  event_state: EventStateRow | null;
  config: ShortlistConfig;
}

export async function adminGetMasterTeamDirectory(): Promise<MasterShortlistResponse> {
  const res = await fetch("/api/admin/shortlist", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new AdminError(err.error || "Failed to fetch master team directory", "UNKNOWN");
  }
  return res.json();
}

export async function adminSaveLevel3Shortlist(
  selectedTeamIds: string[],
  targetQuota = 10,
  unselectedReasons?: Record<string, string>,
  confirmedWarning = false
) {
  const res = await fetch("/api/admin/shortlist/level3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selected_team_ids: selectedTeamIds,
      target_quota: targetQuota,
      unselected_reasons: unselectedReasons,
      confirmed_warning: confirmedWarning,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 422 && data.warning) {
      return { warning: true, message: data.message, target_quota: data.target_quota, selected_count: data.selected_count };
    }
    throw new AdminError(data.error || "Failed to save Level 3 shortlist", "UNKNOWN");
  }
  return data;
}

export async function adminConfirmLevel4Finalists(finalistTeamIds: string[], notes?: string) {
  const res = await fetch("/api/admin/shortlist/level4", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalist_team_ids: finalistTeamIds, notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminError(data.error || "Failed to confirm Level 4 finalists", "UNKNOWN");
  }
  return data;
}

export async function adminRecordScoreEntry(
  teamId: string,
  stage: number,
  points: number,
  note?: string,
  criteria?: Record<string, number>
) {
  const res = await fetch("/api/admin/scores/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team_id: teamId, stage, points, note, criteria }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminError(data.error || "Failed to record score entry", "UNKNOWN");
  }
  return data;
}

export async function adminUpdateEliminationReason(teamId: string, stage: number, reason: string) {
  const res = await fetch("/api/admin/eliminations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team_id: teamId, stage, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminError(data.error || "Failed to update elimination reason", "UNKNOWN");
  }
  return data;
}

// ── Realtime subscription for admin lists (teams/members/scores/event_state) ──

export function subscribeAdminRealtime(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channelName = `admin-realtime-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "qualifiers" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shortlist" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

