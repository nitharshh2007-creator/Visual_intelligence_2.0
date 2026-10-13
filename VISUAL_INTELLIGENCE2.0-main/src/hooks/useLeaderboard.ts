"use client";

import { useEffect, useRef, useState } from "react";
import type { Team, ActivityEvent, EventState, ConnectionStatus, LeaderboardData, StageStatus, LeaderboardVisibility } from "@/lib/types";
import { TEAM_MAX } from "@/data/event";
import { getSupabaseClient, isSupabaseConfigured, type LeaderboardViewRow, type EventStateRow, type ActivityRow, type LeaderboardPayload, type StageAccessEntry } from "@/lib/supabase";

const STAGE_NAMES = ["Cyber Styling", "BugX Hacker", "Prompt Rumble", "Prompt Charades"];
const POLL_MS = 10000; // fallback if the Realtime socket drops

// ─────────────────────────────────────────────────────────────
// Mock path — unchanged behavior from before, used when
// NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY aren't set (or USE_MOCK=true).
// ─────────────────────────────────────────────────────────────

const TEAM_DATA: { name: string; members: string[] }[] = [
  { name: "Team Nova", members: ["Aarav S.", "Diya M.", "Rohan K.", "Ishita P.", "Veer N."] },
  { name: "Cyber Knights", members: ["Ishaan P.", "Ananya R.", "Kabir T.", "Myra S.", "Reyansh J."] },
  { name: "Prompt Engineers", members: ["Meera V.", "Arjun D.", "Priya N.", "Kian B.", "Aadhya T."] },
  { name: "AI Wizards", members: ["Siddharth L.", "Kavya G.", "Neel B.", "Trisha R.", "Yuvan M."] },
  { name: "The Alchemists", members: ["Tanya J.", "Rishi A.", "Sara W.", "Dhruv P.", "Amaira S."] },
  { name: "Neural Nexus", members: ["Vikram H.", "Aisha F.", "Dev C.", "Navya K.", "Arin L."] },
  { name: "Quantum Leap", members: ["Shreya I.", "Aditya K.", "Neha S.", "Rian D.", "Ira G."] },
  { name: "Byte Force", members: ["Karthik R.", "Zara P.", "Manav T.", "Avni J.", "Shaurya B."] },
  { name: "Code Crusaders", members: ["Rhea M.", "Arnav S.", "Pooja L.", "Vihaan C.", "Tara N."] },
  { name: "Synapse Squad", members: ["Vivaan D.", "Nisha B.", "Jai V.", "Saanvi H.", "Krish P."] },
  { name: "Pixel Pirates", members: ["Aanya G.", "Sahil N.", "Tanvi R.", "Om S.", "Kiara D."] },
  { name: "Matrix Minds", members: ["Harsh J.", "Simran K.", "Akash P.", "Riya T.", "Dev M."] },
  { name: "Echo Chamber", members: ["Kiara S.", "Pranav M.", "Riya T.", "Advait B.", "Nitya C."] },
  { name: "Void Runners", members: ["Dhruv A.", "Myra L.", "Sai H.", "Anvi R.", "Kabir D."] },
  { name: "The Sentinels", members: ["Laksh C.", "Ishika D.", "Raj V.", "Mahi P.", "Yash T."] },
  { name: "Ctrl+Z", members: ["Ira B.", "Kabir S.", "Navya K.", "Arjun M.", "Diya R."] },
  { name: "Bug Hunters", members: ["Yash M.", "Avni P.", "Ritik G.", "Sara J.", "Vivaan K."] },
  { name: "Team Cipher", members: ["Mira R.", "Om T.", "Anika J.", "Rudra S.", "Kyra N."] },
];

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase();
}

