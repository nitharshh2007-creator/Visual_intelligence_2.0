"use client";

import { motion } from "framer-motion";

const SEGMENTS = ["OVERALL", "S1", "S2", "S3", "S4"];

interface Props {
  activeStage: number; // 0 = overall, 1-4 = specific
  onChange: (stage: number) => void;
}

export default function StageSegmentedControl({ activeStage, onChange }: Props) {
  return (
    <div
      className="relative flex gap-0.5 p-1 overflow-x-auto max-w-full"
      style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999 }}
      role="tablist"
      aria-label="Filter by stage"
    >
      {SEGMENTS.map((seg, i) => {
        const isActive = activeStage === i;
        return (
          <button
            key={seg}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(i)}
            className="relative px-3 md:px-4 py-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors"
            style={{ borderRadius: 999, color: isActive ? "var(--lb-ink)" : "var(--lb-grey-400)" }}
          >
            {isActive && (
              <motion.span
                layoutId="lb-segment-pill"
                transition={{ type: "spring", stiffness: 450, damping: 34 }}
                className="absolute inset-0"
                style={{ background: "var(--lb-white)", borderRadius: 999 }}
              />
            )}
            <span className="relative z-10">{seg}</span>
          </button>
        );
      })}
    </div>
  );
}
