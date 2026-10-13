"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { LeaderboardData, Team, ActivityEvent } from "@/lib/types";

// Dev-only panel (mounted by page.tsx only when ?demo=1). Everything
// here is a self-contained synthetic-data generator — it never calls
// into useLeaderboard(), registration.ts or supabase.ts, so none of
// the real data layer is touched by these scenarios.

interface Props {
  current: LeaderboardData;
  onApply: (data: LeaderboardData | null) => void;
  isOverridden: boolean;
}

function cloneTeam(t: Team): Team {
  return { ...t, scores: { ...t.scores }, members: t.members.map((m) => ({ ...m })), scoreHistory: [...t.scoreHistory] };
}

function rerank(teams: Team[]): Team[] {
  const sorted = [...teams].sort((a, b) => b.total - a.total);
  return sorted.map((t, i) => ({ ...t, prevRank: t.rank || i + 1, rank: i + 1 }));
}

function makeSyntheticTeam(i: number, namePrefix = "Demo Team"): Team {
  const s1 = Math.floor(Math.random() * 40) + 60;
  const s2 = Math.floor(Math.random() * 40) + 55;
  const s3 = Math.floor(Math.random() * 30) + 50;
  const s4 = Math.floor(Math.random() * 20);
  const total = s1 + s2 + s3 + s4;
  return {
    id: `demo-${i}`,
    name: `${namePrefix} ${i + 1}`,
    members: [
      { name: "Member A", initials: "MA", role: "Captain" },
      { name: "Member B", initials: "MB" },
      { name: "Member C", initials: "MC" },
    ],
    scores: { s1, s2, s3, s4 },
    total,
    rank: 0,
    prevRank: 0,
    updatedAt: Date.now(),
    scoreHistory: [total],
  };
}

const SCENARIOS: { key: string; label: string }[] = [
  { key: "new-leader", label: "New leader" },
  { key: "ties", label: "Ties" },
  { key: "finished", label: "Finished" },
  { key: "100-teams", label: "100 teams" },
  { key: "long-names", label: "Long names" },
  { key: "empty", label: "Empty" },
  { key: "paused", label: "Paused" },
];

export default function DemoPanel({ current, onApply, isOverridden }: Props) {
  const [open, setOpen] = useState(true);

  function run(key: string) {
    const base = current.teams.map(cloneTeam);

    switch (key) {
      case "new-leader": {
        if (base.length < 2) return;
        const sorted = rerank(base);
        sorted[1].total = sorted[0].total + 15;
        sorted[1].scores.s4 += 15;
        onApply({ ...current, teams: rerank(sorted) });
        return;
      }
      case "ties": {
        const sorted = rerank(base);
        const tieValue = sorted[0]?.total ?? 100;
        for (let i = 0; i < Math.min(4, sorted.length); i++) sorted[i].total = tieValue;
        onApply({ ...current, teams: rerank(sorted) });
        return;
      }
      case "finished": {
        onApply({
          ...current,
          teams: rerank(base),
          eventState: {
            ...current.eventState,
            status: "finished",
            stageStatuses: ["finished", "finished", "finished", "finished"],
          },
        });
        return;
      }
      case "100-teams": {
        const synthetic = Array.from({ length: 100 }, (_, i) => makeSyntheticTeam(i));
        onApply({ ...current, teams: rerank(synthetic), isLoading: false });
        return;
      }
      case "long-names": {
        const longNamed = base.map((t, i) => ({
          ...t,
          name: `${t.name} — The Extraordinarily Long Team Name Edition ${i + 1}`,
        }));
        onApply({ ...current, teams: rerank(longNamed) });
        return;
      }
      case "empty": {
        const empty: ActivityEvent[] = [];
        onApply({ ...current, teams: [], activity: empty, isLoading: false });
        return;
      }
      case "paused": {
        onApply({
          ...current,
          teams: rerank(base),
          eventState: { ...current.eventState, status: "paused", pausedRemainingMs: 95000 },
        });
        return;
      }
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-[200]" style={{ fontFamily: "Inter, sans-serif" }}>
      {open ? (
        <div
          className="p-3 w-56"
          style={{ background: "rgba(10,10,11,0.95)", border: "1px solid var(--lb-line)", borderRadius: 14, backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--lb-rose-200)" }}>
              Demo Panel
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: "var(--lb-grey-400)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                onClick={() => run(s.key)}
                className="px-2 py-1.5 text-[10px] font-semibold"
                style={{ background: "rgba(255,255,255,0.08)", color: "var(--lb-white)", borderRadius: 8 }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onApply(null)}
            disabled={!isOverridden}
            className="w-full mt-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: isOverridden ? "var(--lb-burgundy-700)" : "rgba(255,255,255,0.04)",
              color: isOverridden ? "var(--lb-white)" : "var(--lb-grey-400)",
              borderRadius: 8,
            }}
          >
            Reset to live data
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: "rgba(10,10,11,0.95)", color: "var(--lb-rose-200)", borderRadius: 999, border: "1px solid var(--lb-line)" }}
        >
          Demo
        </button>
      )}
    </div>
  );
}
