"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Team } from "@/lib/types";
import PodiumCard from "./PodiumCard";
import type { PodiumMaterial } from "./TrophyIcon";

interface Props {
  teams: Team[];
}

const MATERIALS: PodiumMaterial[] = ["gold", "pearl", "graphite"];
const HEIGHTS = ["h-[260px] md:h-[320px]", "h-[300px] md:h-[380px]", "h-[240px] md:h-[300px]"]; // 2nd, 1st, 3rd display order

function EmptySlot({ rank, heightClass }: { rank: number; heightClass: string }) {
  return (
    <div
      className={`flex items-center justify-center ${heightClass}`}
      style={{
        border: "2px dashed rgba(255,255,255,0.15)",
        borderRadius: 28,
        color: "var(--lb-grey-400)",
      }}
    >
      <div className="text-center">
        <div className="lb-display text-2xl opacity-40">#{rank}</div>
        <div className="text-[10px] uppercase tracking-wider mt-1 opacity-60">Waiting…</div>
      </div>
    </div>
  );
}

export default function Podium({ teams }: Props) {
  const top3 = teams.slice(0, 3);
  const leaderIdRef = useRef<string | null>(null);
  const [flashLeader, setFlashLeader] = useState<string | null>(null);

  useEffect(() => {
    const currentLeader = top3[0]?.id ?? null;
    if (currentLeader && leaderIdRef.current && currentLeader !== leaderIdRef.current) {
      setFlashLeader(currentLeader);
      const t = setTimeout(() => setFlashLeader(null), 1200);
      leaderIdRef.current = currentLeader;
      return () => clearTimeout(t);
    }
    leaderIdRef.current = currentLeader;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top3[0]?.id]);

  // Display order: 2nd, 1st, 3rd (classic podium layout)
  const displayOrder: (Team | null)[] = [top3[1] ?? null, top3[0] ?? null, top3[2] ?? null];
  const displayRanks: (1 | 2 | 3)[] = [2, 1, 3];

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-5 items-end mb-10 md:mb-16" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {displayOrder.map((team, i) => {
          const rank = displayRanks[i];
          const material = MATERIALS[rank - 1];
          if (!team) {
            return <EmptySlot key={`empty-${rank}`} rank={rank} heightClass={HEIGHTS[i]} />;
          }
          return (
            <PodiumCard
              key={team.id}
              team={team}
              rank={rank}
              material={material}
              heightClass={HEIGHTS[i]}
              delay={rank === 1 ? 0.3 : i * 0.12}
              isFlashing={flashLeader === team.id}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
