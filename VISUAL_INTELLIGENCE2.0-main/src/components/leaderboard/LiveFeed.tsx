"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ActivityEvent } from "@/lib/types";
import { useNow } from "@/hooks/useNow";

const ICONS: Record<string, string> = {
  score: "●",
  rank_change: "↕",
  stage_complete: "✓",
  join: "+",
};

interface Props {
  activity: ActivityEvent[];
}

export default function LiveFeed({ activity }: Props) {
  const now = useNow();
  const items = activity.slice(0, 30);

  return (
    <div>
      <h2 className="lb-display-800 text-sm tracking-wider mb-4" style={{ color: "var(--lb-white)" }}>
        Live Feed
      </h2>
      <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {items.map((event) => {
            const timeAgo = now === null ? null : Math.max(0, Math.floor((now - event.at) / 1000));
            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-2.5 px-3 py-2"
                style={{ background: "var(--lb-ink)", borderRadius: 12, border: "1px solid var(--lb-line)" }}
              >
                <span
                  className="flex-shrink-0 mt-0.5 text-xs"
                  style={{ color: "var(--lb-burgundy-300)" }}
                  aria-hidden="true"
                >
                  {ICONS[event.type] || "•"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {event.message}
                  </p>
                  <span className="text-[10px]" style={{ color: "var(--lb-grey-400)" }}>
                    {timeAgo === null ? "…" : timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="text-center py-10 text-xs" style={{ color: "var(--lb-grey-400)" }}>
            Waiting for activity…
          </div>
        )}
      </div>
    </div>
  );
}
