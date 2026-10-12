"use client";

import { useTeamGate } from "@/hooks/useTeamGate";
import TeamGateContent from "@/components/TeamGateContent";

// Wraps the whole /stages subtree — no stage content, locked or
// otherwise, renders for a visitor with no team or an incomplete one.
// This is a client-side convenience wall; the real enforcement is
// still server-side (get_stage_access/get_stage_content already
// refuse — or return nothing meaningful — for a team/reg_no that
// doesn't resolve), so this just gives a correct, specific message
// up front instead of a confusing all-LOCKED stage list.
export default function TeamGate({ children }: { children: React.ReactNode }) {
  const { state, team } = useTeamGate();

  if (state === "checking") return null;
  if (state === "ok") return <>{children}</>;

  return <TeamGateContent state={state} team={team} />;
}
