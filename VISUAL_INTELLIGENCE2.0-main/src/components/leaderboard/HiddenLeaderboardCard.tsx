"use client";

import { motion } from "framer-motion";
import type { StageStatus } from "@/lib/types";

interface Props {
  stageStatuses: StageStatus[];
}

// Shown on /leaderboard whenever event_state.leaderboard_visibility is
// 'hidden' and the caller has neither an admin session nor a valid
// projector token (get_leaderboard() already enforced that server-side
// — this is purely the "nothing to show" presentation, never a gate).
export default function HiddenLeaderboardCard({ stageStatuses }: Props) {
  const silhouetteHeights = [120, 170, 90]; // 2nd, 1st, 3rd — same podium order as the real thing

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center py-20"
    >
      {/* Faint podium silhouette */}
      <div className="flex items-end gap-3 mb-10 opacity-[0.08]" aria-hidden="true">
        {silhouetteHeights.map((h, i) => (
          <div key={i} className="w-20 md:w-28" style={{ height: h, background: "var(--lb-white)", borderRadius: 16 }} />
        ))}
      </div>

      <p className="text-[11px] font-semibold tracking-[0.25em] mb-3" style={{ color: "var(--lb-rose-200)" }}>
        VISUAL INTELLIGENCE 2.0
      </p>
      <h1 className="lb-display mb-4" style={{ fontSize: "clamp(28px, 6vw, 48px)", color: "var(--lb-white)" }}>
        LEADERBOARD HIDDEN
      </h1>
      <p className="text-sm max-w-sm" style={{ color: "var(--lb-grey-400)" }}>
        The organizers will reveal it soon. Check back shortly.
      </p>

      {/* Stage progress strip — still visible so the event's pace is legible */}
      <div className="flex items-center justify-center gap-2.5 mt-8" aria-hidden="true">
        {stageStatuses.map((status, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${status === "live" ? "lb-live-dot" : ""}`}
            style={{
              background: status === "finished" ? "var(--lb-white)" : status === "live" ? "var(--lb-burgundy-300)" : "var(--lb-grey-400)",
              opacity: status === "upcoming" ? 0.35 : 1,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
