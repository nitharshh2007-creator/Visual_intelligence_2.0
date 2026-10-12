"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Team } from "@/lib/types";
import TrophyIcon, { type PodiumMaterial } from "./TrophyIcon";
import AnimatedNumber from "./AnimatedNumber";
import { avatarColor, initials as computeInitials } from "./helpers";

interface Props {
  team: Team;
  rank: 1 | 2 | 3;
  material: PodiumMaterial;
  heightClass: string;
  delay: number;
  isFlashing?: boolean;
}

function pickThreeStages(scores: Team["scores"]) {
  const all = [1, 2, 3, 4].map((s) => ({ stage: s, value: scores[`s${s}` as keyof typeof scores] }));
  const scored = all.filter((x) => x.value > 0);
  return scored.length >= 3 ? scored.slice(-3) : all.slice(0, 3);
}

const MATERIAL_BG: Record<PodiumMaterial, string> = {
  gold: "var(--lb-gold-grad)",
  pearl: "var(--lb-pearl-grad)",
  graphite: "var(--lb-graphite-grad)",
};

const MATERIAL_TEXT: Record<PodiumMaterial, string> = {
  gold: "var(--lb-white)",
  pearl: "var(--lb-ink)",
  graphite: "var(--lb-white)",
};

const MATERIAL_MUTED: Record<PodiumMaterial, string> = {
  gold: "rgba(255,255,255,0.75)",
  pearl: "rgba(11,11,12,0.6)",
  graphite: "rgba(255,255,255,0.65)",
};

export default function PodiumCard({ team, rank, material, heightClass, delay, isFlashing }: Props) {
  const reduceMotion = useReducedMotion();
  const topStages = pickThreeStages(team.scores);
  const visibleMembers = team.members.slice(0, 3);
  const overflow = team.members.length - visibleMembers.length;

  return (
    <motion.div
      layout
      layoutId={`podium-${team.id}`}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        rank === 1
          ? { delay, duration: 0.7, type: "spring", stiffness: 260, damping: 18 }
          : { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
      }
      tabIndex={0}
      role="group"
      aria-label={`Rank ${rank}: ${team.name}, ${team.total} points`}
      className={`lb-tilt relative flex flex-col justify-between overflow-hidden outline-none ${heightClass} ${isFlashing ? "lb-flash" : ""}`}
      style={{
        background: MATERIAL_BG[material],
        borderRadius: 28,
        border: material === "graphite" ? "1px solid rgba(255,255,255,0.2)" : "none",
        boxShadow: "0 24px 48px -16px rgba(109,0,26,0.45)",
        padding: "20px",
      }}
    >
      {!reduceMotion && <div className="lb-shine" aria-hidden="true" />}

      {/* Top row: score label + avatars */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div
            className="text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: MATERIAL_MUTED[material] }}
          >
            Score
          </div>
          <AnimatedNumberStyled value={team.total} color={MATERIAL_TEXT[material]} size={rank === 1 ? 44 : 34} />

          <div className="flex gap-3 mt-2">
            {topStages.map(({ stage, value }) => (
              <div key={stage}>
                <div className="text-sm font-bold" style={{ color: MATERIAL_TEXT[material] }}>
                  {value || "–"}
                </div>
                <div
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: MATERIAL_MUTED[material] }}
                >
                  S{stage}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex -space-x-2 flex-shrink-0">
          {visibleMembers.map((m, i) => {
            const c = avatarColor(i);
            return (
              <div
                key={i}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: c.background, color: c.color, border: "2px solid rgba(255,255,255,0.7)" }}
                title={m.name}
              >
                {m.initials || computeInitials(m.name)}
              </div>
            );
          })}
          {overflow > 0 && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.4)", color: MATERIAL_TEXT[material], border: "2px solid rgba(255,255,255,0.7)" }}
            >
              +{overflow}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: name + trophy */}
      <div className="relative z-10 flex items-end justify-between gap-2">
        <div
          className="font-bold uppercase text-sm leading-tight"
          style={{
            color: MATERIAL_TEXT[material],
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {team.name}
        </div>
        <motion.div
          className="flex-shrink-0 -mb-4 -mr-4"
          whileHover={reduceMotion ? {} : { y: -6, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <TrophyIcon material={material} rank={rank} size={rank === 1 ? 72 : 56} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// AnimatedNumber's className prop can't carry a dynamic inline color
// cleanly alongside the gradient title's text-clip trick used
// elsewhere, so this tiny wrapper applies the material color directly.
function AnimatedNumberStyled({ value, color, size }: { value: number; color: string; size: number }) {
  return (
    <div style={{ color, fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: size, lineHeight: 1 }}>
      <AnimatedNumber value={value} />
    </div>
  );
}
