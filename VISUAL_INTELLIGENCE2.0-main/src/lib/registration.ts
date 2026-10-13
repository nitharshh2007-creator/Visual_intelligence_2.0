// ─────────────────────────────────────────────────────────────
// Team Registration — dual-path data layer
// ─────────────────────────────────────────────────────────────
// Calls the real Supabase RPCs (create_team/join_team/get_team_lobby)
// when NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY are set and NEXT_PUBLIC_USE_MOCK
// isn't "true"; otherwise falls back to the original localStorage mock.
// Every exported function keeps its original name and resolved return
// shape — callers in /register and /register/[code] don't need to know
// which path is active, only that these are now async.
//
// RPC error SQLSTATEs (see supabase/migrations/0002_realtime_backend.sql)
// map to RegistrationErrorCode: VI001→INVALID_CODE, VI002/P0001→TEAM_FULL,
// VI003→ALREADY_REGISTERED, VI004→REGISTRATION_CLOSED, VI005→NAME_TAKEN.

import { TEAM_MAX, TEAM_MIN, REGISTRATION_DEADLINE_ISO } from "@/data/event";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { RegistrationTeam, RosterMember, RegistrationErrorCode, TeamPreview } from "./types";

// "dum 1234", "DUM1234", "dum-1234" all normalize to "DUM-1234" — the
// same tolerant matching the RPCs do server-side (see
// normalize_team_code in supabase/migrations/0005_team_lookup.sql).
// Used on every code the user types before it's sent anywhere.
export function normalizeTeamCode(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (alnum.length <= 3) return alnum;
  return `${alnum.slice(0, 3)}-${alnum.slice(3, 7)}`;
}

const STORAGE_PREFIX = "vi2-team:";
const DRAFT_KEY = "vi2-captain-code"; // legacy key, kept for /register's resume logic
const SESSION_KEY = "vi2-session"; // convenience only — never the source of truth

export interface JoinResult {
  team: RegistrationTeam | null;
  error?: RegistrationErrorCode;
}

export interface Session {
  teamCode: string;
  regNo: string | null;
  isCaptain: boolean;
}

// ── Session convenience (client-side only; real state always comes
//    from the server via getTeam/subscribeToTeam) ──
export function saveSession(session: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

// ── Simple client-side debounce — a UX nicety, not real rate limiting.
//    Real rate limiting needs an edge function in front of the RPCs
//    (see README "Phase 1 verification" / rate limiting note). Keyed
//    per action so, e.g., a "Find Team" lookup immediately followed
//    by "Join Team" doesn't falsely rate-limit the join. ──
const lastCallAtByKey = new Map<string, number>();
function debounceGuard(key: string, minGapMs = 700) {
  const now = Date.now();
  const last = lastCallAtByKey.get(key) ?? 0;
  if (now - last < minGapMs) {
    throw Object.assign(new Error("Please wait a moment before trying again."), {
      code: "RATE_LIMITED" as RegistrationErrorCode,
    });
  }
  lastCallAtByKey.set(key, now);
}

// Wraps a call so a thrown network/client error (fetch rejection,
// Supabase client exception — never a mapped RPC error, which already
// has a `.code`) surfaces as a stable NETWORK_ERROR instead of an
// unhandled exception reaching the UI.
async function withNetworkErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) throw err;
    throw Object.assign(new Error("Network error. Please check your connection and try again."), {
      code: "NETWORK_ERROR" as RegistrationErrorCode,
    });
  }
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 3);
}

function statusFor(members: RosterMember[]): RegistrationTeam["status"] {
  if (members.length >= TEAM_MAX) return "full";
  if (members.length >= TEAM_MIN) return "ready";
  return "incomplete";
}

// ─────────────────────────────────────────────────────────────
// Mock path (localStorage) — unchanged behavior from Phase 0
// ─────────────────────────────────────────────────────────────

function generateMockCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "DUM-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mockSave(team: RegistrationTeam) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + team.inviteCode, JSON.stringify(team));
  window.dispatchEvent(new CustomEvent("vi2-team-updated", { detail: team.inviteCode }));
}

function mockGetTeam(inviteCode: string): RegistrationTeam | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + inviteCode.toUpperCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RegistrationTeam;
  } catch {
    return null;
  }
}

function mockCreateTeam(teamName: string, captainName: string, regNo: string, email: string): RegistrationTeam {
  if (Date.now() > new Date(REGISTRATION_DEADLINE_ISO).getTime()) {
    throw Object.assign(new Error("Registration is closed"), { code: "REGISTRATION_CLOSED" as RegistrationErrorCode });
  }
  if (!regNo.trim() || !email.trim()) {
    throw Object.assign(new Error("Registration number and email are required"), { code: "INVALID_CODE" as RegistrationErrorCode });
  }

  let inviteCode = generateMockCode();
  while (mockGetTeam(inviteCode)) inviteCode = generateMockCode();

  const captain: RosterMember = {
    name: captainName.trim(),
    initials: getInitials(captainName),
    isCaptain: true,
    joinedAt: Date.now(),
  };

  const team: RegistrationTeam = {
    id: `reg-${Date.now()}`,
    inviteCode,
    name: teamName.trim(),
    members: [captain],
    status: statusFor([captain]),
    createdAt: Date.now(),
  };

  mockSave(team);
  return team;
}

