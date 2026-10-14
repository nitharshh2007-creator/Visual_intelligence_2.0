"use client";

import { useEffect, useState } from "react";
import { loadSession, getTeam } from "@/lib/registration";
import { checkIsAdmin } from "@/lib/admin";
import type { RegistrationTeam } from "@/lib/types";

// "error" = the session exists but the team couldn't be verified (network
// hiccup during a refresh) — distinct from "no-session" so a transient
// failure never tells a real member to join a team.
export type TeamGateState = "checking" | "no-session" | "incomplete" | "ok" | "error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

      // getTeam resolves null only for a definitive "no such team / reg_no
      // not on it"; it throws for transport errors, which are retried.
      let t: RegistrationTeam | null = null;
      let verified = false;
      for (let attempt = 0; attempt < 3 && !verified; attempt++) {
        if (attempt > 0) await sleep(800 * attempt);
        if (cancelled) return;
        try {
          t = await getTeam(session.teamCode, session.regNo);
          verified = true;
        } catch {
          /* retry */
        }
      }
      if (cancelled) return;
      if (!verified) {
        setState("error");
        return;
      }
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