function seedTeams(): Team[] {
  return TEAM_DATA.map((t, i) => {
    const s1 = Math.floor(Math.random() * 40) + 60;
    const s2 = Math.floor(Math.random() * 40) + 55;
    const s3 = Math.floor(Math.random() * 30) + 50;
    const s4 = 0;
    const total = s1 + s2 + s3 + s4;
    return {
      id: `team-${i + 1}`,
      name: t.name,
      members: t.members.slice(0, TEAM_MAX).map((m, mi) => ({
        name: m,
        initials: getInitials(m),
        role: mi === 0 ? "Captain" : "Member",
      })),
      scores: { s1, s2, s3, s4 },
      total,
      rank: 0,
      prevRank: 0,
      updatedAt: Date.now(),
      scoreHistory: [total],
    };
  });
}

function rankTeams(teams: Team[]): Team[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aRecent = a.scores.s3 || a.scores.s2 || a.scores.s1;
    const bRecent = b.scores.s3 || b.scores.s2 || b.scores.s1;
    return bRecent - aRecent;
  });
  return sorted.map((t, i) => ({ ...t, prevRank: t.rank || i + 1, rank: i + 1 }));
}

const ACTIVITY_TEMPLATES = [
  (t: string, s: string, score: number) => `${t} scored ${score} in ${s}`,
  (t: string) => `${t} jumped up the leaderboard!`,
  (t: string, s: string) => `${t} finished ${s} · great performance!`,
  (t: string, s: string, score: number) => `${t} added +${score} pts in ${s}`,
];