function mockFindTeamByCode(inviteCode: string): { preview: TeamPreview | null; error?: RegistrationErrorCode } {
  const team = mockGetTeam(inviteCode);
  if (!team) return { preview: null, error: "INVALID_CODE" };
  const captain = team.members.find((m) => m.isCaptain) ?? team.members[0];
  return {
    preview: {
      name: team.name,
      memberCount: team.members.length,
      status: team.status,
      captainFirstName: (captain?.name ?? "").trim().split(/\s+/)[0] ?? "",
    },
  };
}

// phone/section/year aren't persisted by the mock store — the UI never
// reads them back, and the real backend is the only place they're used
// (eligibility checks, roster detail). Collected in a rest param only
// so callers don't need to branch on which path is active.
function mockJoinTeam(
  inviteCode: string,
  memberName: string,
  regNo: string,
  email: string,
  ..._extra: [phone?: string, section?: string, year?: number]
): JoinResult {
  void _extra;
  const team = mockGetTeam(inviteCode);
  if (!team) return { team: null, error: "INVALID_CODE" };

  if (Date.now() > new Date(REGISTRATION_DEADLINE_ISO).getTime()) {
    return { team, error: "REGISTRATION_CLOSED" };
  }
  if (!regNo.trim() || !email.trim()) {
    return { team, error: "INVALID_CODE" };
  }
  if (team.members.length >= TEAM_MAX) {
    return { team, error: "TEAM_FULL" };
  }

  const trimmed = memberName.trim();
  if (team.members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
    return { team, error: "NAME_TAKEN" };
  }

  const newMember: RosterMember = {
    name: trimmed,
    initials: getInitials(trimmed),
    isCaptain: false,
    joinedAt: Date.now(),
  };

  const updated: RegistrationTeam = { ...team, members: [...team.members, newMember] };
  updated.status = statusFor(updated.members);

  mockSave(updated);
  return { team: updated };
}

function mockSubscribe(inviteCode: string, onChange: (team: RegistrationTeam | null) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => onChange(mockGetTeam(inviteCode));
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_PREFIX + inviteCode.toUpperCase()) handler();
  };
  const localHandler = (e: Event) => {
    if ((e as CustomEvent).detail === inviteCode.toUpperCase()) handler();
  };

  window.addEventListener("storage", storageHandler);
  window.addEventListener("vi2-team-updated", localHandler);

  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener("vi2-team-updated", localHandler);
  };
}

// ─────────────────────────────────────────────────────────────
// Real path (Supabase RPCs)
// ─────────────────────────────────────────────────────────────

interface LobbyMember {
  name: string;
  role: "captain" | "member";
  created_at: string;
}
interface LobbyPayload {
  id: string;
  code: string;
  name: string;
  status: RegistrationTeam["status"];
  created_at: string;
  members: LobbyMember[] | null;
}

function mapLobbyToTeam(payload: LobbyPayload): RegistrationTeam {
  return {
    id: payload.id,
    inviteCode: payload.code,
    name: payload.name,
    status: payload.status,
    createdAt: new Date(payload.created_at).getTime(),
    members: (payload.members ?? []).map((m) => ({
      name: m.name,
      initials: getInitials(m.name),
      isCaptain: m.role === "captain",
      joinedAt: new Date(m.created_at).getTime(),
    })),
  };
}

function mapPostgrestErrorCode(code: string | undefined): RegistrationErrorCode {
  switch (code) {
    case "VI001": return "INVALID_CODE";
    case "VI002":
    case "P0001": return "TEAM_FULL";
    case "VI003": return "ALREADY_REGISTERED";
    case "VI004": return "REGISTRATION_CLOSED";
    case "VI005": return "NAME_TAKEN";
    case "VI006": return "NOT_ELIGIBLE";
    case "42501": // insufficient_privilege — RLS blocked the call
    case "42P01": return "NETWORK_ERROR"; // undefined_table — schema mismatch
    // No SQLSTATE at all means Postgrest never got a structured error
    // back from the RPC — almost always a transport failure (offline,
    // DNS, CORS, a dropped connection), not a validation rejection.
    default: return code ? "INVALID_CODE" : "NETWORK_ERROR";
  }
}

async function realGetTeam(code: string, regNo?: string | null): Promise<RegistrationTeam | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_team_lobby", {
    p_code: code,
    p_reg_no: regNo ?? null,
  });
  // VI001 = team not found — return null so callers can distinguish
  // "no such team" from a real network/RLS error.
  if (error) {
    if (error.code === "VI001") return null;
    throw Object.assign(new Error(error.message), { code: mapPostgrestErrorCode(error.code) });
  }
  if (!data) return null;
  return mapLobbyToTeam(data as unknown as LobbyPayload);
}

