"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Team, ActivityEvent, EventState } from "@/lib/types";
import Podium from "./Podium";
import MedalCoin from "./MedalCoin";
import AnimatedNumber from "./AnimatedNumber";
import { denseRanks } from "./helpers";

interface Props {
  teams: Team[];
  activity: ActivityEvent[];
  eventState: EventState;
  onExit: () => void;
}

const PAGE_SIZE = 10;
const PAGE_INTERVAL_MS = 12000;

export default function ProjectorMode({ teams, activity, eventState, onExit }: Props) {
  const rest = teams.slice(3);
  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const ranks = denseRanks(teams);

  useEffect(() => {
    if (pageCount <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), PAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [pageCount]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onExit]);

  const safePage = page % pageCount;
  const pageTeams = rest.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="lb-theme fixed inset-0 z-[100] overflow-hidden" style={{ background: "var(--lb-black)" }}>
      <div className="lb-bg">
        <div className="lb-bg-glow" />
        <div className="lb-bg-silk" />
        <div className="lb-bg-grain" />
      </div>

      <div
        className="relative z-10 h-full flex flex-col p-6 md:p-10 origin-top"
        style={{ transform: "scale(1.4)", transformOrigin: "top center", width: "71.43%", margin: "0 auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <span className="lb-display-800 text-xs tracking-[0.18em]" style={{ color: "var(--lb-white)" }}>
              IEEE Computer Society
            </span>
            <span style={{ color: "var(--lb-grey-400)" }}> · </span>
            <span className="lb-display-800 text-xs tracking-[0.18em]" style={{ color: "var(--lb-rose-200)" }}>
              CSE
            </span>
            <h1 className="lb-display text-3xl mt-1" style={{ color: "var(--lb-white)" }}>
              Top Teams
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Stage strip */}
            <div className="flex items-center gap-2" aria-hidden="true">
              {eventState.stageStatuses.map((status, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${status === "live" ? "lb-live-dot" : ""}`}
                    style={{
                      background: status === "finished" ? "var(--lb-white)" : status === "live" ? "var(--lb-burgundy-300)" : "var(--lb-grey-400)",
                      opacity: status === "upcoming" ? 0.35 : 1,
                    }}
                  />
                  <span className="text-[10px] font-semibold" style={{ color: "var(--lb-grey-400)" }}>
                    S{i + 1}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999 }}
            >
              <span className="lb-live-dot w-2 h-2 rounded-full" style={{ background: "var(--lb-live)" }} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--lb-white)" }}>
                Live
              </span>
            </div>
            <button
              onClick={onExit}
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--lb-grey-400)", borderRadius: 999 }}
            >
              Esc to exit
            </button>
          </div>
        </div>

        {/* Podium */}
        <div className="flex-shrink-0">
          <Podium teams={teams} />
        </div>

        {/* Paging top 10 */}
        <div className="flex-1 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={safePage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="space-y-2"
            >
              {pageTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-4 px-4 py-2.5"
                  style={{ background: "var(--lb-ink)", borderRadius: 16, border: "1px solid var(--lb-line)" }}
                >
                  <MedalCoin rank={ranks.get(team.id) ?? team.rank} size={28} />
                  <span className="font-semibold text-base flex-1 truncate" style={{ color: "var(--lb-white)" }}>
                    {team.name}
                  </span>
                  <span className="lb-display-800 text-xl" style={{ color: "var(--lb-white)" }}>
                    <AnimatedNumber value={team.total} />
                  </span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Live feed ticker */}
        <div
          className="flex-shrink-0 mt-4 overflow-hidden"
          style={{ borderTop: "1px solid var(--lb-line)", paddingTop: 10 }}
        >
          <div className="flex gap-10 overflow-hidden whitespace-nowrap">
            {activity.slice(0, 8).map((a) => (
              <span key={a.id} className="text-xs" style={{ color: "var(--lb-grey-400)" }}>
                {a.message}
              </span>
            ))}
            {activity.length === 0 && (
              <span className="text-xs" style={{ color: "var(--lb-grey-400)" }}>
                Waiting for activity…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
