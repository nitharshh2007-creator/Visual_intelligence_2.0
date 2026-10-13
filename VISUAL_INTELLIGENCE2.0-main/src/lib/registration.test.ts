import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake Supabase client: each test queues the RPC responses it expects.
type RpcResponse = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcQueue: Record<string, RpcResponse[]> = {};

vi.mock("./supabase", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      const next = rpcQueue[fn]?.shift();
      if (!next) throw new Error(`unexpected rpc ${fn}`);
      return next;
    },
  }),
}));

import { createTeam, joinTeam, loadSession, mapRegistrationError } from "./registration";

const lobby = (members: { name: string; role: string }[]) => ({
  data: {
    id: "team-1",
    code: "DUM-ABCD",
    name: "Prompt Engineers",
    status: members.length >= 4 ? "full" : "incomplete",
    created_at: "2026-10-14T08:00:00Z",
    members: members.map((m) => ({ ...m, created_at: "2026-10-14T08:00:00Z" })),
  },
  error: null,
});

let clock = Date.parse("2026-10-14T06:00:00Z");

beforeEach(() => {
  rpcCalls.length = 0;
  rpcQueue = {};
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  // Step past the client-side debounce between tests.
  clock += 10_000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mapRegistrationError", () => {
  it("maps VI001 by context", () => {
    expect(mapRegistrationError({ code: "VI001", message: "Team name and captain name are required" }, "create")).toBe("MISSING_FIELDS");
    expect(mapRegistrationError({ code: "VI001", message: "Registration number and email are required" }, "join")).toBe("MISSING_FIELDS");
    expect(mapRegistrationError({ code: "VI001", message: "No team found for that code" }, "join")).toBe("INVALID_CODE");
  });

  it("maps the custom SQLSTATEs", () => {
    expect(mapRegistrationError({ code: "VI002" }, "join")).toBe("TEAM_FULL");
    expect(mapRegistrationError({ code: "P0001" }, "join")).toBe("TEAM_FULL");
    expect(mapRegistrationError({ code: "VI003" }, "create")).toBe("ALREADY_REGISTERED");
    expect(mapRegistrationError({ code: "VI004" }, "create")).toBe("REGISTRATION_CLOSED");
    expect(mapRegistrationError({ code: "VI005" }, "create")).toBe("NAME_TAKEN");
    expect(mapRegistrationError({ code: "VI006" }, "create")).toBe("NOT_ELIGIBLE");
  });

  it("uses the violated constraint to explain a unique violation", () => {
    const dup = (constraint: string) => ({ code: "23505", message: `duplicate key value violates unique constraint "${constraint}"` });
    expect(mapRegistrationError(dup("members_email_unique"), "create")).toBe("EMAIL_TAKEN");
    expect(mapRegistrationError(dup("teams_name_unique"), "create")).toBe("NAME_TAKEN");
    expect(mapRegistrationError(dup("members_reg_no_unique"), "join")).toBe("ALREADY_REGISTERED");
    expect(mapRegistrationError(dup("teams_invite_code_key"), "create")).toBe("SERVER_ERROR");
  });

  it("never blames user input for server or transport failures", () => {
    expect(mapRegistrationError({ code: "PGRST202", message: "Could not find the function" }, "create")).toBe("SERVER_ERROR");
    expect(mapRegistrationError({ code: "42501" }, "join")).toBe("SERVER_ERROR");
    expect(mapRegistrationError({ code: "23502" }, "join")).toBe("SERVER_ERROR");
    expect(mapRegistrationError({ code: "" }, "create")).toBe("NETWORK_ERROR");
    expect(mapRegistrationError(undefined, "create")).toBe("NETWORK_ERROR");
  });
});

describe("createTeam", () => {
  it("sends trimmed values and returns the lobby", async () => {
    rpcQueue.create_team = [{ data: { code: "DUM-ABCD", team_id: "team-1" }, error: null }];
    rpcQueue.get_team_lobby = [lobby([{ name: "Aarav", role: "captain" }])];

    const team = await createTeam("  Prompt Engineers ", " Aarav ", " 24CS045 ", " a@x.edu ");

    expect(rpcCalls[0]).toEqual({
      fn: "create_team",
      args: { p_team_name: "Prompt Engineers", p_captain_name: "Aarav", p_reg_no: "24CS045", p_email: "a@x.edu" },
    });
    expect(team.inviteCode).toBe("DUM-ABCD");
    expect(team.members).toHaveLength(1);
    expect(loadSession()).toEqual({ teamCode: "DUM-ABCD", regNo: "24CS045", isCaptain: true });
  });

  it("still succeeds (with session saved) when the lobby read fails after the team was created", async () => {
    rpcQueue.create_team = [{ data: { code: "DUM-ABCD", team_id: "team-1" }, error: null }];
    rpcQueue.get_team_lobby = [
      { data: null, error: { code: "", message: "fetch failed" } },
      { data: null, error: { code: "", message: "fetch failed" } },
    ];

    const team = await createTeam("Prompt Engineers", "Aarav", "24CS045", "a@x.edu");

    expect(team).toMatchObject({ id: "team-1", inviteCode: "DUM-ABCD", name: "Prompt Engineers", status: "incomplete" });
    expect(team.members[0]).toMatchObject({ name: "Aarav", isCaptain: true });
    expect(loadSession()?.teamCode).toBe("DUM-ABCD");
  });

  it("reports a duplicate email as EMAIL_TAKEN, not a reg-number clash", async () => {
    rpcQueue.create_team = [{ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "members_email_unique"' } }];
    await expect(createTeam("Team", "Aarav", "24CS045", "a@x.edu")).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(loadSession()).toBeNull();
  });

  it("rejects blank fields before calling the backend", async () => {
    await expect(createTeam("Team", "Aarav", "   ", "a@x.edu")).rejects.toMatchObject({ code: "MISSING_FIELDS" });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("joinTeam", () => {
  it("returns TEAM_FULL with the current roster when the database cap rejects a 5th member", async () => {
    const four = ["A", "B", "C", "D"].map((name, i) => ({ name, role: i === 0 ? "captain" : "member" }));
    rpcQueue.join_team = [{ data: null, error: { code: "VI002", message: "Team is full" } }];
    rpcQueue.get_team_lobby = [lobby(four)];

    const result = await joinTeam("dum abcd", "Eve", "24CS099", "e@x.edu");

    expect(rpcCalls[0].args.p_code).toBe("DUM-ABCD");
    expect(result.error).toBe("TEAM_FULL");
    expect(result.team?.members).toHaveLength(4);
    expect(loadSession()).toBeNull();
  });

  it("never reports failure after a successful join just because the lobby read failed", async () => {
    rpcQueue.join_team = [{ data: { team_id: "team-1", member_id: "m-2" }, error: null }];
    rpcQueue.get_team_lobby = [
      { data: null, error: { code: "", message: "fetch failed" } },
      { data: null, error: { code: "", message: "fetch failed" } },
    ];

    const result = await joinTeam("DUM-ABCD", " Bea ", " 24CS046 ", "b@x.edu");

    expect(result.error).toBeUndefined();
    expect(result.team?.members[0]).toMatchObject({ name: "Bea", isCaptain: false });
    expect(rpcCalls[0].args).toMatchObject({ p_member_name: "Bea", p_reg_no: "24CS046" });
    expect(loadSession()).toEqual({ teamCode: "DUM-ABCD", regNo: "24CS046", isCaptain: false });
  });
});
