"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGetStageOverview, adminReleaseStage, adminUndoCutoff, adminSetTeamStageOverride, AdminError } from "@/lib/admin";
import type { AdminStageOverview } from "@/lib/supabase";
import type { EventStateRow } from "@/lib/supabase";
import { CUTOFFS } from "@/data/event";
import CutoffDialog from "./CutoffDialog";

interface Props {
  eventState: EventStateRow | null;
  onStart: (stage: number) => void;
  onEnd: () => void;
  onToggleVisibility: () => void;
  onSetEventStatus: (status: "live" | "finished") => void;
  onCopyProjectorLink: () => void;
  onRotateProjectorLink: () => void;
  onToggleRegistration: () => void;
}

type FlowStep =
  | { kind: "stage"; stage: number }
  | { kind: "cutoff"; afterStage: number }
  | { kind: "final" };

function buildSteps(): FlowStep[] {
  const steps: FlowStep[] = [];
  for (let stage = 1; stage <= 4; stage++) {
    steps.push({ kind: "stage", stage });
    const cutoff = CUTOFFS.find((c) => c.afterStage === stage);
    if (cutoff) steps.push({ kind: "cutoff", afterStage: stage });
  }
  steps.push({ kind: "final" });
  return steps;
}

const STEPS = buildSteps();

