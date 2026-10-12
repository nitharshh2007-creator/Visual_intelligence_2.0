"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Team } from "@/lib/types";
import MedalCoin from "./MedalCoin";
import AnimatedNumber from "./AnimatedNumber";
import { avatarColor, initials as computeInitials, rankDelta } from "./helpers";

interface Props {
  team: Team;
  displayRank: number;
  displayScore: number; // total, or the active stage's score when filtered
  isTied: boolean;
  highlighted?: boolean;
  onOpen: (team: Team) => void;
}

const STAGES = [1, 2, 3, 4] as const;

const RankRow = memo(function RankRow({ team, displayRank, displayScore, isTied, highlighted, onOpen }: Props) {
  const reduceMotion = useReducedMotion();
  const delta = rankDelta(team);

  const [flash, setFlash] = useState(false);
  const [showDelta, setShowDelta] = useState(true);
  const prevScoreRef = useRef(displayScore);

  useEffect(() => {
    if (prevScoreRef.current !== displayScore) {
      prevScoreRef.current = displayScore;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [displayScore]);

  useEffect(() => {
    if (delta === 0) return;
    setShowDelta(true);
    const t = setTimeout(() => setShowDelta(false), 8000);
    return () => clearTimeout(t);
  }, [delta, team.rank]);

  const firstMember = team.members[0];
  const extraCount = Math.max(0, team.members.length - 1);

  return (
    <motion.div
      layout
      data-team-id={team.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], layout: { type: "spring", stiffness: 300, damping: 30 } }}
      onClick={() => onOpen(team)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(team);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${team.name}, rank ${displayRank}, ${displayScore} points. Open details.`}
      className="lb-row relative flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 cursor-pointer outline-none"
      style={{
        background: "var(--lb-ink)",
        borderRadius: 20,
        border: `1px solid ${highlighted ? "var(--lb-burgundy-300)" : "var(--lb-line)"}`,
        boxShadow: flash && !reduceMotion ? "0 0 0 2px var(--lb-burgundy-500)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Medal + avatar + name */}
      <div className="flex items-center flex-shrink-0" style={{ minWidth: 0 }}>
        <div className="relative flex items-center">
          <MedalCoin rank={displayRank} size={30} />
          {firstMember && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold -ml-2"
              style={{ ...avatarColor(0), border: "2px solid var(--lb-ink)" }}
              title={firstMember.name}
            >
              {firstMember.initials || computeInitials(firstMember.name)}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 md:flex-none md:w-40">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate" style={{ color: "var(--lb-white)" }}>
            {team.name}
          </span>
          {isTied && (
            <span
              title="Ties break by most recent stage score"
              className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 cursor-help"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--lb-grey-400)" }}
            >
              tie
            </span>
          )}
        </div>
        {extraCount > 0 && (
          <span className="text-[10px]" style={{ color: "var(--lb-grey-400)" }}>
            +{extraCount} more
          </span>
        )}
      </div>

      {/* Stage columns */}
      <div className="hidden md:flex items-center gap-5 ml-auto">
        {STAGES.map((s) => {
          const val = team.scores[`s${s}` as keyof typeof team.scores];
          return (
            <div key={s} className="text-center w-10">
              <div className="font-bold text-sm" style={{ color: val ? "var(--lb-white)" : "var(--lb-grey-400)" }}>
                {val || "–"}
              </div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--lb-grey-400)" }}>
                S{s}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: two latest stages */}
      <div className="flex md:hidden items-center gap-3 ml-auto">
        {STAGES.slice(-2).map((s) => {
          const val = team.scores[`s${s}` as keyof typeof team.scores];
          return (
            <div key={s} className="text-center">
              <div className="font-bold text-xs" style={{ color: val ? "var(--lb-white)" : "var(--lb-grey-400)" }}>
                {val || "–"}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: "var(--lb-grey-400)" }}>
                S{s}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total + delta */}
      <div className="text-right flex-shrink-0 md:w-20">
        <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--lb-grey-400)" }}>
          Score
        </div>
        <div className="lb-display-800 text-lg" style={{ color: "var(--lb-white)", fontFamily: "Montserrat, sans-serif" }}>
          <AnimatedNumber value={displayScore} />
        </div>
        <AnimatePresence>
          {delta !== 0 && showDelta && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-semibold"
              style={{ color: delta > 0 ? "var(--lb-white)" : "var(--lb-burgundy-300)" }}
            >
              {delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
            </motion.div>
          )}
          {delta === 0 && (
            <div className="text-[10px]" style={{ color: "var(--lb-grey-400)" }}>
              –
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export default RankRow;
