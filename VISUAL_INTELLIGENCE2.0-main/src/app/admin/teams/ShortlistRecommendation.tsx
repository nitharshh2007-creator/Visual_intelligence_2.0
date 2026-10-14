"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import type { Recommendation } from "@/lib/shortlistRanking";

interface Props {
  title: string;
  basis: string; // e.g. "Level 1 + Level 2 (out of 50)"
  partColumns: { key: string; label: string }[];
  totalLabel: string;
  rec: Recommendation;
  topN: number;
  onTopNChange: (n: number) => void;
  onApply: () => void;
  selectedIds: ReadonlySet<string>;
  onToggle: (teamId: string) => void;
  accent: "emerald" | "wine";
}

// Recommendation only: ticking here changes the local selection, exactly like
// the row checkboxes below. Nothing is written until the existing Confirm step.
export default function ShortlistRecommendation({
  title, basis, partColumns, totalLabel, rec, topN, onTopNChange, onApply, selectedIds, onToggle, accent,
}: Props) {
  const tone = accent === "emerald" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-wine-300 border-wine-500/40 bg-wine-500/10 hover:bg-wine-500/20";
  const scored = rec.ranked.length;

  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3 font-mono text-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> {title}
          </div>
          <p className="text-white/50 mt-1">
            Ranked by {basis}. Recommendation only — review it, change any ticks, then confirm. Nothing is saved until you confirm.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-white/70">
            <span>Top</span>
            <input
              type="number"
              min={1}
              value={topN}
              onChange={(e) => onTopNChange(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-14 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-white"
              aria-label="Number of teams to recommend"
            />
          </label>
          <button
            onClick={onApply}
            disabled={rec.recommendedIds.length === 0}
            className={`px-3 py-1.5 rounded-lg border font-bold uppercase transition-colors disabled:opacity-40 ${tone}`}
          >
            Tick recommended ({rec.recommendedIds.length})
          </button>
        </div>
      </div>

      {scored < rec.topN && (
        <p className="text-white/60">
          Only {scored} team{scored === 1 ? " is" : "s are"} fully marked — fewer than the top {rec.topN}. All of them are recommended.
        </p>
      )}

      {rec.tiedAtCutoffIds.length > 0 && (
        <div className="flex gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200" role="status">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Tie at the cutoff: {rec.tiedAtCutoffIds.length} team(s) share the same total for {rec.openSlots} remaining slot(s).
            The judge sheet has no tie-break for this ranking — decide and tick them yourself.
          </span>
        </div>
      )}

      {rec.missing.length > 0 && (
        <div className="p-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/70">
          <span className="text-amber-300 font-bold">Missing evaluations ({rec.missing.length}) — not ranked, never counted as zero: </span>
          {rec.missing.map((m) => `${m.name} (${m.missing.join(", ")})`).join(" · ")}
        </div>
      )}

      {scored > 0 && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-white/5">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/80 text-white/40 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Team</th>
                {partColumns.map((c) => <th key={c.key} className="px-3 py-2 text-right">{c.label}</th>)}
                <th className="px-3 py-2 text-right">{totalLabel}</th>
                <th className="px-3 py-2">Recommendation</th>
                <th className="px-3 py-2 text-center">Ticked</th>
              </tr>
            </thead>
            <tbody>
              {rec.ranked.map((r) => (
                <tr key={r.teamId} className={`border-t border-white/5 ${r.recommended ? "bg-white/[0.03]" : ""}`}>
                  <td className="px-3 py-1.5 text-white font-bold">#{r.rank}</td>
                  <td className="px-3 py-1.5 text-white">{r.name}</td>
                  {partColumns.map((c) => <td key={c.key} className="px-3 py-1.5 text-right text-white/70">{r.parts[c.key]}</td>)}
                  <td className="px-3 py-1.5 text-right text-white font-bold">{r.value}</td>
                  <td className="px-3 py-1.5">
                    {r.recommended ? (
                      <span className="text-emerald-300">Recommended</span>
                    ) : r.tiedAtCutoff ? (
                      <span className="text-amber-300">Tie at cutoff — review</span>
                    ) : (
                      <span className="text-white/30">Below top {rec.topN}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.teamId)}
                      onChange={() => onToggle(r.teamId)}
                      aria-label={`Tick ${r.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
