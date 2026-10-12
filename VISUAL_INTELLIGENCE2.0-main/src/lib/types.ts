// ─────────────────────────────────────────────────────────────
// Types for the Leaderboard Data Layer
// ─────────────────────────────────────────────────────────────

export interface TeamMember {
  name: string;
  initials: string;
  role?: string; // e.g. "Captain" — optional, shown in the team drawer
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  scores: { s1: number; s2: number; s3: number; s4: number };
  total: number;
  rank: number;
  prevRank: number;
  updatedAt: number;
  scoreHistory: number[]; // for sparklines
}

export interface ActivityEvent {
  id: string;
  type: "score" | "rank_change" | "stage_complete" | "join";
  teamId: string;
  teamName: string;
  message: string;
  at: number;
}

export type StageStatus = "upcoming" | "live" | "finished";

export interface EventState {
  currentStage: number; // 1-4
  stageEndsAt: number; // timestamp
  status: "upcoming" | "live" | "paused" | "finished";
  stageStatuses: StageStatus[]; // for each of 4 stages
  announcement?: string | null; // admin-published banner (Phase 2)
  pausedRemainingMs?: number | null; // when status==="paused", the frozen time left
}

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

// Mirrors get_leaderboard()'s return shape (see
// supabase/migrations/0006_leaderboard_visibility.sql). `round` is
// always null until Section D's qualifier cutoffs ship — nothing is
// filtered yet, so totalTeams === shownTeams.
export type LeaderboardVisibility = "public" | "hidden";

export interface LeaderboardData {
  teams: Team[];
  activity: ActivityEvent[];
  eventState: EventState;
  connection: ConnectionStatus;
  lastUpdated: number;
  isLoading: boolean;
  visibility: LeaderboardVisibility;
  round: string | null;
  totalTeams: number;
  shownTeams: number;
}

// ─────────────────────────────────────────────────────────────
// Types for Team Registration / Lobby
// ─────────────────────────────────────────────────────────────

export interface RosterMember {
  name: string;
  initials: string;
  isCaptain: boolean;
  joinedAt: number;
}

// "incomplete" (< TEAM_MIN), "ready" (TEAM_MIN..TEAM_MAX-1, eligible to
// compete), "full" (== TEAM_MAX, roster capped). Mirrors teams.status
// in supabase/migrations/0002_realtime_backend.sql.
export type RosterStatus = "incomplete" | "ready" | "full";

export interface RegistrationTeam {
  id: string;
  inviteCode: string;
  name: string;
  members: RosterMember[]; // length 1..TEAM_MAX
  status: RosterStatus;
  createdAt: number;
}

// Returned by get_team_lobby / join_team's error field (real backend) and
// mirrored by the mock store so callers can branch on a stable error code.
// RATE_LIMITED and NETWORK_ERROR are client-side only — raised by
// registration.ts itself, never by an RPC.
export type RegistrationErrorCode =
  | "INVALID_CODE"
  | "TEAM_FULL"
  | "ALREADY_REGISTERED"
  | "REGISTRATION_CLOSED"
  | "NAME_TAKEN"
  | "NOT_ELIGIBLE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR";

// The minimal, no-PII preview shown after a "Find team" lookup —
// never a full roster, never reg_no/email/phone (see find_team_by_code
// in supabase/migrations/0005_team_lookup.sql).
export interface TeamPreview {
  name: string;
  memberCount: number;
  status: RosterStatus;
  captainFirstName: string;
}
