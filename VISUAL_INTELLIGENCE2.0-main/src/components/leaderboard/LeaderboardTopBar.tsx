"use client";

import StageSegmentedControl from "./StageSegmentedControl";
import { useNow } from "@/hooks/useNow";
import type { ConnectionStatus } from "@/lib/types";

interface Props {
  activeStage: number;
  onStageChange: (stage: number) => void;
  connection: ConnectionStatus;
  lastUpdated: number;
}

export default function LeaderboardTopBar({ activeStage, onStageChange, connection, lastUpdated }: Props) {
  const now = useNow();
  const secondsAgo = now === null ? null : Math.max(0, Math.floor((now - lastUpdated) / 1000));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-5">
      {/* Wordmark */}
      <div className="flex items-center gap-2">
        <span className="lb-display-800 text-[11px] tracking-[0.18em]" style={{ color: "var(--lb-white)" }}>
          IEEE Computer Society
        </span>
        <span style={{ color: "var(--lb-grey-400)" }}>·</span>
        <span className="lb-display-800 text-[11px] tracking-[0.18em]" style={{ color: "var(--lb-rose-200)" }}>
          DSCS
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Live badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999 }}
        >
          <span
            className="lb-live-dot w-2 h-2 rounded-full"
            style={{ background: "var(--lb-live)" }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--lb-white)" }}>
            {connection === "connected" ? "Live" : "Reconnecting"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--lb-grey-400)" }}>
            · updated {secondsAgo === null ? "…" : `${secondsAgo}s`} ago
          </span>
        </div>

        <StageSegmentedControl activeStage={activeStage} onChange={onStageChange} />
      </div>
    </div>
  );
}
