// Judge rubric — source of truth: VI2_Judge_Marks_Sheets.xlsx ("READ ME - Judges"
// and the per-round sheets). Every round is out of 25. Used by the admin marks
// modal (client validation) and /api/admin/scores/entry (server validation).
//
// Final marks are the average of the room's 3 judges' totals (judge rule 3),
// so stored marks may be decimals — only the 0..max range is enforced.

export const STAGE_MAX = 25;

export interface RubricCriterion {
  key: string;
  label: string;
  hint: string;
  max: number;
}

export const RUBRICS: Record<number, RubricCriterion[]> = {
  1: [
    { key: "creativity", label: "Creativity / Originality", hint: "Fresh ideas, not a generic look", max: 5 },
    { key: "functionality", label: "Functionality", hint: "Page works: buttons, links, scripts", max: 5 },
    { key: "timing", label: "Timing", hint: "Submitted on time (Google Form time)", max: 5 },
    { key: "output", label: "Output", hint: "Final page clearly matches the theme", max: 5 },
    { key: "prompt_quality", label: "Prompt Quality", hint: "Clear, specific, refined prompts", max: 5 },
  ],
  2: [
    { key: "password", label: "Correct password", hint: "Password from the ZIP is right", max: 10 },
    { key: "code_word", label: "Correct code word", hint: "Code word from the PDF is right", max: 8 },
    { key: "speed", label: "Speed", hint: "≤8 min 7 · ≤12 min 5 · ≤16 min 3 · ≤20 min 1", max: 7 },
  ],
  3: [
    { key: "creativity", label: "Creativity", hint: "Original idea and treatment", max: 5 },
    { key: "assets", label: "Use of 3 images + 3 words", hint: "All six used, clearly visible", max: 5 },
    { key: "storytelling", label: "Storytelling", hint: "Clear beginning, point and ending in 30 sec", max: 5 },
    { key: "prompt_ai", label: "Prompt / AI usage", hint: "Smart, specific use of AI tools", max: 5 },
    { key: "ad_quality", label: "Final ad quality", hint: "Looks and sounds polished", max: 5 },
  ],
  4: [
    { key: "communication", label: "Communication", hint: "Describers explained well without naming it", max: 5 },
    { key: "prompt_quality", label: "Prompt quality", hint: "Guesser's prompt is clear and detailed", max: 5 },
    { key: "visual", label: "Visual interpretation", hint: "Understood the key parts of the picture", max: 5 },
    { key: "similarity", label: "Similarity to original", hint: "How close the image is to the original", max: 10 },
  ],
};

// Round 2 speed marks from the Form solve time (R2 BugX sheet): 8 min or less = 7,
// up to 12 = 5, up to 16 = 3, up to 20 = 1. The sheet gives no rule beyond
// 20 minutes, so null is returned and the admin enters speed by hand.
export function speedMarksForMinutes(minutes: number): number | null {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes <= 8) return 7;
  if (minutes <= 12) return 5;
  if (minutes <= 16) return 3;
  if (minutes <= 20) return 1;
  return null;
}

export interface ScoreEntryInput {
  stage: unknown;
  points: unknown;
  criteria?: unknown;
}

export interface ValidScoreEntry {
  stage: number;
  points: number;
  criteria?: Record<string, number>;
}

const EPSILON = 0.005;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function rubricTotal(stage: number, criteria: Record<string, number>): number {
  return round2((RUBRICS[stage] ?? []).reduce((sum, c) => sum + (criteria[c.key] ?? 0), 0));
}

// Validates one round's marks. Criteria are optional (a scorekeeper may type
// only the averaged total), but when any are given, all of that round's
// criteria must be present, each within 0..max, and the total must equal
// their sum.
export function validateScoreEntry(input: ScoreEntryInput): { ok: true; value: ValidScoreEntry } | { ok: false; error: string } {
  const stage = input.stage;
  if (typeof stage !== "number" || !Number.isInteger(stage) || !RUBRICS[stage]) {
    return { ok: false, error: "Stage must be 1, 2, 3 or 4." };
  }
  const points = input.points;
  if (typeof points !== "number" || !Number.isFinite(points)) {
    return { ok: false, error: "Marks must be a number." };
  }
  if (points < 0 || points > STAGE_MAX) {
    return { ok: false, error: `Marks must be between 0 and ${STAGE_MAX}.` };
  }

  if (input.criteria === undefined || input.criteria === null) {
    return { ok: true, value: { stage, points: round2(points) } };
  }
  if (typeof input.criteria !== "object" || Array.isArray(input.criteria)) {
    return { ok: false, error: "Rubric marks must be an object." };
  }
  const given = input.criteria as Record<string, unknown>;
  const rubric = RUBRICS[stage];
  const unknownKey = Object.keys(given).find((k) => !rubric.some((c) => c.key === k));
  if (unknownKey) return { ok: false, error: `"${unknownKey}" is not a Round ${stage} criterion.` };

  const criteria: Record<string, number> = {};
  for (const c of rubric) {
    const v = given[c.key];
    if (v === undefined || v === null) {
      return { ok: false, error: `Enter ${c.label} (0–${c.max}) — every criterion is needed when using the rubric.` };
    }
    if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: `${c.label} must be a number.` };
    if (v < 0 || v > c.max) return { ok: false, error: `${c.label} must be between 0 and ${c.max}.` };
    criteria[c.key] = round2(v);
  }
  const sum = rubricTotal(stage, criteria);
  if (Math.abs(sum - points) > EPSILON) {
    return { ok: false, error: `Total ${points} does not match the rubric sum ${sum}.` };
  }
  return { ok: true, value: { stage, points: sum, criteria } };
}
