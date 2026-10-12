import type { Team } from "@/lib/types";

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

// Cycles avatars through the three podium materials so every member
// chip reads as part of the same system, regardless of team/rank.
const AVATAR_MATERIALS = [
  { background: "var(--lb-gold-grad)", color: "var(--lb-white)" },
  { background: "var(--lb-graphite-grad)", color: "var(--lb-white)" },
  { background: "var(--lb-pearl-grad)", color: "var(--lb-ink)" },
] as const;

export function avatarColor(seed: number) {
  return AVATAR_MATERIALS[((seed % AVATAR_MATERIALS.length) + AVATAR_MATERIALS.length) % AVATAR_MATERIALS.length];
}

export function rankDelta(team: Team): number {
  return team.prevRank - team.rank;
}

// Dense ranking: ties share a rank, with a tie-break tooltip handled
// by the caller. `teams` must already be sorted by `valueOf` desc
// (plus whatever tie-break the caller used); this just groups equal
// values under one displayed rank number. Works for both the overall
// total and a single stage's score (the segmented control re-ranks by
// whichever `valueOf` the page passes in).
export function denseRanks(teams: Team[], valueOf: (t: Team) => number = (t) => t.total): Map<string, number> {
  const ranks = new Map<string, number>();
  let lastValue: number | null = null;
  let lastRank = 0;
  let position = 0;
  for (const team of teams) {
    position += 1;
    const value = valueOf(team);
    if (lastValue === null || value !== lastValue) {
      lastRank = position;
      lastValue = value;
    }
    ranks.set(team.id, lastRank);
  }
  return ranks;
}