function useMockLeaderboard(): LeaderboardData {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [connection, setConnection] = useState<ConnectionStatus>("connected");
  const activityIdRef = useRef(0);

  const [eventState, setEventState] = useState<EventState>({
    currentStage: 3,
    stageEndsAt: 0,
    status: "live",
    stageStatuses: ["finished", "finished", "live", "upcoming"],
  });

  useEffect(() => {
    function init() {
      setLastUpdated(Date.now());
      setEventState(prev => ({ ...prev, stageEndsAt: Date.now() + 15 * 60 * 1000 }));
    }
    init();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const seeded = rankTeams(seedTeams());
      setTeams(seeded);
      setIsLoading(false);
      setLastUpdated(Date.now());

      const initialActivity: ActivityEvent[] = [
        {
          id: `act-init-1`,
          type: "stage_complete",
          teamId: seeded[0].id,
          teamName: seeded[0].name,
          message: `${seeded[0].name} leads with ${seeded[0].total} points!`,
          at: Date.now() - 5000,
        },
        {
          id: `act-init-2`,
          type: "score",
          teamId: seeded[2].id,
          teamName: seeded[2].name,
          message: `${seeded[2].name} finished Stage 2 · 94% accuracy`,
          at: Date.now() - 3000,
        },
      ];
      setActivity(initialActivity);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setTeams(prev => {
        const updated = prev.map(team => {
          if (Math.random() > 0.65) {
            const newScores = { ...team.scores };
            const stageKey = `s${eventState.currentStage}` as keyof typeof newScores;
            const addedScore = Math.floor(Math.random() * 8) + 2;
            newScores[stageKey] = Math.min(100, newScores[stageKey] + addedScore);
            const newTotal = newScores.s1 + newScores.s2 + newScores.s3 + newScores.s4;

            activityIdRef.current += 1;
            const stageName = STAGE_NAMES[eventState.currentStage - 1];
            const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
            const newEvent: ActivityEvent = {
              id: `act-${activityIdRef.current}`,
              type: "score",
              teamId: team.id,
              teamName: team.name,
              message: template(team.name, stageName, addedScore),
              at: Date.now(),
            };
            setActivity(prev => [newEvent, ...prev].slice(0, 50));

            return {
              ...team,
              scores: newScores,
              total: newTotal,
              updatedAt: Date.now(),
              scoreHistory: [...team.scoreHistory, newTotal].slice(-20),
            };
          }
          return team;
        });

        return rankTeams(updated);
      });

      setLastUpdated(Date.now());

      if (Math.random() > 0.97) {
        setConnection("reconnecting");
        setTimeout(() => setConnection("connected"), 2000);
      }
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [isLoading, eventState.currentStage]);

  // Mock mode has no visibility switch — always "public" so local/demo
  // dev isn't blocked by a feature that only exists in the real backend.
  return {
    teams,
    activity,
    eventState,
    connection,
    lastUpdated,
    isLoading,
    visibility: "public" as const,
    round: null,
    totalTeams: teams.length,
    shownTeams: teams.length,
  };
}

// ─────────────────────────────────────────────────────────────
// Real path — get_leaderboard() (teams/activity/visibility) +
// event_state (stage/timer + the leaderboard_rev change signal), with
// Realtime on event_state only and a 10s polling fallback.
// ─────────────────────────────────────────────────────────────

// The public view only exposes initials (never full names — see
// supabase/migrations/0002_realtime_backend.sql), so TeamMember.name
// here is the initials string too. Existing UI (hover titles etc.)
// degrades gracefully to showing initials instead of full names.
function mapViewRowToTeam(row: LeaderboardViewRow, prevRank: number | undefined, scoreHistory: number[]): Team {
  const initials = row.member_initials ?? [];
  const extra = Math.max(0, row.member_count - initials.length);
  return {
    id: row.team_id,
    name: row.name,
    members: [
      ...initials.map((initial) => ({ name: initial, initials: initial })),
      ...(extra > 0 ? [{ name: `+${extra}`, initials: `+${extra}` }] : []),
    ],
    scores: { s1: row.s1, s2: row.s2, s3: row.s3, s4: row.s4 },
    total: row.total,
    rank: row.rank,
    prevRank: prevRank ?? row.rank,
    updatedAt: new Date(row.updated_at).getTime(),
    scoreHistory,
  };
}

function mapEventStateRow(row: EventStateRow, stages: StageAccessEntry[]): EventState {
  const currentStage = Math.max(1, row.current_stage); // UI isn't designed for "stage 0" (pre-event)
  const stageStatuses: StageStatus[] = [1, 2, 3, 4].map((stage) => {
    const lifecycleStatus = stages.find((entry) => entry.stage === stage)?.stage_status;
    if (lifecycleStatus === "ended" || stage < currentStage) return "finished";
    if (lifecycleStatus === "live") return "live";
    return "upcoming";
  });
  return {
    currentStage,
    stageEndsAt: row.stage_ends_at ? new Date(row.stage_ends_at).getTime() : 0,
    status: row.status,
    stageStatuses,
    announcement: row.announcement,
    pausedRemainingMs: row.remaining_ms,
  };
}

function mapActivityRow(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type,
    teamId: row.team_id ?? "",
    teamName: "", // not rendered by LiveFeed; message already has the team name
    at: new Date(row.created_at).getTime(),
    message: row.message,
  };
}

