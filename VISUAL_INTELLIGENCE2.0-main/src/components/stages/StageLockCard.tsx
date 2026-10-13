"use client";

import Link from "next/link";
import type { StageState } from "@/lib/supabase";
import { Lock } from "lucide-react";

interface Props {
  stage: number;
  name: string | null;
  state: StageState;
  reason: string | null;
}

// A team cut at a shortlist (after Level 2 or Level 3). Every later stage
// is treated as if it doesn't exist for them.
export function isEliminatedAccess(state: StageState, reason: string | null): boolean {
  return state === "ELIMINATED" || reason === "rejected" || !!reason?.startsWith("cut_after");
}

// The ONLY thing rendered for a stage the viewer can't access yet —
// no hook, no rules, no assets. Content for LIVE/COMPLETED stages is
// a completely different component (fetched via get_stage_content,
// which re-enforces this same gate server-side regardless).
export function lockMessage(state: StageState, reason: string | null): string {
  if (isEliminatedAccess(state, reason)) return "Oops! Stage not found.";
  if (reason === "shortlist_pending" || reason === "not_shortlisted") return "Waiting for the Level 2 shortlist.";
  if (reason === "not_released") return "Waiting for the host to release this stage.";
  if (reason === "not_completed_prior") return "Complete the previous stage to continue.";
  if (reason === "revoked") return "Access to this stage was revoked by an organizer.";
  if (reason === "team_not_eligible") return "Oops! Your team is not eligible to play this stage.";
  return "This stage isn't available yet.";
}

// Full "404" screen shown to eliminated teams on any later stage page.
export function StageNotFound() {
  return (
    <div className="stage-404" role="alert">
      <span className="stage-404-code" aria-hidden="true">404</span>
      <h1 className="stage-404-title">Oops! Stage not found.</h1>
      <p className="stage-404-text">
        This stage doesn&apos;t exist for your team. Your run ended at the last shortlist. Thanks for playing!
      </p>
      <Link href="/stages" className="stage-404-link">
        Back to stages <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default function StageLockCard({ stage, name, state, reason }: Props) {
  if (isEliminatedAccess(state, reason)) return <StageNotFound />;

  return (
    <div className="h-full p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center">
      <div className="flex justify-center mb-4" aria-hidden="true">
        <Lock className="w-12 h-12 text-white/40" />
      </div>
      <div className="text-white/30 text-xs uppercase tracking-widest mb-2">Stage 0{stage}</div>
      <h3 className="text-xl font-serif text-white/70 mb-3">{name ?? `Stage ${stage}`}</h3>
      <p className="text-sm text-white/50">{lockMessage(state, reason)}</p>
    </div>
  );
}
