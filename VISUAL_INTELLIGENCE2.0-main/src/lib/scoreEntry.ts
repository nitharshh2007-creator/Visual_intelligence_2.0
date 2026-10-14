// Server-side marks save for /api/admin/scores/entry. The storage calls are
// behind a small interface so the write-verification and rollback logic is
// unit-testable without a database.

import { validateScoreEntry } from "./scoring";

type DbError = { message: string } | null;

export interface ScoreRow {
  points: number;
  detail: unknown;
  updated_at: string | null;
}

export interface ScoreStore {
  getShortlistDecision(teamId: string): Promise<{ data: string | null; error: DbError }>;
  isQualifiedAfterRound3(teamId: string): Promise<{ data: boolean; error: DbError }>;
  getScore(teamId: string, stage: number): Promise<{ data: ScoreRow | null; error: DbError }>;
  upsertScore(row: { team_id: string; stage: number; points: number; detail: unknown; updated_at: string }): Promise<{ data: { points: number } | null; error: DbError }>;
  deleteScore(teamId: string, stage: number): Promise<{ error: DbError }>;
  insertAudit(row: { team_id: string; stage: number; old_points: number | null; new_points: number; note: string | null; admin_id: string }): Promise<{ error: DbError }>;
}

export interface ScoreEntryRequest {
  team_id?: unknown;
  stage?: unknown;
  points?: unknown;
  note?: unknown;
  criteria?: unknown;
}

export type ScoreEntryResult =
  | { ok: true; team_id: string; stage: number; points: number }
  | { ok: false; status: number; error: string };

export async function saveScoreEntry(store: ScoreStore, body: ScoreEntryRequest, adminId: string): Promise<ScoreEntryResult> {
  const teamId = typeof body.team_id === "string" ? body.team_id.trim() : "";
  if (!teamId) return { ok: false, status: 400, error: "team_id is required." };
  const checked = validateScoreEntry({ stage: body.stage, points: body.points, criteria: body.criteria });
  if (!checked.ok) return { ok: false, status: 400, error: checked.error };
  const { stage, points, criteria } = checked.value;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  // Level 3 marks only for shortlisted teams, Level 4 only for teams qualified after Level 3.
  if (stage >= 3) {
    const sl = await store.getShortlistDecision(teamId);
    if (sl.error) return { ok: false, status: 500, error: `Could not verify Level 3 eligibility: ${sl.error.message}` };
    if (sl.data !== "shortlisted") {
      return { ok: false, status: 400, error: "Only teams shortlisted after Level 2 can get Level 3/4 marks." };
    }
  }
  if (stage === 4) {
    const q = await store.isQualifiedAfterRound3(teamId);
    if (q.error) return { ok: false, status: 500, error: `Could not verify Level 4 eligibility: ${q.error.message}` };
    if (!q.data) return { ok: false, status: 400, error: "Only teams selected after Level 3 can get Level 4 marks." };
  }

  const previous = await store.getScore(teamId, stage);
  if (previous.error) return { ok: false, status: 500, error: `Could not read the current marks: ${previous.error.message}` };

  const saved = await store.upsertScore({
    team_id: teamId,
    stage,
    points,
    detail: criteria ? { criteria, note } : note ? { note } : null,
    updated_at: new Date().toISOString(),
  });
  if (saved.error || !saved.data || Math.abs(Number(saved.data.points) - points) > 0.005) {
    return { ok: false, status: 500, error: `Marks were not saved${saved.error ? `: ${saved.error.message}` : " (the database did not confirm the write)."}` };
  }

  const audit = await store.insertAudit({
    team_id: teamId,
    stage,
    old_points: previous.data ? Number(previous.data.points) : null,
    new_points: points,
    note: note ?? (criteria ? JSON.stringify(criteria) : null),
    admin_id: adminId,
  });
  if (audit.error) {
    // Never leave a mark without its audit history: put the previous state back.
    const undo = previous.data
      ? await store.upsertScore({
          team_id: teamId,
          stage,
          points: Number(previous.data.points),
          detail: previous.data.detail,
          updated_at: previous.data.updated_at ?? new Date().toISOString(),
        })
      : await store.deleteScore(teamId, stage);
    return {
      ok: false,
      status: 500,
      error: undo.error
        ? `Audit history could not be written (${audit.error.message}) and the marks could not be rolled back — check this team's Level ${stage} marks.`
        : `Marks were not saved: audit history could not be written (${audit.error.message}).`,
    };
  }

  return { ok: true, team_id: teamId, stage, points };
}

// Supabase adapter (service-role client from the route handler).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function supabaseScoreStore(client: any): ScoreStore {
  return {
    async getShortlistDecision(teamId) {
      const { data, error } = await client.from("shortlist").select("decision").eq("team_id", teamId).maybeSingle();
      return { data: data?.decision ?? null, error };
    },
    async isQualifiedAfterRound3(teamId) {
      const { data, error } = await client.from("qualifiers").select("team_id").eq("team_id", teamId).eq("after_stage", 3).maybeSingle();
      return { data: Boolean(data), error };
    },
    async getScore(teamId, stage) {
      const { data, error } = await client.from("scores").select("points, detail, updated_at").eq("team_id", teamId).eq("stage", stage).maybeSingle();
      return { data: data ?? null, error };
    },
    async upsertScore(row) {
      const { data, error } = await client.from("scores").upsert(row, { onConflict: "team_id,stage" }).select("points").single();
      return { data: data ?? null, error };
    },
    async deleteScore(teamId, stage) {
      const { error } = await client.from("scores").delete().eq("team_id", teamId).eq("stage", stage);
      return { error };
    },
    async insertAudit(row) {
      const { error } = await client.from("score_audit").insert(row);
      return { error };
    },
  };
}