function useRealLeaderboard(projectorToken?: string | null, showEliminated?: boolean): LeaderboardData {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [eventState, setEventState] = useState<EventState>({
    currentStage: 1,
    stageEndsAt: 0,
    status: "upcoming",
    stageStatuses: ["upcoming", "upcoming", "upcoming", "upcoming"],
  });
  // Fail-closed default — matches event_state.leaderboard_visibility's
  // own 'hidden' default, so there's no flash of team data before the
  // first get_leaderboard() response comes back.
  const [visibility, setVisibility] = useState<LeaderboardVisibility>("hidden");
  const [round, setRound] = useState<string | null>(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [shownTeams, setShownTeams] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [connection, setConnection] = useState<ConnectionStatus>("reconnecting");

  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const scoreHistoryRef = useRef<Map<string, number[]>>(new Map());
  // Read inside fetchLeaderboard via ref so the realtime/poll effects
  // (mounted once, `[]` deps) always see the latest token without
  // needing to resubscribe the channel every time it changes. Updated
  // in an effect (not during render) — refs aren't for render-time use.
  const tokenRef = useRef(projectorToken);
  useEffect(() => {
    tokenRef.current = projectorToken;
  }, [projectorToken]);

  // Same ref-for-stable-effects reasoning as tokenRef — only the admin
  // "show eliminated teams" toggle flips this, but the realtime/poll
  // effects below are mounted once with `[]` deps.
  const showEliminatedRef = useRef(showEliminated);
  useEffect(() => {
    showEliminatedRef.current = showEliminated;
    fetchLeaderboard();
  }, [showEliminated]);

  // leaderboard_view/activity are no longer directly selectable by
  // anon/authenticated (see 0006_leaderboard_visibility.sql) —
  // get_leaderboard() is the only path now, and it folds the
  // visibility/round/count fields in alongside teams/activity.
  async function fetchLeaderboard() {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_projector_token: tokenRef.current ?? null,
      p_show_eliminated: showEliminatedRef.current ?? false,
    });
    if (error || !data) return;
    const payload = data as LeaderboardPayload;

    setVisibility(payload.visibility);
    setRound(payload.round);
    setTotalTeams(payload.total_teams);
    setShownTeams(payload.shown_teams);

    const nextTeams = payload.teams.map((row) => {
      const prevRank = prevRanksRef.current.get(row.team_id);
      const history = scoreHistoryRef.current.get(row.team_id) ?? [];
      const nextHistory = history[history.length - 1] === row.total ? history : [...history, row.total].slice(-20);
      scoreHistoryRef.current.set(row.team_id, nextHistory);
      return mapViewRowToTeam(row, prevRank, nextHistory);
    });

    prevRanksRef.current = new Map(nextTeams.map((t) => [t.id, t.rank]));
    setTeams(nextTeams);
    setActivity(payload.activity.map(mapActivityRow));
    setLastUpdated(Date.now());
  }

  async function fetchEventState() {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const [{ data, error }, { data: access, error: accessError }] = await Promise.all([
      supabase.from("event_state").select("*").eq("id" as never, 1).maybeSingle(),
      supabase.rpc("get_stage_access", { p_code: null, p_reg_no: null }),
    ]);
    if (error || !data) return;
    if (accessError || !access) {
      console.error("Failed to load stage lifecycle for the leaderboard", accessError);
      return;
    }
    setEventState(mapEventStateRow(data as EventStateRow, access.stages));
  }

  async function fetchAll() {
    await Promise.all([fetchLeaderboard(), fetchEventState()]);
  }

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchAll();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A projector token that arrives after mount (the page reads `?pt=`
  // from the URL in its own effect, same "null until mount" pattern as
  // elsewhere) needs its own re-fetch — the initial-load effect above
  // only runs once and won't pick it up. Always refetch here (not
  // gated on isLoading): if the very first fetch is still in flight
  // when the token shows up, it already went out with the stale
  // value baked in, so this is the only call that will carry the
  // correct one. A harmless redundant request if they land close
  // together — last response to resolve just wins via setState.
  useEffect(() => {
    fetchLeaderboard();
  }, [projectorToken]);

  // Realtime on event_state only now — scores/activity are revoked for
  // anon, so the only thing left to subscribe to is the one row anon
  // can still read directly. leaderboard_rev bumps on every scores/
  // activity write (see the migration), so this alone is a complete
  // "something changed" signal for calling get_leaderboard() again.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("leaderboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, () => {
        fetchEventState();
        fetchLeaderboard();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("connected");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("reconnecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 10s polling fallback, independent of Realtime's own state
  useEffect(() => {
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { teams, activity, eventState, connection, lastUpdated, isLoading, visibility, round, totalTeams, shownTeams };
}

export function useLeaderboard(projectorToken?: string | null, showEliminated?: boolean): LeaderboardData {
  const mock = useMockLeaderboard();
  const real = useRealLeaderboard(projectorToken, showEliminated);
  return isSupabaseConfigured() ? real : mock;
}
