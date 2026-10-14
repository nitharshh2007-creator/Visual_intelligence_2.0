import { describe, expect, it } from "vitest";
import { planRound3Decisions, recommendAfterRound2, recommendAfterRound3, type RankableTeam } from "./shortlistRanking";

const team = (id: string, s1: number | null, s2: number | null, extra: Partial<RankableTeam> = {}): RankableTeam => ({
  id, name: `Team ${id}`, status: "full", scores: { s1, s2, s3: null }, l3Decision: "undecided", ...extra,
});
const r3 = (id: string, s3: number | null, l3Decision = "shortlisted"): RankableTeam => ({
  id, name: `Team ${id}`, status: "full", scores: { s1: 10, s2: 10, s3 }, l3Decision,
});

describe("recommendAfterRound2 (Round 1 + Round 2, top N)", () => {
  it("ranks by combined marks out of 50 with both round scores", () => {
    const rec = recommendAfterRound2([team("a", 20, 15), team("b", 25, 24.5), team("c", 10, 10)], 2);
    expect(rec.ranked.map((r) => [r.teamId, r.rank, r.value, r.parts])).toEqual([
      ["b", 1, 49.5, { r1: 25, r2: 24.5 }],
      ["a", 2, 35, { r1: 20, r2: 15 }],
      ["c", 3, 20, { r1: 10, r2: 10 }],
    ]);
    expect(rec.recommendedIds).toEqual(["b", "a"]);
    expect(rec.tiedAtCutoffIds).toEqual([]);
  });

  it("never counts a missing mark as zero — lists it as missing instead", () => {
    const rec = recommendAfterRound2([team("a", 5, 5), team("b", 25, null), team("c", null, null)], 25);
    expect(rec.ranked.map((r) => r.teamId)).toEqual(["a"]);
    expect(rec.missing).toEqual([
      { teamId: "b", name: "Team b", missing: ["Round 2"] },
      { teamId: "c", name: "Team c", missing: ["Round 1", "Round 2"] },
    ]);
    expect(rec.recommendedIds).toEqual(["a"]);
  });

  it("excludes teams that never completed registration", () => {
    const rec = recommendAfterRound2([team("a", 20, 20), team("b", 25, 25, { status: "incomplete" })], 25);
    expect(rec.ranked.map((r) => r.teamId)).toEqual(["a"]);
    expect(rec.missing).toEqual([]);
  });

  it("recommends everyone when fewer than N teams are scored", () => {
    const rec = recommendAfterRound2([team("a", 1, 1), team("b", 2, 2)], 25);
    expect(rec.recommendedIds.sort()).toEqual(["a", "b"]);
    expect(rec.openSlots).toBe(0);
  });

  it("shares ranks for equal totals (1, 2, 2, 4)", () => {
    const rec = recommendAfterRound2([team("a", 25, 25), team("b", 20, 20), team("c", 30 - 10, 20), team("d", 10, 10)], 4);
    expect(rec.ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("flags a tie straddling the cutoff instead of deciding it", () => {
    const teams = [team("a", 25, 25), team("b", 20, 20), team("c", 20, 20), team("d", 15, 25), team("e", 5, 5)];
    const rec = recommendAfterRound2(teams, 2); // a clear; b, c, d tie at 40 for 1 slot
    expect(rec.recommendedIds).toEqual(["a"]);
    expect(rec.tiedAtCutoffIds.sort()).toEqual(["b", "c", "d"]);
    expect(rec.openSlots).toBe(1);
    expect(rec.ranked.find((r) => r.teamId === "e")).toMatchObject({ recommended: false, tiedAtCutoff: false });
  });

  it("does not flag a tie that sits fully inside the cutoff", () => {
    const rec = recommendAfterRound2([team("a", 20, 20), team("b", 20, 20), team("c", 5, 5)], 2);
    expect(rec.recommendedIds.sort()).toEqual(["a", "b"]);
    expect(rec.tiedAtCutoffIds).toEqual([]);
  });

  it("defaults to the top 25", () => {
    const teams = Array.from({ length: 30 }, (_, i) => team(String(i).padStart(2, "0"), i, 0));
    const rec = recommendAfterRound2(teams);
    expect(rec.topN).toBe(25);
    expect(rec.recommendedIds).toHaveLength(25);
    expect(rec.recommendedIds).not.toContain("00");
  });
});

describe("recommendAfterRound3 (Round 3, top N)", () => {
  it("ranks only teams officially shortlisted for Round 3", () => {
    const rec = recommendAfterRound3([r3("a", 20), r3("b", 25, "rejected"), r3("c", 22, "undecided"), r3("d", 10)], 10);
    expect(rec.ranked.map((r) => r.teamId)).toEqual(["a", "d"]);
    expect(rec.recommendedIds).toEqual(["a", "d"]);
  });

  it("lists shortlisted teams without a Round 3 mark as missing", () => {
    const rec = recommendAfterRound3([r3("a", 20), r3("b", null), r3("c", null, "rejected")], 10);
    expect(rec.missing).toEqual([{ teamId: "b", name: "Team b", missing: ["Round 3"] }]);
  });

  it("defaults to the top 10 and flags cutoff ties", () => {
    const teams = Array.from({ length: 12 }, (_, i) => r3(`t${String(i).padStart(2, "0")}`, 25 - i));
    teams[10] = r3("t10", 16); // ties with t09 (16) at the 10th place
    const rec = recommendAfterRound3(teams);
    expect(rec.topN).toBe(10);
    expect(rec.recommendedIds).toHaveLength(9);
    expect(rec.tiedAtCutoffIds.sort()).toEqual(["t09", "t10"]);
    expect(rec.openSlots).toBe(1);
  });
});

describe("planRound3Decisions (runs only on the admin's confirm)", () => {
  const teams = [
    { id: "a", l3Decision: "undecided" },
    { id: "b", l3Decision: "shortlisted" },
    { id: "c", l3Decision: "rejected" },
    { id: "d", l3Decision: "undecided" },
  ];

  it("writes the admin's final selection, including manual changes to the recommendation", () => {
    const recommended = new Set(["a", "b"]);
    const finalSelection = new Set(recommended);
    finalSelection.delete("a"); // admin un-ticks a recommended team
    finalSelection.add("c"); //    and ticks a non-recommended one
    expect(planRound3Decisions(teams, finalSelection, "Below Level 2 cutoff (40)")).toEqual([
      { teamId: "a", decision: "rejected", note: "Below Level 2 cutoff (40)" },
      { teamId: "c", decision: "shortlisted", override: true },
      { teamId: "d", decision: "rejected", note: "Below Level 2 cutoff (40)" },
    ]);
  });

  it("skips teams whose saved decision already matches", () => {
    expect(planRound3Decisions(teams, new Set(["b"]), "x").map((w) => w.teamId)).toEqual(["a", "d"]);
  });

  it("recommendations themselves never produce writes", () => {
    const rec = recommendAfterRound2([team("a", 20, 20)], 25);
    expect(Object.keys(rec).sort()).toEqual(["missing", "openSlots", "ranked", "recommendedIds", "tiedAtCutoffIds", "topN"]);
  });
});