async function realCreateTeam(teamName: string, captainName: string, regNo: string, email: string): Promise<RegistrationTeam> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_team", {
    p_team_name: teamName,
    p_captain_name: captainName,
    p_reg_no: regNo,
    p_email: email,
  });
  if (error) {
    throw Object.assign(new Error(error.message), { code: mapPostgrestErrorCode(error.code) });
  }
  const code = (data as unknown as { code: string }).code;
  const team = await realGetTeam(code);
  if (!team) throw new Error("Team was created but could not be loaded. Refresh and try again.");
  return team;
}

async function realJoinTeam(
  code: string,
  memberName: string,
  regNo: string,
  email: string,
  phone?: string,
  section?: string,
  year?: number
): Promise<JoinResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("join_team", {
    p_code: code,
    p_member_name: memberName,
    p_reg_no: regNo,
    p_email: email,
    p_phone: phone ?? null,
    p_section: section ?? null,
    p_year: year ?? null,
  });
  if (error) {
    // Fetch current team state even on error so the UI can show the
    // up-to-date roster (e.g. TEAM_FULL shows the full roster).
    let team: RegistrationTeam | null = null;
    try { team = await realGetTeam(code); } catch { /* ignore */ }
    return { team, error: mapPostgrestErrorCode(error.code) };
  }
  const team = await realGetTeam(code);
  return { team };
}

interface TeamPreviewPayload {
  name: string;
  member_count: number;
  status: RegistrationTeam["status"];
  captain_first_name: string;
}

async function realFindTeamByCode(code: string): Promise<{ preview: TeamPreview | null; error?: RegistrationErrorCode }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("find_team_by_code", { p_code: code });
  if (error || !data) {
    return { preview: null, error: mapPostgrestErrorCode(error?.code) };
  }
  const payload = data as unknown as TeamPreviewPayload;
  return {
    preview: {
      name: payload.name,
      memberCount: payload.member_count,
      status: payload.status,
      captainFirstName: payload.captain_first_name,
    },
  };
}

function realSubscribe(code: string, onChange: (team: RegistrationTeam | null) => void): () => void {
  const supabase = getSupabaseClient();
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  (async () => {
    const team = await realGetTeam(code);
    if (cancelled) return;
    onChange(team);
    if (!team) return;

    channel = supabase
      .channel(`team-lobby-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `team_id=eq.${team.id}` },
        async () => onChange(await realGetTeam(code))
      )
      .on(
        "postgres_changes",
        // Filter on `id` (primary key, always in replica identity) rather
        // than `code` (not in replica identity by default — Realtime
        // would broadcast the row but the filter would never match).
        { event: "*", schema: "public", table: "teams", filter: `id=eq.${team.id}` },
        async () => onChange(await realGetTeam(code))
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}

// ─────────────────────────────────────────────────────────────
// Public API — same names/shapes regardless of which path is active
// ─────────────────────────────────────────────────────────────

export async function createTeam(teamName: string, captainName: string, regNo: string, email: string): Promise<RegistrationTeam> {
  debounceGuard("createTeam");
  return withNetworkErrorMapping(async () => {
    const team = isSupabaseConfigured()
      ? await realCreateTeam(teamName, captainName, regNo, email)
      : mockCreateTeam(teamName, captainName, regNo, email);
    saveSession({ teamCode: team.inviteCode, regNo, isCaptain: true });
    if (typeof window !== "undefined") localStorage.setItem(DRAFT_KEY, team.inviteCode);
    return team;
  });
}

export async function joinTeam(
  inviteCode: string,
  memberName: string,
  regNo: string,
  email: string,
  phone?: string,
  section?: string,
  year?: number
): Promise<JoinResult> {
  debounceGuard("joinTeam");
  const code = normalizeTeamCode(inviteCode);
  return withNetworkErrorMapping(async () => {
    const result = isSupabaseConfigured()
      ? await realJoinTeam(code, memberName, regNo, email, phone, section, year)
      : mockJoinTeam(code, memberName, regNo, email, phone, section, year);
    if (result.team && !result.error) saveSession({ teamCode: code, regNo, isCaptain: false });
    return result;
  });
}

// The minimal "Find team" lookup — network-error-mapped.
// No debounce: this is a read-only RPC and blocking it causes the
// cross-tab "code not found" symptom when the user hits Find quickly.
export async function findTeamByCode(inviteCode: string): Promise<{ preview: TeamPreview | null; error?: RegistrationErrorCode }> {
  const code = normalizeTeamCode(inviteCode);
  return withNetworkErrorMapping(() =>
    isSupabaseConfigured() ? realFindTeamByCode(code) : Promise.resolve(mockFindTeamByCode(code))
  );
}

export async function getTeam(inviteCode: string, regNo?: string | null): Promise<RegistrationTeam | null> {
  const code = normalizeTeamCode(inviteCode);
  if (!isSupabaseConfigured()) return mockGetTeam(code);
  return realGetTeam(code, regNo);
}

export function subscribeToTeam(inviteCode: string, onChange: (team: RegistrationTeam | null) => void): () => void {
  const code = normalizeTeamCode(inviteCode);
  return isSupabaseConfigured() ? realSubscribe(code, onChange) : mockSubscribe(code, onChange);
}

export function slotsRemaining(team: RegistrationTeam): number {
  return Math.max(0, TEAM_MAX - team.members.length);
}
