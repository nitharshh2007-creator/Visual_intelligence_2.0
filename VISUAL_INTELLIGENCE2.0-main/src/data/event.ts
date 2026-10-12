// Team size configuration — the single source of truth for every
// "members per team" reference across config, UI copy, the registration
// lobby, and the DB trigger/RPCs in supabase/migrations/0002_*.sql.
// Keep these two numbers in sync with the `team_max`/team_min checks
// hardcoded in that migration's trigger and RPCs.
export const TEAM_MAX = 5; // max members per team (hard DB cap)
export const TEAM_MIN = 4; // min members per team to be eligible ("ready")

// Registration closes at this instant (ISO 8601, with timezone).
// Mirrors event_state.registration_deadline in the real backend; the mock
// store in lib/registration.ts reads this same constant.
export const REGISTRATION_DEADLINE_ISO = "2026-10-14T08:30:00+05:30";

// ─────────────────────────────────────────────────────────────
// Phase 3 — qualification cutoffs & stage-reveal policy
// ─────────────────────────────────────────────────────────────
// These are organizer POLICY (which cutoffs exist, how many teams they
// keep, whether eliminated teams keep playing) — the admin UI reads
// them to decide which "Apply Cutoff" buttons to offer and what
// defaults to pre-fill, then passes the resolved numbers as RPC
// params (admin_apply_cutoff). The RPCs never hardcode these values
// server-side, so changing policy here never requires a migration.
export type CutoffKeep = "half" | number;
export interface CutoffConfig {
  afterStage: number;
  keep: CutoffKeep;
}
export const CUTOFFS: CutoffConfig[] = [
  { afterStage: 2, keep: "half" },
  { afterStage: 3, keep: 10 },
];

// 'eliminate': cut teams get ELIMINATED state for later stages (no
// content, no submissions) and see a "you finished #N of M" card.
// 'display_only': cut teams keep playing normally but are hidden from
// the PUBLIC leaderboard (they still see their own private rank).
export const ADVANCE_RULE: "eliminate" | "display_only" = "eliminate";

// Ties at the cut line are always included (never silently dropped) —
// the admin's "Apply Cutoff" dialog shows the tie warning and lets
// them explicitly include/exclude specific teams before confirming.
export const TIE_AT_CUTOFF = "include_all" as const;

// Locked stages show only the stage number unless this is true, in
// which case the name is shown too (text/assets/rubric stay hidden
// either way — this only affects the one-line "Stage 2: BugX Hacker"
// label on a locked card). Mirrors event_state.reveal_stage_names,
// which is what the RPCs actually check — this constant is just the
// value the admin dashboard pre-fills when first setting it.
export const REVEAL_STAGE_NAMES_BEFORE_UNLOCK = false;

export const eventDetails = {
  title: "VISUAL INTELLIGENCE 2.0",
  tagline: "DUM SARAT using Prompt Engineering",
  subtitle: "4 Stages of Chaos",
  date: "14 Oct (Wednesday)",
  time: "2:00 PM – 4:00 PM",
  venue: "DSCS Gallery Hall",
  eligibility: `First-year students only. Teams of ${TEAM_MIN}–${TEAM_MAX} members.`,
  registration: "Free",
  participation: "E-certificate issued",
  organizers: "IEEE Computer Society · DSCS"
};

// Anti-leak (Phase 3 Section B): stage NAMES, hooks, rules, roles and
// every other descriptive field live ONLY in the `stages` DB table
// (supabase/migrations/0004_stage_pages.sql), read through the gated
// get_stage_access()/get_stage_content() RPCs. This file is imported
// by Client Components and compiled straight into the public JS
// bundle, so it must never hold stage content — a `stages` array here
// used to leak every locked stage's hook text onto the public
// homepage (StageCards) before a single team had unlocked anything.
// Only the count is safe to hardcode: it's structural, not content.
export const STAGE_COUNT = 4;
