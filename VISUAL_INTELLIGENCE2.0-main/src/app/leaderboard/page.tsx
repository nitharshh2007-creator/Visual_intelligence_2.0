"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useTeamGate } from "@/hooks/useTeamGate";
import { checkIsAdmin } from "@/lib/admin";
import type { Team, LeaderboardData } from "@/lib/types";
import TeamGateContent from "@/components/TeamGateContent";
import { Megaphone } from "lucide-react";

import "@/app/lb-theme.css";
import LeaderboardTopBar from "@/components/leaderboard/LeaderboardTopBar";
import TitleBlock from "@/components/leaderboard/TitleBlock";
import Podium from "@/components/leaderboard/Podium";
import RankList from "@/components/leaderboard/RankList";
import LiveFeed from "@/components/leaderboard/LiveFeed";
import TeamDrawer from "@/components/leaderboard/TeamDrawer";
import ProjectorMode from "@/components/leaderboard/ProjectorMode";
import DemoPanel from "@/components/leaderboard/DemoPanel";
import HiddenLeaderboardCard from "@/components/leaderboard/HiddenLeaderboardCard";

export default function LeaderboardPage() {
  // Read before the first render that needs it (projector links are
  // meant to work immediately, not after a tick) but still client-only
  // — same "null until mount" reasoning as the demo flag below, just
  // read eagerly since useLeaderboard() needs it on its very first call.
  const [projectorToken, setProjectorToken] = useState<string | null>(null);
  const [paramsReady, setParamsReady] = useState(false);
  // Only meaningful for an admin session — get_leaderboard() still
  // applies the cutoff filter to a non-admin caller regardless of this
  // flag, so the toggle below is hidden unless isAdmin is true.
  const [showEliminated, setShowEliminated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const liveData = useLeaderboard(projectorToken, showEliminated);
  // The projector link is the one thing allowed to bypass this — it's
  // meant for a venue screen/spectators with no team at all. Everyone
  // else needs a real, TEAM_MIN+ team, same as /stages.
  const teamGate = useTeamGate();
  const [demoOverride, setDemoOverride] = useState<LeaderboardData | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const data = demoOverride ?? liveData;
  const { teams, activity, eventState, connection, lastUpdated, isLoading, visibility, round, totalTeams, shownTeams } = data;

  const [activeStage, setActiveStage] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  useEffect(() => {
    function detect() {
      const params = new URLSearchParams(window.location.search);
      setDemoEnabled(params.get("demo") === "1");
      setProjectorToken(params.get("pt"));
      setParamsReady(true);
    }
    detect();
    checkIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, []);

  // Keyboard shortcut: F for projector, Esc to exit
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) setIsProjectorMode((p) => !p);
      if (e.key === "Escape" && isProjectorMode) setIsProjectorMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isProjectorMode]);

  const handleTeamClick = useCallback((team: Team) => setSelectedTeam(team), []);

  if (isProjectorMode) {
    return (
      <ProjectorMode
        teams={teams}
        activity={activity}
        eventState={eventState}
        onExit={() => setIsProjectorMode(false)}
      />
    );
  }

  return (
    <div className="lb-theme relative">
      {/* Background */}
      <div className="lb-bg">
        <div className="lb-bg-glow" />
        <div className="lb-bg-silk" />
        <div className="lb-bg-grain" />
      </div>
      <span className="lb-ghost-word" style={{ left: 12, top: "20vh" }} aria-hidden="true">
        RANKINGS
      </span>
      <span className="lb-ghost-word" style={{ right: 12, top: "20vh" }} aria-hidden="true">
        VISUAL INTELLIGENCE
      </span>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        {/* Nav */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-4" style={{ borderBottom: "1px solid var(--lb-line)" }}>
          <Link href="/" className="min-h-11 inline-flex items-center text-xs font-semibold uppercase tracking-[0.15em] hover:!text-white transition-colors" style={{ color: "var(--lb-grey-400)" }}>
            ← Home
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowEliminated((v) => !v)}
                className="lb-chip-btn text-xs font-semibold uppercase tracking-[0.15em] px-3 py-1.5"
                style={{
                  background: showEliminated ? "var(--lb-burgundy-700)" : "rgba(255,255,255,0.06)",
                  color: "var(--lb-white)",
                  borderRadius: 999,
                }}
              >
                {showEliminated ? "Hiding Eliminated: Off" : "Show Eliminated Teams"}
              </button>
            )}
            <button
              onClick={() => setIsProjectorMode(true)}
              className="lb-chip-btn text-xs font-semibold uppercase tracking-[0.15em] px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--lb-white)", borderRadius: 999 }}
            >
              Projector Mode (F)
            </button>
          </div>
        </div>

        <LeaderboardTopBar
          activeStage={activeStage}
          onStageChange={setActiveStage}
          connection={connection}
          lastUpdated={lastUpdated}
        />

        {connection !== "connected" && (
          <div
            className="mb-4 px-4 py-2.5 text-center text-xs font-semibold"
            style={{ background: "var(--lb-burgundy-900)", border: "1px solid var(--lb-burgundy-700)", color: "var(--lb-rose-200)", borderRadius: 12 }}
          >
            Reconnecting to live data…
          </div>
        )}

        {eventState.announcement && (
          <div
            className="mb-4 px-4 py-3 text-center text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "var(--lb-burgundy-900)", border: "1px solid var(--lb-burgundy-700)", color: "var(--lb-white)", borderRadius: 12 }}
          >
            <Megaphone className="w-4 h-4 shrink-0 text-[#e9adb5]" />
            <span>{eventState.announcement}</span>
          </div>
        )}

        <TitleBlock eventState={eventState} round={round} totalTeams={totalTeams} shownTeams={shownTeams} />

        {paramsReady && !projectorToken && teamGate.state !== "checking" && teamGate.state !== "ok" ? (
          <TeamGateContent state={teamGate.state} team={teamGate.team} />
        ) : isLoading ? (
          <div className="space-y-3 pb-16">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="lb-skeleton h-16" style={{ borderRadius: 20 }} />
            ))}
          </div>
        ) : visibility === "hidden" ? (
          <HiddenLeaderboardCard stageStatuses={eventState.stageStatuses} />
        ) : (
          <>
            <Podium teams={teams} />

            <div className="grid lg:grid-cols-[1fr_320px] gap-8 pb-16">
              <RankList teams={teams} activeStage={activeStage} onTeamClick={handleTeamClick} />
              <aside className="hidden lg:block">
                <LiveFeed activity={activity} />
              </aside>
            </div>

            <div className="lg:hidden pb-16 -mt-8">
              <LiveFeed activity={activity} />
            </div>
          </>
        )}
      </div>

      <TeamDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />

      {demoEnabled && (
        <DemoPanel current={data} onApply={setDemoOverride} isOverridden={demoOverride !== null} />
      )}
    </div>
  );
}
