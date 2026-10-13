"use client";

// Fixed top-right team name on every stage page, so judges walking the
// room can read which team is on each laptop. Follows renames live.
import { useEffect, useState } from "react";
import { getTeam, loadSession, subscribeToTeam } from "@/lib/registration";

export default function TeamBadge() {
  const [team, setTeam] = useState<{ name: string; code: string } | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session?.teamCode) return;
    let active = true;
    const apply = (t: { name: string; inviteCode: string } | null) => {
      if (active) setTeam(t ? { name: t.name, code: t.inviteCode } : null);
    };
    getTeam(session.teamCode, session.regNo).then(apply).catch(() => {});
    const unsubscribe = subscribeToTeam(session.teamCode, apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!team) return null;
  return (
    <div className="team-badge" role="status" aria-label={`Team ${team.name}`}>
      <span className="team-badge-label">Team</span>
      <span className="team-badge-name">{team.name}</span>
      <span className="team-badge-code">{team.code}</span>
    </div>
  );
}
