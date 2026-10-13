"use client";

import { useEffect, useState } from "react";
import { adminApplyCutoff, adminPreviewCutoff, AdminError } from "@/lib/admin";
import type { CutoffPreview } from "@/lib/supabase";
import type { CutoffConfig } from "@/data/event";
import { ADVANCE_RULE } from "@/data/event";
import { X, AlertTriangle } from "lucide-react";

interface Props {
  config: CutoffConfig;
  onClose: () => void;
  onApplied: () => void;
}

export default function CutoffDialog({ config, onClose, onApplied }: Props) {
  const keepMode: "half" | "count" = config.keep === "half" ? "half" : "count";
  const keepValue = config.keep === "half" ? undefined : config.keep;

  const [preview, setPreview] = useState<CutoffPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    adminPreviewCutoff(config.afterStage, keepMode, keepValue)
      .then((result) => {
        setPreview(result);
        setSelectedTeams(new Set(result.teams.filter((team) => team.would_keep).map((team) => team.team_id)));
      })
      .catch((e) => setError(e instanceof AdminError ? e.message : "Failed to load preview"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTeam(teamId: string) {
    setSelectedTeams((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  const finalKeepCount = selectedTeams.size;

  async function handleApply() {
    if (confirmText !== "APPLY") return;
    setApplying(true);
    try {
      const selectedIds = Array.from(selectedTeams);
      const excludedIds = preview?.teams
        .filter((team) => !selectedTeams.has(team.team_id))
        .map((team) => team.team_id) ?? [];
      await adminApplyCutoff(config.afterStage, keepMode, keepValue, selectedIds, excludedIds, ADVANCE_RULE);
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof AdminError ? e.message : "Failed to apply cutoff");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0A0A0F] border border-white/15 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-bold uppercase tracking-wider text-lg text-white">
            Apply Cutoff — After Stage {config.afterStage}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-white/50 mb-4">
          Keeping: <span className="text-white">{config.keep === "half" ? "top half" : `top ${config.keep}`}</span>
          {preview && <span> · {preview.keep} of {preview.total_teams} by default</span>}
          · Advance rule: <span className="text-white">{ADVANCE_RULE}</span>
        </p>

        {loading && <p className="text-white/40 text-sm py-8 text-center">Loading preview…</p>}
        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        {preview && (
          <>
            {preview.tie_warning && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Tie at the cut line — all tied teams are checked by default. Adjust the checkboxes below before applying.</span>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto border border-white/10 rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0A0A0F]">
                  <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Rank</th>
                    <th className="text-left py-2 px-3">Team</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-center py-2 px-3">Advance?</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.teams.map((t) => {
                    const kept = selectedTeams.has(t.team_id);
                    return (
                      <tr key={t.team_id} className={`border-b border-white/5 ${kept ? "" : "opacity-40"}`}>
                        <td className="py-2 px-3 text-white/60">#{t.rank}</td>
                        <td className="py-2 px-3 text-white">{t.name}</td>
                        <td className="py-2 px-3 text-right text-white/80">{t.total}</td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={kept}
                            onChange={() => toggleTeam(t.team_id)}
                            aria-label={`${kept ? "Remove" : "Allow"} ${t.name} ${kept ? "from" : "to"} the next stage`}
                            className="h-4 w-4 accent-emerald-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-white/50 mb-4">
              Checked teams only: <span className="text-white font-bold">{finalKeepCount}</span> of {preview.total_teams} teams advance.
            </p>

            <div className="flex items-center gap-3">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Type "APPLY" to confirm'
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30"
              />
              <button
                onClick={handleApply}
                disabled={confirmText !== "APPLY" || applying}
                className="px-5 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs uppercase font-bold tracking-wider disabled:opacity-30"
              >
                {applying ? "Applying…" : "Apply Cutoff"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
