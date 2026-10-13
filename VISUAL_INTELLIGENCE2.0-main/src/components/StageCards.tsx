"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { loadSession } from "@/lib/registration";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";
import StageArt from "./stages/StageArt";
import Reveal, { MaskedWords } from "./fx/Reveal";

// Anti-leak (Phase 3 Section C): this used to import a static `stages`
// array with every stage's name/hook baked into the client bundle and
// rendered unconditionally — a locked stage's content was visible to
// any anonymous visitor on the homepage. It now asks get_stage_access()
// the same way /stages does: name is null (so the title stays redacted)
// unless the stage is released or reveal_stage_names is on, and there is
// no hook/rules/content line here at all — that detail only ever lives
// behind get_stage_content() on the gated stage pages. The per-stage
// artwork (StageArt) is keyed by stage number and is content-free.
const STATUS_LABEL: Record<string, string> = {
  LOCKED: "Locked",
  RELEASED: "Opens soon",
  LIVE: "Live now",
  COMPLETED: "Completed",
  ELIMINATED: "Not found",
};

// One status line per state — describes access, never the challenge.
function statusLine(stage: StageAccessEntry): string {
  if (stage.state === "LIVE") return "Live now. Enter with your team.";
  if (stage.stage_status === "ended") return "This stage has ended.";
  if (stage.state === "COMPLETED") return "Completed. Revisit it any time.";
  if (stage.state === "RELEASED") return "Released. It opens soon.";
  if (stage.state === "ELIMINATED") return "Oops! Stage not found.";
  return "Sealed until it unlocks, in order.";
}

export default function StageCards() {
  const [stages, setStages] = useState<StageAccessEntry[]>([]);

  useEffect(() => {
    const session = loadSession();
    const refresh = () => {
      getStageAccess(session?.teamCode, session?.regNo).then(setStages);
    };
    refresh();

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("home-stage-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  const displayStages: StageAccessEntry[] = stages.length > 0
    ? stages
    : [1, 2, 3, 4].map((s) => ({
        stage: s,
        slug: "",
        name: null,
        state: "LOCKED" as const,
        reason: "not_released",
        stage_status: "not_released" as const,
      }));

  // The panel that is open by default (desktop) — the live stage if
  // there is one, else the furthest stage the team can reach, else 01.
  const liveIdx = displayStages.findIndex((s) => s.state === "LIVE");
  const reachIdx = displayStages.map((s) => s.state !== "LOCKED").lastIndexOf(true);
  const featuredIdx = liveIdx >= 0 ? liveIdx : Math.max(reachIdx, 0);
  // How far the journey rail is lit: through the furthest non-locked stage.
  const progress = reachIdx < 0 ? 0 : (reachIdx + 1) / displayStages.length;

  return (
    <section id="stages" className="stages-section">
      <div className="landing-col">
        <Reveal as="header" className="stages-head">
          <div>
            <span className="section-eyebrow">The Journey · 0{displayStages.length} Stages</span>
            <h2 className="section-title">
              <MaskedWords text="Four stages of" /> <em><MaskedWords text="chaos." offset={3} /></em>
            </h2>
          </div>
          <p className="stages-note">
            Unlocked one at a time, in order. Each stage&apos;s name stays sealed until it is released.
          </p>
        </Reveal>

        <Reveal as="ol" className="stage-list" style={{ "--progress": progress } as CSSProperties}>
          {displayStages.map((stage, idx) => {
            const isLive = stage.state === "LIVE";
            const isCompleted = stage.state === "COMPLETED";
            const isEnded = stage.stage_status === "ended";
            const accessible = isLive || isCompleted;
            const interactive = accessible && !!stage.slug;
            const num = String(stage.stage).padStart(2, "0");
            const stateKey = isEnded && !isLive ? "ended" : stage.state.toLowerCase();

            return (
              <li
                key={stage.stage}
                className="stage-panel"
                data-stage={Math.min(stage.stage, 4)}
                data-state={stateKey}
                data-interactive={interactive || undefined}
                data-featured={idx === featuredIdx || undefined}
                style={{ "--i": idx } as CSSProperties}
              >
                <span className="stage-marker" aria-hidden="true"><span>{num}</span></span>
                <div className="stage-panel-card">
                  <div className="stage-panel-art" aria-hidden="true"><StageArt stage={stage.stage} /></div>
                  <span className="stage-panel-num" aria-hidden="true">{num}</span>
                  {!interactive && stage.state !== "LIVE" && (
                    <span className="stage-panel-seal" aria-hidden="true"><Lock /></span>
                  )}

                  <div className="stage-panel-body">
                    <span className="stage-panel-kicker">Stage {num}</span>
                    <h3 className="stage-panel-title">
                      {interactive ? (
                        <Link href={`/stages/${stage.slug}`} className="stage-panel-link">
                          {stage.name ?? `Stage ${stage.stage}`}
                        </Link>
                      ) : stage.name ? (
                        stage.name
                      ) : (
                        <>
                          <span className="stage-redacted" aria-hidden="true"><i /><i /></span>
                          <span className="sr-only">Stage {stage.stage} — name revealed when it opens</span>
                        </>
                      )}
                    </h3>
                    <p className="stage-panel-desc">{statusLine(stage)}</p>
                    <div className="stage-panel-foot">
                      {isLive ? (
                        <span className="stage-pill stage-pill-live"><span className="stage-pill-dot" />Live</span>
                      ) : isEnded ? (
                        <span className="stage-pill">Stage Ended</span>
                      ) : isCompleted ? (
                        <span className="stage-pill"><Check aria-hidden="true" />Completed</span>
                      ) : (
                        <span className="stage-pill stage-pill-locked">
                          <Lock aria-hidden="true" />
                          {STATUS_LABEL[stage.state] ?? "Locked"}
                        </span>
                      )}
                      {interactive && (
                        <span className="stage-panel-cta" aria-hidden="true">
                          Enter <span className="button-arrow">→</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
