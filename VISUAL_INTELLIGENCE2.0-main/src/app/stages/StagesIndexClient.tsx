"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSession } from "@/lib/registration";
import { getStageAccess, getTeamCutResult, type CutResult } from "@/lib/stageAccess";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { StageAccessEntry } from "@/lib/supabase";
import StageProgressRail from "@/components/stages/StageProgressRail";
import { lockMessage, isEliminatedAccess } from "@/components/stages/StageLockCard";
import StageArt from "@/components/stages/StageArt";
import Loader from "@/components/ui/Loader";
import RejoinTeam from "@/components/stages/RejoinTeam";
import { Check, Lock, X } from "lucide-react";
import "@/app/landing.css";

const STATUS_LABEL: Record<string, string> = {
  LOCKED: "Locked",
  RELEASED: "Opens soon",
  LIVE: "Live",
  COMPLETED: "Completed",
  ELIMINATED: "Not found",
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

  if (!hydrated) return <Loader label="Loading stages" tone="dark" />;

  const liveIdx = stages.findIndex((s) => s.state === "LIVE");
  const reachIdx = stages.map((s) => s.state !== "LOCKED").lastIndexOf(true);
  const featuredIdx = liveIdx >= 0 ? liveIdx : Math.max(reachIdx, 0);

  return (
    <div className="stages-dark max-w-[1440px] mx-auto px-4 md:px-10 pb-20">
      <header className="stages-dark-head">
        <span className="section-eyebrow section-eyebrow-dark">The Journey · Unlocked one at a time, in order</span>
        <h1 className="section-title">Four stages of <em>chaos.</em></h1>
      </header>

      <StageProgressRail stages={stages} />

      {cutResult && (
        <div className="lb-panel mb-12 p-8 rounded-2xl border border-white/10 bg-white/5 text-center max-w-xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Final Result</p>
          <h2 className="text-3xl font-serif text-white mb-2">
            You finished #{cutResult.rank} of {cutResult.totalTeams}
          </h2>
          <p className="text-sm text-white/60">
            Final score: {cutResult.total} pts. Thank you for playing — e-certificates will be issued to every participant.
          </p>
        </div>
      )}

      <ol className="stage-list" data-reveal="" data-inview="">
        {stages.map((s, idx) => {
          const accessible = s.state === "LIVE" || s.state === "COMPLETED";
          const interactive = accessible && !!s.slug;
          const isEnded = s.stage_status === "ended";
          const num = String(s.stage).padStart(2, "0");
          const gone = isEliminatedAccess(s.state, s.reason);
          const stateKey = isEnded && s.state !== "LIVE" ? "ended" : s.state.toLowerCase();
          const desc = isEnded
            ? "The host ended this stage. Submissions are closed."
            : interactive
            ? s.state === "LIVE" ? "Live now. Open the stage to play." : "Completed. Revisit it any time."
            : lockMessage(s.state, s.reason);
          return (
            <li
              key={s.stage}
              className="stage-panel"
              data-stage={Math.min(s.stage, 4)}
              data-state={stateKey}
              data-interactive={interactive || undefined}
              data-featured={idx === featuredIdx || undefined}
            >
              <span className="stage-marker" aria-hidden="true"><span>{num}</span></span>
              <div className="stage-panel-card">
                <div className="stage-panel-art" aria-hidden="true"><StageArt stage={s.stage} /></div>
                <span className="stage-panel-num" aria-hidden="true">{num}</span>
                {!interactive && s.state !== "LIVE" && (
                  <span className="stage-panel-seal" aria-hidden="true">{gone ? <X /> : <Lock />}</span>
                )}
                <div className="stage-panel-body">
                  <span className="stage-panel-kicker">Stage {num}</span>
                  <h2 className="stage-panel-title">
                    {interactive ? (
                      <Link href={`/stages/${s.slug}`} className="stage-panel-link">{s.name ?? `Stage ${s.stage}`}</Link>
                    ) : gone ? (
                      "404 · Not found"
                    ) : (
                      s.name ?? `Stage ${s.stage}`
                    )}
                  </h2>
                  <p className="stage-panel-desc">{desc}</p>
                  <div className="stage-panel-foot">
                    {s.state === "LIVE" ? (
                      <span className="stage-pill stage-pill-live"><span className="stage-pill-dot" />Live</span>
                    ) : isEnded ? (
                      <span className="stage-pill">Ended</span>
                    ) : s.state === "COMPLETED" ? (
                      <span className="stage-pill"><Check aria-hidden="true" />Completed</span>
                    ) : (
                      <span className="stage-pill stage-pill-locked"><Lock aria-hidden="true" />{STATUS_LABEL[s.state] ?? "Locked"}</span>
                    )}
                    {interactive && (
                      <span className="stage-panel-cta" aria-hidden="true">Open <span className="button-arrow">→</span></span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <RejoinTeam />
    </div>
  );
}