export default function EventFlowPanel({
  eventState,
  onStart,
  onEnd,
  onToggleVisibility,
  onSetEventStatus,
  onCopyProjectorLink,
  onRotateProjectorLink,
  onToggleRegistration,
}: Props) {
  const [overview, setOverview] = useState<AdminStageOverview | null>(null);
  const [cutoffDialogStage, setCutoffDialogStage] = useState<number | null>(null);
  const [expandedOverrides, setExpandedOverrides] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminGetStageOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, eventState?.current_stage, eventState?.status, eventState?.current_round]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRelease(stage: number) {
    if (!confirm(`Release Stage ${stage}? Teams that qualify will see it immediately.`)) return;
    try {
      await adminReleaseStage(stage);
      flash(`Stage ${stage} released`);
      refresh();
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed to release stage");
    }
  }

  async function handleUndoCutoff(afterStage: number) {
    if (!confirm(`Undo the cutoff after Stage ${afterStage}? This removes it and any later cutoff.`)) return;
    try {
      await adminUndoCutoff(afterStage);
      flash("Cutoff undone");
      refresh();
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed to undo cutoff");
    }
  }

  async function handleOverride(teamId: string, stage: number, allowed: boolean) {
    try {
      await adminSetTeamStageOverride(teamId, stage, allowed, allowed ? "manual grant" : "manual revoke");
      flash(allowed ? "Access granted" : "Access revoked");
      refresh();
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed");
    }
  }

  const stageStatus = (n: number) => overview?.stages.find((s) => s.stage === n)?.status ?? "not_released";
  const completedCount = (n: number) => overview?.teams.filter((t) => t.access[String(n)]?.state === "COMPLETED").length ?? 0;
  const totalCount = overview?.teams.length ?? 0;
  const cutoffApplied = (afterStage: number) => (eventState?.current_round ?? 0) >= afterStage;

  return (
    <section className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md relative">
      {toast && <div className="absolute top-2 right-2 px-3 py-1.5 rounded bg-black text-white text-xs z-10">{toast}</div>}

      <h2 className="font-sans font-bold uppercase tracking-[0.12em] text-sm text-white/80 mb-6">Event Flow</h2>

      {/* Registration — independent on/off switch, not tied to the
          deadline (see migration 0014). Closing it here never changes
          registration_deadline, so reopening never requires picking a
          new date; it's a pure manual override on top of the deadline
          check that still applies either way. */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <span className="text-xs text-white/60 mr-1">
          Registration is{" "}
          <span className={eventState?.registration_closed ? "text-red-300" : "text-emerald-300"}>
            {eventState?.registration_closed ? "closed" : "open"}
          </span>
        </span>
        <span className="flex-1" />
        <button
          onClick={onToggleRegistration}
          className={`text-[10px] px-3 py-1.5 rounded uppercase font-bold tracking-wider transition-colors ${
            eventState?.registration_closed
              ? "bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912]"
              : "border border-red-500/30 text-red-300 hover:bg-red-500/10"
          }`}
        >
          {eventState?.registration_closed ? "Reopen Registration" : "Close Registration Now"}
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-4 mb-4">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center flex-shrink-0">
            {step.kind === "stage" && (
              <div className="flex flex-col items-center gap-2 px-2">
                <div
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    stageStatus(step.stage) === "ended"
                      ? "bg-white text-black border-white"
                      : stageStatus(step.stage) === "live"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 animate-pulse"
                      : stageStatus(step.stage) === "released"
                      ? "border-white/40 text-white"
                      : "border-white/15 text-white/30"
                  }`}
                >
                  {step.stage}
                </div>
                <div className="flex gap-1">
                  {stageStatus(step.stage) === "not_released" && (
                    <button onClick={() => handleRelease(step.stage)} className="text-[9px] px-2 py-1 rounded bg-white/10 text-white uppercase font-bold">
                      Release
                    </button>
                  )}
                  {stageStatus(step.stage) === "released" && (
                    <button onClick={() => onStart(step.stage)} className="text-[9px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 uppercase font-bold">
                      Start
                    </button>
                  )}
                  {stageStatus(step.stage) === "live" && (
                    <button onClick={onEnd} className="text-[9px] px-2 py-1 rounded bg-red-500/20 text-red-300 uppercase font-bold">
                      End
                    </button>
                  )}
                </div>
                <span className="text-[9px] text-white/30">{completedCount(step.stage)}/{totalCount} done</span>
              </div>
            )}

            {step.kind === "cutoff" && (
              <div className="flex flex-col items-center gap-2 px-3 border-x border-dashed border-white/10 mx-1">
                <div className={`text-[9px] uppercase tracking-wider font-bold ${cutoffApplied(step.afterStage) ? "text-white" : "text-white/30"}`}>
                  Cutoff
                </div>
                {cutoffApplied(step.afterStage) ? (
                  <button onClick={() => handleUndoCutoff(step.afterStage)} className="text-[9px] px-2 py-1 rounded border border-white/15 text-white/60 uppercase font-bold">
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={() => setCutoffDialogStage(step.afterStage)}
                    disabled={stageStatus(step.afterStage) !== "ended"}
                    className="text-[9px] px-2 py-1 rounded bg-white/10 text-white uppercase font-bold disabled:opacity-20"
                  >
                    Apply
                  </button>
                )}
              </div>
            )}

            {step.kind === "final" && (
              <div className="flex flex-col items-center gap-2 px-2">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${eventState?.status === "finished" ? "bg-white text-black border-white" : "border-white/15 text-white/30"}`}>
                  🏁
                </div>
                <span className="text-[9px] text-white/30">Final</span>
              </div>
            )}

            {i < STEPS.length - 1 && <div className="w-4 h-[1px] bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Overall event status — distinct from any single stage. No
          timer/duration anywhere: stages are started/ended purely by
          admin action via the stepper above. */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Event</span>
        <span className="flex-1" />
        <button onClick={() => onSetEventStatus("live")} disabled={eventState?.status === "live"} className="px-3 py-1.5 rounded border border-emerald-500/30 text-emerald-300 text-[10px] uppercase tracking-wider hover:bg-emerald-500/10 disabled:opacity-30 transition-colors">Event Live</button>
        <button onClick={() => onSetEventStatus("finished")} disabled={eventState?.status === "finished"} className="px-3 py-1.5 rounded border border-white/15 text-[10px] uppercase tracking-wider hover:bg-white/5 disabled:opacity-30 transition-colors">Event Finished</button>
      </div>

      {/* Leaderboard visibility + projector link */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <span className="text-xs text-white/60 mr-1">
          Leaderboard is <span className={eventState?.leaderboard_visibility === "public" ? "text-emerald-300" : "text-white/80"}>{eventState?.leaderboard_visibility ?? "—"}</span>
        </span>
        <button onClick={onToggleVisibility} className="text-[10px] px-3 py-1.5 rounded border border-white/15 uppercase font-bold tracking-wider hover:bg-white/5">
          {eventState?.leaderboard_visibility === "public" ? "Hide" : "Show"}
        </button>
        <span className="flex-1" />
        <button onClick={onCopyProjectorLink} className="text-[10px] px-3 py-1.5 rounded border border-white/15 uppercase tracking-wider hover:bg-white/5">
          Copy Projector Link
        </button>
        <button onClick={onRotateProjectorLink} className="text-[10px] px-3 py-1.5 rounded border border-white/15 uppercase tracking-wider hover:bg-white/5">
          Rotate Projector Link
        </button>
      </div>

      {/* Per-team override table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider text-white/50">Per-Team Access</h3>
          <button onClick={() => setExpandedOverrides(expandedOverrides === null ? 1 : null)} className="text-[10px] text-white/40 underline">
            {expandedOverrides === null ? "Show" : "Hide"}
          </button>
        </div>
        {expandedOverrides !== null && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
                  <th className="text-left py-2 px-2">Team</th>
                  {[1, 2, 3, 4].map((s) => (
                    <th key={s} className="text-center py-2 px-2">Stage {s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview?.teams.map((team) => (
                  <tr key={team.team_id} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white/80 whitespace-nowrap">{team.name}</td>
                    {[1, 2, 3, 4].map((s) => {
                      const state = team.access[String(s)]?.state ?? "LOCKED";
                      const override = team.overrides[String(s)];
                      return (
                        <td key={s} className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${state === "COMPLETED" ? "bg-white/20 text-white" : state === "LIVE" ? "bg-emerald-500/20 text-emerald-300" : state === "ELIMINATED" ? "bg-red-500/10 text-red-300" : "bg-white/5 text-white/30"}`}>
                              {state}
                            </span>
                            {state === "LOCKED" && (
                              <button onClick={() => handleOverride(team.team_id, s, true)} title="Grant access" className="text-emerald-400 text-[10px]">
                                ⊕
                              </button>
                            )}
                            {override?.allowed && (
                              <button onClick={() => handleOverride(team.team_id, s, false)} title="Revoke override" className="text-red-400 text-[10px]">
                                ⊖
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(!overview || overview.teams.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-6 text-white/30">No teams yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cutoffDialogStage !== null && (
        <CutoffDialog
          config={CUTOFFS.find((c) => c.afterStage === cutoffDialogStage)!}
          onClose={() => setCutoffDialogStage(null)}
          onApplied={refresh}
        />
      )}
    </section>
  );
}
