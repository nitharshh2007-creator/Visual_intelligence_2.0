"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSession } from "@/lib/registration";
import { getStageAccess, getTeamCutResult, type CutResult } from "@/lib/stageAccess";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { StageAccessEntry } from "@/lib/supabase";
import StageProgressRail from "@/components/stages/StageProgressRail";
import StageLockCard from "@/components/stages/StageLockCard";

const STATE_BADGE: Record<string, string> = {
  LOCKED: "bg-white/5 text-white/40",
  RELEASED: "bg-white/10 text-white",
  LIVE: "bg-emerald-500/20 text-emerald-300",
  COMPLETED: "bg-white/20 text-white",
  ELIMINATED: "bg-red-500/10 text-red-300",
};

export default function StagesIndexClient() {
  const [stages, setStages] = useState<StageAccessEntry[]>([]);
  const [cutResult, setCutResult] = useState<CutResult | null>(null);
  const [hydrated, setHydrated] = useState(false);

  async function refresh() {
    const session = loadSession();
    const [access, cut] = await Promise.all([
      getStageAccess(session?.teamCode, session?.regNo),
      session ? getTeamCutResult(session.teamCode, session.regNo ?? "") : Promise.resolve(null),
    ]);
    setStages(access);
    setCutResult(cut);
  }

  useEffect(() => {
    function init() {
      refresh().finally(() => setHydrated(true));
    }
    init();
  }, []);

  // Realtime on event_state (leaderboard_rev bumps on any release/
  // stage/cutoff change) + a 10s poll fallback, same pattern as the
  // public leaderboard.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("stage-access-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  if (!hydrated) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pb-16">
      <div className="text-center mb-10">
        <h1 className="font-serif text-5xl md:text-7xl mb-4 text-white">THE 4 STAGES</h1>
        <p className="text-sm tracking-[0.2em] uppercase text-white/50">Unlocked one at a time, in order</p>
      </div>

      <StageProgressRail stages={stages} />

      {cutResult && (
        <div className="mb-12 p-8 rounded-2xl border border-white/10 bg-white/5 text-center max-w-xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Final Result</p>
          <h2 className="text-3xl font-serif text-white mb-2">
            You finished #{cutResult.rank} of {cutResult.totalTeams}
          </h2>
          <p className="text-sm text-white/60">
            Final score: {cutResult.total} pts. Thank you for playing — e-certificates will be issued to every participant.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {stages.map((s) => {
          const accessible = s.state === "LIVE" || s.state === "COMPLETED";
          const card = (
            <div
              className="relative p-8 rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
              style={{
                background: "linear-gradient(145deg, var(--lb-burgundy-900), var(--lb-black))",
                border: "1px solid var(--lb-burgundy-700)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            >
              <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${STATE_BADGE[s.state]}`}>
                {s.stage_status === "ended" ? "ENDED" : s.state}
              </span>
              <div className="text-white/30 text-5xl font-serif italic mb-4">0{s.stage}</div>
              <h2 className="text-3xl font-serif text-white mb-2">{s.name ?? `Stage ${s.stage}`}</h2>
              <p className="text-white/50 text-sm">
                {s.stage_status === "ended"
                  ? "The host ended this stage. Submissions are closed."
                  : accessible
                  ? "Tap to open →"
                  : s.state === "ELIMINATED"
                  ? "No longer available for your team."
                  : "Not open yet."}
              </p>
            </div>
          );
          return accessible ? (
            <Link href={`/stages/${s.slug}`} key={s.stage}>
              {card}
            </Link>
          ) : (
            <div key={s.stage}>
              <StageLockCard stage={s.stage} name={s.name} state={s.state} reason={s.reason} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
