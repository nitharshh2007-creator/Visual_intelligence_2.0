import { describe, expect, it } from "vitest";
import { RUBRICS, STAGE_MAX, rubricTotal, speedMarksForMinutes, validateScoreEntry } from "./scoring";

const full = (stage: number, value: (max: number) => number) =>
  Object.fromEntries(RUBRICS[stage].map((c) => [c.key, value(c.max)]));

describe("rubrics match VI2_Judge_Marks_Sheets.xlsx", () => {
  it("has the judge-sheet criteria and maximums, each round out of 25", () => {
    const shape = (s: number) => RUBRICS[s].map((c) => [c.label, c.max]);
    expect(shape(1)).toEqual([["Creativity / Originality", 5], ["Functionality", 5], ["Timing", 5], ["Output", 5], ["Prompt Quality", 5]]);
    expect(shape(2)).toEqual([["Correct password", 10], ["Correct code word", 8], ["Speed", 7]]);
    expect(shape(3)).toEqual([["Creativity", 5], ["Use of 3 images + 3 words", 5], ["Storytelling", 5], ["Prompt / AI usage", 5], ["Final ad quality", 5]]);
    expect(shape(4)).toEqual([["Communication", 5], ["Prompt quality", 5], ["Visual interpretation", 5], ["Similarity to original", 10]]);
    for (const s of [1, 2, 3, 4]) expect(RUBRICS[s].reduce((a, c) => a + c.max, 0)).toBe(STAGE_MAX);
  });

  it("applies the Round 2 speed rule and invents nothing past 20 minutes", () => {
    expect([0, 8, 8.01, 12, 12.5, 16, 16.1, 20].map(speedMarksForMinutes)).toEqual([7, 7, 5, 5, 3, 3, 1, 1]);
    expect(speedMarksForMinutes(20.5)).toBeNull();
    expect(speedMarksForMinutes(-1)).toBeNull();
    expect(speedMarksForMinutes(NaN)).toBeNull();
  });
});

describe("validateScoreEntry", () => {
  it("accepts a full rubric whose total matches", () => {
    const criteria = { password: 10, code_word: 6, speed: 5 };
    expect(validateScoreEntry({ stage: 2, points: 21, criteria })).toEqual({ ok: true, value: { stage: 2, points: 21, criteria } });
    expect(rubricTotal(2, criteria)).toBe(21);
  });

  it("accepts a total-only entry, including averaged decimals", () => {
    expect(validateScoreEntry({ stage: 1, points: 21.33 })).toEqual({ ok: true, value: { stage: 1, points: 21.33 } });
    expect(validateScoreEntry({ stage: 4, points: 0 }).ok).toBe(true);
    expect(validateScoreEntry({ stage: 4, points: 25 }).ok).toBe(true);
  });

  it("rejects totals above 25 or below 0, and non-numbers", () => {
    expect(validateScoreEntry({ stage: 1, points: 25.5 })).toMatchObject({ ok: false });
    expect(validateScoreEntry({ stage: 1, points: -1 })).toMatchObject({ ok: false });
    expect(validateScoreEntry({ stage: 1, points: NaN })).toMatchObject({ ok: false });
    expect(validateScoreEntry({ stage: 1, points: "20" })).toMatchObject({ ok: false });
  });

  it("rejects an invalid stage", () => {
    for (const stage of [0, 5, 1.5, "1", null]) expect(validateScoreEntry({ stage, points: 10 }).ok).toBe(false);
  });

  it("rejects any criterion above its maximum or negative", () => {
    expect(validateScoreEntry({ stage: 2, points: 25, criteria: { password: 11, code_word: 7, speed: 7 } })).toMatchObject({ ok: false, error: expect.stringContaining("Correct password") });
    expect(validateScoreEntry({ stage: 4, points: 5, criteria: { communication: -1, prompt_quality: 1, visual: 1, similarity: 4 } })).toMatchObject({ ok: false });
    expect(validateScoreEntry({ stage: 4, points: 21, criteria: { communication: 5, prompt_quality: 5, visual: 5, similarity: 11 } })).toMatchObject({ ok: false });
  });

  it("rejects a partial rubric, unknown criteria, and totals that don't match the sum", () => {
    expect(validateScoreEntry({ stage: 1, points: 8, criteria: { creativity: 4, functionality: 4 } })).toMatchObject({ ok: false, error: expect.stringContaining("every criterion") });
    expect(validateScoreEntry({ stage: 1, points: 25, criteria: { ...full(1, (m) => m), speed: 1 } })).toMatchObject({ ok: false, error: expect.stringContaining("not a Round 1 criterion") });
    expect(validateScoreEntry({ stage: 3, points: 24, criteria: full(3, (m) => m) })).toMatchObject({ ok: false, error: expect.stringContaining("does not match") });
  });
});
