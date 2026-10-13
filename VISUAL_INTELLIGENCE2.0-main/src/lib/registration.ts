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
// map to RegistrationErrorCode in mapRegistrationError() below.

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

export interface RpcErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
}

// Which RPC produced the error — VI001 means different things for
// create_team (blank team/captain name) and join_team (blank reg/email
// or unknown code), see 0014 create_team and 0019 join_team.
export type RegistrationContext = "create" | "join" | "lookup";

export function mapRegistrationError(error: RpcErrorLike | null | undefined, context: RegistrationContext): RegistrationErrorCode {
  const code = error?.code;
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  switch (code) {
    case "VI001":
      if (context === "create" || /required/i.test(text)) return "MISSING_FIELDS";
      return "INVALID_CODE";
    case "VI002":
    case "P0001": return "TEAM_FULL";
    case "VI003": return "ALREADY_REGISTERED";
    case "VI004": return "REGISTRATION_CLOSED";
    case "VI005": return "NAME_TAKEN";
    case "VI006": return "NOT_ELIGIBLE";
    // Unique violation that slipped past the RPC's own checks (email is
    // never pre-checked; a concurrent create can race the name check).
    // The constraint name says which value collided.
    case "23505":
      if (/members_email_unique/i.test(text)) return "EMAIL_TAKEN";
      if (/teams_name_unique/i.test(text)) return "NAME_TAKEN";
      if (/members_reg_no_unique/i.test(text)) return "ALREADY_REGISTERED";
      if (/teams_(code|invite_code)/i.test(text)) return "SERVER_ERROR"; // invite-code collision — retrying succeeds
      return "ALREADY_REGISTERED";
    // No SQLSTATE at all means Postgrest never got a structured error
    // back from the RPC — almost always a transport failure (offline,
    // DNS, CORS, a dropped connection), not a validation rejection.
    case undefined:
    case "":
      return "NETWORK_ERROR";
    // Anything else (RLS/privilege 42501, missing table 42P01, missing
    // function PGRST202, constraint 23502/23514, …) is a server/schema
    // problem — never blame the user's input for it.
    default: return "SERVER_ERROR";
  }
}

function registrationError(error: RpcErrorLike, context: RegistrationContext): Error & { code: RegistrationErrorCode } {
  return Object.assign(new Error(error.message ?? "Registration failed"), { code: mapRegistrationError(error, context) });
}

// After a successful create/join the write is already committed, so a
// failed lobby read must not surface as an error — the user would retry
// and hit NAME_TAKEN/ALREADY_REGISTERED on their own team. Retry once,
// then hand back null and let the caller build a placeholder; the lobby
// Realtime subscription replaces it with the real roster.
async function getTeamAfterWrite(code: string): Promise<RegistrationTeam | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const team = await realGetTeam(code);
      if (team) return team;
    } catch {
      /* fall through to retry */
    }
  }
  return null;
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
    throw registrationError(error, "lookup");
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
  if (error) throw registrationError(error, "create");
  const created = data as unknown as { code?: string; team_id?: string } | null;
  if (!created?.code) {
    throw Object.assign(new Error("create_team returned no invite code"), { code: "SERVER_ERROR" as RegistrationErrorCode });
  }
  // Persist the session before the lobby read so a refresh resumes the
  // team even if that read fails.
  saveSession({ teamCode: created.code, regNo, isCaptain: true });
  if (typeof window !== "undefined") localStorage.setItem(DRAFT_KEY, created.code);

  const team = await getTeamAfterWrite(created.code);
  if (team) return team;
  const now = Date.now();
  return {
    id: created.team_id ?? "",
    inviteCode: created.code,
    name: teamName,
    members: [{ name: captainName, initials: getInitials(captainName), isCaptain: true, joinedAt: now }],
    status: "incomplete",
    createdAt: now,
  };
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
  const { data, error } = await supabase.rpc("join_team", {
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
    return { team, error: mapRegistrationError(error, "join") };
  }
  saveSession({ teamCode: code, regNo, isCaptain: false });

  const team = await getTeamAfterWrite(code);
  if (team) return { team };
  const now = Date.now();
  return {
    team: {
      id: (data as unknown as { team_id?: string } | null)?.team_id ?? "",
      inviteCode: code,
      name: code,
      members: [{ name: memberName, initials: getInitials(memberName), isCaptain: false, joinedAt: now }],
      status: "incomplete",
      createdAt: now,
    },
  };
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
  if (error) return { preview: null, error: mapRegistrationError(error, "lookup") };
  if (!data) return { preview: null, error: "INVALID_CODE" };
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

// The RPCs compare reg_no/email exactly, so stray whitespace would
// register " 24CS045" as a different student from "24CS045".
function requireFields(...values: string[]) {
  if (values.some((v) => !v)) {
    throw Object.assign(new Error("All required fields must be filled in"), { code: "MISSING_FIELDS" as RegistrationErrorCode });
  }
}

export async function createTeam(teamName: string, captainName: string, regNo: string, email: string): Promise<RegistrationTeam> {
  [teamName, captainName, regNo, email] = [teamName, captainName, regNo, email].map((v) => v.trim());
  requireFields(teamName, captainName, regNo, email);
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
  [memberName, regNo, email] = [memberName, regNo, email].map((v) => v.trim());
  requireFields(memberName, regNo, email);
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
