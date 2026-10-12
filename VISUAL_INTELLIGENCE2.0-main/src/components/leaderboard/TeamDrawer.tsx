"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { Team } from "@/lib/types";
import MedalCoin from "./MedalCoin";
import { initials as computeInitials, avatarColor } from "./helpers";
import type { PodiumMaterial } from "./TrophyIcon";

const ScoreHistoryChart = dynamic(() => import("./ScoreHistoryChart"), {
  ssr: false,
  loading: () => <div className="lb-skeleton w-full h-full" style={{ borderRadius: 8 }} />,
});

const MATERIAL_BG: Record<PodiumMaterial, string> = {
  gold: "var(--lb-gold-grad)",
  pearl: "var(--lb-pearl-grad)",
  graphite: "var(--lb-graphite-grad)",
};

interface Props {
  team: Team | null;
  onClose: () => void;
}

export default function TeamDrawer({ team, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap + Esc to close
  useEffect(() => {
    if (!team) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [team, onClose]);

  const stageNames = ["Cyber Styling", "BugX Hacker", "Prompt Rumble", "Prompt Charades"];
  const stageScores = team ? [team.scores.s1, team.scores.s2, team.scores.s3, team.scores.s4] : [];
  const maxScore = Math.max(...stageScores, 1);
  const bestStageIdx = stageScores.indexOf(Math.max(...stageScores));
  const podiumMaterial: PodiumMaterial | null = team && team.rank <= 3 ? (["gold", "pearl", "graphite"][team.rank - 1] as PodiumMaterial) : null;

  return (
    <AnimatePresence>
      {team && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          />

          {/* Drawer: slide-over on desktop */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto outline-none hidden md:block"
            style={{ background: "var(--lb-black)", borderLeft: "1px solid var(--lb-line)" }}
            role="dialog"
            aria-label={`Team detail for ${team.name}`}
          >
            <DrawerBody
              team={team}
              onClose={onClose}
              stageNames={stageNames}
              stageScores={stageScores}
              maxScore={maxScore}
              bestStageIdx={bestStageIdx}
              podiumMaterial={podiumMaterial}
            />
          </motion.div>

          {/* Mobile bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto outline-none md:hidden"
            style={{ background: "var(--lb-black)", borderTop: "1px solid var(--lb-line)", borderRadius: "20px 20px 0 0" }}
            role="dialog"
            aria-label={`Team detail for ${team.name}`}
          >
            <DrawerBody
              team={team}
              onClose={onClose}
              stageNames={stageNames}
              stageScores={stageScores}
              maxScore={maxScore}
              bestStageIdx={bestStageIdx}
              podiumMaterial={podiumMaterial}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({
  team,
  onClose,
  stageNames,
  stageScores,
  maxScore,
  bestStageIdx,
  podiumMaterial,
}: {
  team: Team;
  onClose: () => void;
  stageNames: string[];
  stageScores: number[];
  maxScore: number;
  bestStageIdx: number;
  podiumMaterial: PodiumMaterial | null;
}) {
  return (
    <div className="p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-lg"
        style={{ background: "rgba(255,255,255,0.06)", color: "var(--lb-white)", borderRadius: 999 }}
        aria-label="Close drawer"
      >
        ✕
      </button>

      {/* Header */}
      <div className="mb-8 pt-2">
        <div className="flex items-center gap-3 mb-4">
          {podiumMaterial ? (
            <div
              className="w-12 h-12 flex items-center justify-center font-black text-lg flex-shrink-0"
              style={{ background: MATERIAL_BG[podiumMaterial], color: podiumMaterial === "pearl" ? "var(--lb-ink)" : "var(--lb-white)", borderRadius: 999 }}
            >
              {team.rank}
            </div>
          ) : (
            <MedalCoin rank={team.rank} size={44} />
          )}
          <div>
            <h2 className="lb-display-800 text-xl" style={{ color: "var(--lb-white)", fontFamily: "Montserrat, sans-serif" }}>
              {team.name}
            </h2>
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--lb-rose-200)" }}>
              Total: {team.total} pts
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "var(--lb-rose-200)" }}>
            Members
          </h3>
          <div className="flex flex-wrap gap-2">
            {team.members.map((m, i) => {
              const c = avatarColor(i);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: "var(--lb-ink)", border: "1px solid var(--lb-line)", borderRadius: 10 }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: c.background, color: c.color }}
                  >
                    {m.initials || computeInitials(m.name)}
                  </div>
                  <div>
                    <span className="text-sm block leading-tight" style={{ color: "var(--lb-white)" }}>{m.name}</span>
                    {m.role && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--lb-grey-400)" }}>{m.role}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stage-by-stage bars */}
      <div className="mb-8">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4" style={{ color: "var(--lb-rose-200)" }}>
          Stage Breakdown
        </h3>
        <div className="space-y-3">
          {stageNames.map((name, i) => (
            <div key={name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold" style={{ color: i === bestStageIdx ? "var(--lb-white)" : "var(--lb-grey-400)" }}>
                  {name} {i === bestStageIdx && "★"}
                </span>
                <span style={{ color: "var(--lb-white)" }}>{stageScores[i]}</span>
              </div>
              <div className="h-2 overflow-hidden" style={{ background: "var(--lb-burgundy-900)", borderRadius: 999 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(stageScores[i] / maxScore) * 100}%` }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="h-full"
                  style={{ background: "var(--lb-white)", borderRadius: 999 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score history */}
      <div className="mb-8">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4" style={{ color: "var(--lb-rose-200)" }}>
          Score History
        </h3>
        <div className="h-24 p-2" style={{ background: "var(--lb-ink)", border: "1px solid var(--lb-line)", borderRadius: 12 }}>
          <ScoreHistoryChart data={team.scoreHistory} />
        </div>
      </div>

      {/* Best stage */}
      <div className="p-4" style={{ background: "var(--lb-burgundy-900)", border: "1px solid var(--lb-burgundy-700)", borderRadius: 12 }}>
        <div className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-1" style={{ color: "var(--lb-rose-200)" }}>
          Best Stage
        </div>
        <div className="text-sm font-bold" style={{ color: "var(--lb-white)" }}>{stageNames[bestStageIdx]}</div>
        <div className="text-xs mt-1" style={{ color: "var(--lb-grey-400)" }}>Score: {stageScores[bestStageIdx]} pts</div>
      </div>
    </div>
  );
}
