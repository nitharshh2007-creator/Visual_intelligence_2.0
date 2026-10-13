// ─────────────────────────────────────────────────────────────
// Stage access / content — student-facing RPC wrappers
// ─────────────────────────────────────────────────────────────
// Every call here goes through a SECURITY DEFINER RPC
// (supabase/migrations/0007_stage_release.sql, 0009_stage_content.sql)
// that enforces LOCKED/RELEASED/LIVE/COMPLETED/ELIMINATED server-side.
// There is no mock-mode fallback — the stage system only exists
// against the real backend (unlike registration/leaderboard, which
// predate it and still support offline/local dev).
//
// Team identity here is the SAME session as registration.ts's
// loadSession() (teamCode + regNo) — teams never sign in with
// Supabase Auth, so there's no cookie-based session to read
// server-side. The access control guarantee comes from the RPC
// refusing to return content, not from where the call is made; a
// client component calling these is exactly as leak-proof as a
// server component would be, since the browser never receives
// anything it isn't authorized to have.

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { StageAccessEntry, StageContentPayload } from "./supabase";

export type StageActionErrorCode = "INVALID_CODE" | "LOCKED" | "NOT_LIVE" | "ELIMINATED" | "NETWORK_ERROR" | "UNKNOWN";

function mapStageErrorCode(sqlstate: string | undefined): StageActionErrorCode {
  switch (sqlstate) {
    case "VI001": return "INVALID_CODE";
    case "VI021": return "LOCKED";
    case "VI022": return "NOT_LIVE";
    case "VI020": return "ELIMINATED";
    default: return sqlstate ? "UNKNOWN" : "NETWORK_ERROR";
  }
}

export class StageActionError extends Error {
  code: StageActionErrorCode;
  constructor(message: string, code: StageActionErrorCode) {
    super(message);
    this.code = code;
  }
}

// `code`/`regNo` omitted (or invalid) → anonymous view: released
// stage numbers only, names only if event_state.reveal_stage_names.
export async function getStageAccess(code?: string | null, regNo?: string | null): Promise<StageAccessEntry[]> {
  if (!isSupabaseConfigured()) {
    return [1, 2, 3, 4].map((stage) => ({
      stage,
      slug: "",
      name: null,
      state: "LOCKED" as const,
      reason: "not_released",
      stage_status: "not_released" as const,
    }));
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_stage_access", { p_code: code ?? null, p_reg_no: regNo ?? null });
  if (error || !data) return [];
  return data.stages;
}

export async function getStageContent(code: string, regNo: string, slug: string): Promise<StageContentPayload> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_stage_content", { p_code: code, p_reg_no: regNo, p_slug: slug });
  if (error || !data) {
    throw new StageActionError(error?.message ?? "Could not load stage content", mapStageErrorCode(error?.code));
  }
  return data;
}

export type CutResult = { afterStage: number; rank: number; total: number; totalTeams: number };

// null when the team hasn't been eliminated (never cut, or no cutoff
// applied yet, or 'display_only' policy — see migration 0009).
export async function getTeamCutResult(code: string, regNo: string): Promise<CutResult | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_team_cut_result", { p_code: code, p_reg_no: regNo });
  if (error || !data) return null;
  return { afterStage: data.after_stage, rank: data.rank, total: data.total, totalTeams: data.total_teams };
}

// BugX Hacker's password check (0013_bugx_vault.sql). A wrong guess
// is a normal result, not a thrown error — only a bad team identity
// or a stage that isn't LIVE raises, same codes as everywhere else.
export async function submitBugxPassword(
  code: string,
  regNo: string,
  slug: string,
  password: string
): Promise<{ success: boolean; alreadySolved: boolean; formUrl: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("submit_bugx_password", { p_code: code, p_reg_no: regNo, p_slug: slug, p_password: password });
  if (error || !data) {
    throw new StageActionError(error?.message ?? "Could not check password", mapStageErrorCode(error?.code));
  }
  return { success: data.success, alreadySolved: data.already_solved, formUrl: data.form_url };
}

export async function submitStageResult(
  code: string,
  regNo: string,
  slug: string,
  kind: "text" | "url",
  value: string
): Promise<{ ok: boolean; submissionId: string; version: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("submit_stage_result", {
    p_code: code,
    p_reg_no: regNo,
    p_slug: slug,
    p_kind: kind,
    p_text_value: kind === "text" ? value : null,
    p_url: kind === "url" ? value : null,
  });
  if (error || !data) {
    throw new StageActionError(error?.message ?? "Submission failed", mapStageErrorCode(error?.code));
  }
  return { ok: data.ok, submissionId: data.submission_id, version: data.version };
}
