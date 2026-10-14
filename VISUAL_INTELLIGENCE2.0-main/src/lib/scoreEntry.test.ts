import { describe, expect, it } from "vitest";
import { saveScoreEntry, type ScoreRow, type ScoreStore } from "./scoreEntry";

type Fail = Partial<Record<keyof ScoreStore | "upsertUnconfirmed" | "undo", boolean>>;

function fakeStore(opts: { existing?: ScoreRow; decision?: string | null; qualified?: boolean; fail?: Fail } = {}) {
  const fail = opts.fail ?? {};
  const state = { score: opts.existing ? { ...opts.existing } : (null as ScoreRow | null), audits: [] as unknown[], upserts: 0 };
  const err = (on?: boolean) => (on ? { message: "db down" } : null);
  const store: ScoreStore = {
    async getShortlistDecision() { return { data: opts.decision ?? null, error: err(fail.getShortlistDecision) }; },
    async isQualifiedAfterRound3() { return { data: Boolean(opts.qualified), error: err(fail.isQualifiedAfterRound3) }; },
    async getScore() { return { data: state.score, error: err(fail.getScore) }; },
    async upsertScore(row) {
      state.upserts++;
      const isUndo = state.upserts > 1;
      if ((isUndo && fail.undo) || (!isUndo && fail.upsertScore)) return { data: null, error: { message: "write failed" } };
      if (!isUndo && fail.upsertUnconfirmed) return { data: null, error: null };
      state.score = { points: row.points, detail: row.detail, updated_at: row.updated_at };
      return { data: { points: row.points }, error: null };
    },
    async deleteScore() {
      if (fail.undo) return { error: { message: "delete failed" } };
      state.score = null;
      return { error: null };
    },
    async insertAudit(row) {
      if (fail.insertAudit) return { error: { message: "audit failed" } };
      state.audits.push(row);
      return { error: null };
    },
  };
  return { store, state };
}

const R1 = { team_id: "t1", stage: 1, points: 21, criteria: { creativity: 4, functionality: 5, timing: 3, output: 4, prompt_quality: 5 } };

describe("saveScoreEntry", () => {
  it("saves marks with the rubric and an audit row carrying old and new points", async () => {
    const { store, state } = fakeStore({ existing: { points: 12, detail: null, updated_at: "2026-10-14T08:00:00Z" } });
    const res = await saveScoreEntry(store, { ...R1, note: "avg of 3 judges" }, "admin-1");
    expect(res).toEqual({ ok: true, team_id: "t1", stage: 1, points: 21 });
    expect(state.score?.detail).toEqual({ criteria: R1.criteria, note: "avg of 3 judges" });
    expect(state.audits).toEqual([{ team_id: "t1", stage: 1, old_points: 12, new_points: 21, note: "avg of 3 judges", admin_id: "admin-1" }]);
  });

  it("rejects invalid marks before touching the database", async () => {
    const { store, state } = fakeStore();
    expect(await saveScoreEntry(store, { team_id: "t1", stage: 1, points: 26 }, "a")).toMatchObject({ ok: false, status: 400 });
    expect(await saveScoreEntry(store, { team_id: "t1", stage: 2, points: 25, criteria: { password: 10, code_word: 9, speed: 6 } }, "a")).toMatchObject({ ok: false, status: 400 });
    expect(await saveScoreEntry(store, { stage: 1, points: 10 }, "a")).toMatchObject({ ok: false, status: 400 });
    expect(state.upserts).toBe(0);
  });

  it("keeps the Level 3/4 eligibility checks", async () => {
    expect(await saveScoreEntry(fakeStore({ decision: "rejected" }).store, { team_id: "t", stage: 3, points: 10 }, "a")).toMatchObject({ ok: false, status: 400 });
    expect(await saveScoreEntry(fakeStore({ decision: "shortlisted", qualified: false }).store, { team_id: "t", stage: 4, points: 10 }, "a")).toMatchObject({ ok: false, status: 400 });
    expect(await saveScoreEntry(fakeStore({ decision: "shortlisted", qualified: true }).store, { team_id: "t", stage: 4, points: 10 }, "a")).toMatchObject({ ok: true });
  });

  it("reports failure (not success) when the score write fails", async () => {
    const { store, state } = fakeStore({ fail: { upsertScore: true } });
    expect(await saveScoreEntry(store, R1, "a")).toMatchObject({ ok: false, status: 500, error: expect.stringContaining("not saved") });
    expect(state.audits).toEqual([]);
  });

  it("reports failure when the database does not confirm the write", async () => {
    const { store } = fakeStore({ fail: { upsertUnconfirmed: true } });
    expect(await saveScoreEntry(store, R1, "a")).toMatchObject({ ok: false, status: 500 });
  });

  it("fails safely when an eligibility read fails", async () => {
    const { store, state } = fakeStore({ fail: { getShortlistDecision: true } });
    expect(await saveScoreEntry(store, { team_id: "t", stage: 3, points: 10 }, "a")).toMatchObject({ ok: false, status: 500 });
    expect(state.upserts).toBe(0);
  });

  it("rolls the previous marks back when the audit row can't be written", async () => {
    const prev = { points: 12, detail: { note: "old" }, updated_at: "2026-10-14T08:00:00Z" };
    const { store, state } = fakeStore({ existing: prev, fail: { insertAudit: true } });
    expect(await saveScoreEntry(store, R1, "a")).toMatchObject({ ok: false, status: 500, error: expect.stringContaining("audit history") });
    expect(state.score).toEqual(prev);
  });

  it("removes a brand-new score when its audit row can't be written", async () => {
    const { store, state } = fakeStore({ fail: { insertAudit: true } });
    expect(await saveScoreEntry(store, R1, "a")).toMatchObject({ ok: false });
    expect(state.score).toBeNull();
  });

  it("says so explicitly if the rollback also fails", async () => {
    const { store } = fakeStore({ fail: { insertAudit: true, undo: true } });
    expect(await saveScoreEntry(store, R1, "a")).toMatchObject({ ok: false, error: expect.stringContaining("could not be rolled back") });
  });
});
