"use client";

import type { StageAccessEntry } from "@/lib/supabase";

interface Props {
  stages: StageAccessEntry[];
}

const LABELS: Record<string, string> = {
  LOCKED: "Locked",
  RELEASED: "Ready",
  LIVE: "Live",
  COMPLETED: "Done",
  ELIMINATED: "Out",
};

const DOT_CLASS: Record<string, string> = {
  LOCKED: "bg-white/10 border-white/20 text-white/30",
  RELEASED: "bg-white/10 border-white/40 text-white",
  LIVE: "bg-emerald-500/20 border-emerald-400 text-emerald-300",
  COMPLETED: "bg-white text-black border-white",
  ELIMINATED: "bg-red-500/10 border-red-500/40 text-red-300",
};

// Four nodes: locked / available (released) / live / done / eliminated.
// "Available" here covers the spec's RELEASED state (released but not
// started yet) — same visual slot, different label.
export default function StageProgressRail({ stages }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 mb-12" role="list" aria-label="Stage progress">
      {stages.map((s, i) => (
        <div key={s.stage} className="flex items-center" role="listitem">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center font-serif text-lg transition-colors ${DOT_CLASS[s.state]} ${
                s.state === "LIVE" ? "animate-pulse" : ""
              }`}
            >
              {s.state === "COMPLETED" ? "✓" : s.state === "LOCKED" ? "🔒" : s.state === "ELIMINATED" ? "✕" : s.stage}
            </div>
            <span className="text-[9px] uppercase tracking-widest text-white/40">{LABELS[s.state]}</span>
          </div>
          {i < stages.length - 1 && (
            <div className={`w-8 md:w-16 h-[1px] mb-5 ${s.state === "COMPLETED" ? "bg-white/50" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
