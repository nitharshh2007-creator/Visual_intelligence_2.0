"use client";

import { useEffect, useState } from "react";
import { loadSession, getTeam } from "@/lib/registration";
import { checkIsAdmin } from "@/lib/admin";
import type { RegistrationTeam } from "@/lib/types";

export type TeamGateState = "checking" | "no-session" | "incomplete" | "ok";

// Shared by /stages/* and /leaderboard: nobody gets in without having
// joined/created a team that's actually reached TEAM_MIN members — an
// "incomplete" roster (1-3 members) is blocked the same as no session
// at all. A signed-in admin session bypasses this entirely (checkIsAdmin()
// is the same real is_admin() RPC every admin-gated action already uses,
// not a client-side guess).
export function useTeamGate() {
  const [state, setState] = useState<TeamGateState>("checking");
  const [team, setTeam] = useState<RegistrationTeam | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await checkIsAdmin()) {
        if (!cancelled) setState("ok");
        return;
      }

      const session = loadSession();
      if (!session) {
        if (!cancelled) setState("no-session");
        return;
      }

      const t = await getTeam(session.teamCode, session.regNo);
      if (cancelled) return;
      if (!t) {
        setState("no-session");
        return;
      }
      setTeam(t);
      setState(t.status === "incomplete" ? "incomplete" : "ok");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, team };
}
