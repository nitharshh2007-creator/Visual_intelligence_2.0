"use client";

import Link from "next/link";
import type { TeamGateState } from "@/hooks/useTeamGate";
import type { RegistrationTeam } from "@/lib/types";
import { TEAM_MIN } from "@/data/event";
import { Users, Lock } from "lucide-react";

// Pure presentational wall — shared by TeamGate (wraps /stages) and
// /leaderboard directly, since the leaderboard needs to keep its own
// page shell (background, top bar) around this instead of a full
// wrapper, and needs the projector-token bypass TeamGate doesn't know
// about.
export default function TeamGateContent({ state, team }: { state: Exclude<TeamGateState, "checking" | "ok">; team: RegistrationTeam | null }) {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="flex justify-center mb-6" aria-hidden="true">
        {state === "incomplete" ? (
          <Users className="w-12 h-12 text-[#e9adb5]" />
        ) : (
          <Lock className="w-12 h-12 text-white/40" />
        )}
      </div>
      <h1 className="text-2xl font-serif text-white mb-3">
        {state === "incomplete" ? "Your team isn't ready yet" : "Join a team first"}
      </h1>
      <p className="text-sm text-white/60 mb-8 leading-relaxed">
        {state === "incomplete"
          ? `Your team has ${team?.members.length ?? 0} member${team?.members.length === 1 ? "" : "s"} — you need at least ${TEAM_MIN} before this unlocks. Invite more teammates with your team code.`
          : "You need to create or join a team first."}
      </p>
      <Link
        href="/register"
        className="inline-block px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
      >
        {state === "incomplete" ? "Go to Your Lobby" : "Register or Join a Team"}
      </Link>
    </div>
  );
}
