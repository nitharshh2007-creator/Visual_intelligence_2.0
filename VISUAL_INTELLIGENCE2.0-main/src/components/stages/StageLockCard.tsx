"use client";

import type { StageState } from "@/lib/supabase";

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
  if (state === "ELIMINATED") return "Your team didn't make it past the last cutoff.";
  if (reason === "not_released") return "Waiting for the host to release this stage.";
  if (reason === "not_completed_prior") return "Complete the previous stage to continue.";
  if (reason === "revoked") return "Access to this stage was revoked by an organizer.";
  return "This stage isn't available yet.";
}

export default function StageLockCard({ stage, name, state, reason }: Props) {
  return (
    <div className="p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center">
      <div className="text-5xl mb-4" aria-hidden="true">
        {state === "ELIMINATED" ? "✕" : "🔒"}
      </div>
      <div className="text-white/30 text-xs uppercase tracking-widest mb-2">Stage 0{stage}</div>
      <h3 className="text-xl font-serif text-white/70 mb-3">{name ?? `Stage ${stage}`}</h3>
      <p className="text-sm text-white/50">{message(state, reason)}</p>
    </div>
  );
}
