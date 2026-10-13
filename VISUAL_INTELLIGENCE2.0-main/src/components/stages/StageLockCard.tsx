"use client";

import type { StageState } from "@/lib/supabase";
import { Lock, XCircle } from "lucide-react";

interface Props {
  stage: number;
  name: string | null;
  state: StageState;
  reason: string | null;
}

// The ONLY thing rendered for a stage the viewer can't access yet —
// no hook, no rules, no assets. Content for LIVE/COMPLETED stages is
// a completely different component (fetched via get_stage_content,
// which re-enforces this same gate server-side regardless).
function message(state: StageState, reason: string | null): string {
  if (
    state === "ELIMINATED" ||
    reason === "not_shortlisted" ||
    reason === "rejected" ||
    reason?.startsWith("cut_after")
  ) {
    return "Oops! Your team has been eliminated and cannot participate in this stage.";
  }
  if (reason === "not_released") return "Waiting for the host to release this stage.";
  if (reason === "not_completed_prior") return "Complete the previous stage to continue.";
  if (reason === "revoked") return "Access to this stage was revoked by an organizer.";
  if (reason === "team_not_eligible") return "Oops! Your team is not eligible to play this stage.";
  return "This stage isn't available yet.";
}

export default function StageLockCard({ stage, name, state, reason }: Props) {
  const isEliminated =
    state === "ELIMINATED" ||
    reason === "not_shortlisted" ||
    reason === "rejected" ||
    reason?.startsWith("cut_after");

  return (
    <div className="p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center">
      <div className="flex justify-center mb-4" aria-hidden="true">
        {isEliminated ? (
          <XCircle className="w-12 h-12 text-red-400" />
        ) : (
          <Lock className="w-12 h-12 text-white/40" />
        )}
      </div>
      <div className="text-white/30 text-xs uppercase tracking-widest mb-2">Stage 0{stage}</div>
      <h3 className="text-xl font-serif text-white/70 mb-3">{name ?? `Stage ${stage}`}</h3>
      <p className="text-sm text-white/50">{message(state, reason)}</p>
    </div>
  );
}
