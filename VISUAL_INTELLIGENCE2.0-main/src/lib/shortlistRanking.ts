// Shortlist recommendations — pure functions, no side effects. They only
// suggest a selection; the admin reviews/edits it and nothing reaches the
// database until the existing confirm step runs.
//
//   After Round 2: eligible teams ranked by Round 1 + Round 2 (out of 50) → top 25.
//   After Round 3: teams shortlisted for Round 3 ranked by Round 3 (out of 25) → top 10.
//
// A missing mark is never treated as zero: such teams are listed as missing
// and left out of the ranking. The judge sheets define no tie-break for these
// two rankings, so equal marks share a rank and a tie straddling the cutoff
// is flagged for the admin instead of being decided here.

export const DEFAULT_TOP_AFTER_ROUND_2 = 25;
export const DEFAULT_TOP_AFTER_ROUND_3 = 10;

export interface RankableTeam {
  id: string;
  name: string;
  status: string; // teams.status: incomplete | ready | full
  scores: { s1: number | null; s2: number | null; s3: number | null };
  l3Decision: string; // shortlist decision after Round 2
}

export interface RankedTeam {
  teamId: string;
  name: string;
  rank: number;
  value: number; // the ranked total (R1+R2, or R3)
  parts: Record<string, number>;
  recommended: boolean;
  tiedAtCutoff: boolean;
}

export interface MissingEvaluation {
  teamId: string;
  name: string;
  missing: string[]; // e.g. ["Round 1"]
}

export interface Recommendation {
  topN: number;
  ranked: RankedTeam[];
  missing: MissingEvaluation[];
  recommendedIds: string[];
  tiedAtCutoffIds: string[];
  /** Slots inside the top N left for the admin to fill from the tied group. */
  openSlots: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function recommend(
  rows: { teamId: string; name: string; value: number; parts: Record<string, number> }[],
  missing: MissingEvaluation[],
  topN: number
): Recommendation {
  const n = Math.max(0, Math.floor(topN));
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  // Standard competition ranking: 1, 2, 2, 4 …
  const rankOf = (v: number) => 1 + sorted.filter((r) => r.value > v).length;

  let recommended = new Set<string>();
  let tied = new Set<string>();
  if (sorted.length <= n) {
    recommended = new Set(sorted.map((r) => r.teamId));
  } else if (n > 0) {
    const boundary = sorted[n - 1].value;
    const next = sorted[n].value;
    if (next < boundary) {
      recommended = new Set(sorted.slice(0, n).map((r) => r.teamId));
    } else {
      recommended = new Set(sorted.filter((r) => r.value > boundary).map((r) => r.teamId));
      tied = new Set(sorted.filter((r) => r.value === boundary).map((r) => r.teamId));
    }
  }

  const ranked = sorted.map((r) => ({
    teamId: r.teamId,
    name: r.name,
    rank: rankOf(r.value),
    value: r.value,
    parts: r.parts,
    recommended: recommended.has(r.teamId),
    tiedAtCutoff: tied.has(r.teamId),
  }));
  return {
    topN: n,
    ranked,
    missing: [...missing].sort((a, b) => a.name.localeCompare(b.name)),
    recommendedIds: ranked.filter((r) => r.recommended).map((r) => r.teamId),
    tiedAtCutoffIds: ranked.filter((r) => r.tiedAtCutoff).map((r) => r.teamId),
    openSlots: tied.size ? n - recommended.size : 0,
  };
}

/** Round 1 + Round 2 combined ranking for registered (ready/full) teams. */
export function recommendAfterRound2(teams: RankableTeam[], topN = DEFAULT_TOP_AFTER_ROUND_2): Recommendation {
  const eligible = teams.filter((t) => t.status === "ready" || t.status === "full");
  const rows: Parameters<typeof recommend>[0] = [];
  const missing: MissingEvaluation[] = [];
  for (const t of eligible) {
    const { s1, s2 } = t.scores;
    if (s1 === null || s2 === null) {
      missing.push({ teamId: t.id, name: t.name, missing: [s1 === null && "Round 1", s2 === null && "Round 2"].filter(Boolean) as string[] });
    } else {
      rows.push({ teamId: t.id, name: t.name, value: round2(s1 + s2), parts: { r1: s1, r2: s2 } });
    }
  }
  return recommend(rows, missing, topN);
}

/** Round 3 ranking, restricted to teams officially shortlisted for Round 3. */
export function recommendAfterRound3(teams: RankableTeam[], topN = DEFAULT_TOP_AFTER_ROUND_3): Recommendation {
  const eligible = teams.filter((t) => t.l3Decision === "shortlisted");
  const rows: Parameters<typeof recommend>[0] = [];
  const missing: MissingEvaluation[] = [];
  for (const t of eligible) {
    if (t.scores.s3 === null) missing.push({ teamId: t.id, name: t.name, missing: ["Round 3"] });
    else rows.push({ teamId: t.id, name: t.name, value: round2(t.scores.s3), parts: { r3: t.scores.s3 } });
  }
  return recommend(rows, missing, topN);
}

export interface ShortlistDecisionWrite {
  teamId: string;
  decision: "shortlisted" | "rejected";
  note?: string;
  override?: boolean;
}

/**
 * The decisions the Level 3 confirm step writes for the admin's FINAL
 * selection (which may differ from the recommendation). Teams whose saved
 * decision already matches are skipped.
 */
export function planRound3Decisions(
  teams: { id: string; l3Decision: string }[],
  selectedIds: ReadonlySet<string>,
  cutoffNote: string
): ShortlistDecisionWrite[] {
  return teams.flatMap((t): ShortlistDecisionWrite[] => {
    if (selectedIds.has(t.id)) {
      return t.l3Decision === "shortlisted" ? [] : [{ teamId: t.id, decision: "shortlisted", override: true }];
    }
    return t.l3Decision === "rejected" ? [] : [{ teamId: t.id, decision: "rejected", note: cutoffNote }];
  });
}
