"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStageGate } from "@/hooks/useStageGate";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";
import StageLockCard from "@/components/stages/StageLockCard";
import StageProgressRail from "@/components/stages/StageProgressRail";
import { CUTOFFS, TEAM_MIN, TEAM_MAX } from "@/data/event";

// Splits a dense paragraph into sentence-level bullets for a more
// scannable "contest brief" feel. Falls back to the whole string as
// one bullet if there's nothing to split on.
function toBullets(text: string | null): string[] {
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [text];
}

// Decoration only (emoji), not content — every field actually fetched
// here already passed the gated get_stage_content() check, same as
// before. Matches the organizers' own "Activities" announcement icons.
const STAGE_ICON: Record<string, string> = {
  "cyber-styling": "💻",
  "bugx-hacker": "🐛",
  "prompt-rumble": "🎬",
  "prompt-charades": "🎭",
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export default function StageOverviewClient() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, entry, content, session } = useStageGate(slug);
  const [allStages, setAllStages] = useState<StageAccessEntry[]>([]);

  useEffect(() => {
    getStageAccess(session?.teamCode, session?.regNo).then(setAllStages);
  }, [session?.teamCode, session?.regNo]);

  if (!hydrated) return null;

  if (!entry) {
    return <div className="p-8 text-center text-white/50">Stage not found</div>;
  }

  if (!content) {
    return <StageLockCard stage={entry.stage} name={entry.name} state={entry.state} reason={entry.reason} />;
  }

  const { stage } = content;
  const roles = (stage.roles_md ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  const isLive = content.state === "LIVE";
  const cutoff = CUTOFFS.find((c) => c.afterStage === stage.number);
  const overviewBullets = toBullets(stage.overview_md);
  const rulesBullets = toBullets(stage.rules_md);

  return (
    <div className="space-y-16 pb-24">
      {allStages.length > 0 && <StageProgressRail stages={allStages} />}

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center space-y-6">
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl relative"
          style={{ background: "var(--lb-gold-grad)", border: "1px solid var(--lb-burgundy-500)" }}
        >
          <span className="relative z-10">{STAGE_ICON[stage.slug] ?? "🏆"}</span>
          <div className="absolute inset-0 rounded-full overflow-hidden lb-shine" />
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] tracking-widest text-white/50">
            STAGE 0{stage.number} OF 04
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] tracking-widest text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 lb-live-dot" /> LIVE NOW
            </span>
          )}
        </div>

        <h1 className="lb-display text-5xl md:text-7xl text-white">{stage.name}</h1>
        {stage.hook && <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">{stage.hook}</p>}

        {/* Stat strip — real contest info card: time limit, skills tested, squad size */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {stage.duration_min != null && (
            <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 min-w-[110px]">
              <div className="text-2xl font-bold text-white">{stage.duration_min}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Minutes</div>
            </div>
          )}
          <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 min-w-[110px]">
            <div className="text-2xl font-bold text-white">{stage.tests?.length ?? 0}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Skills Tested</div>
          </div>
          {roles.length > 0 && (
            <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 min-w-[110px]">
              <div className="text-2xl font-bold text-white">{roles.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Squad Roles</div>
            </div>
          )}
          <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 min-w-[110px]">
            <div className="text-2xl font-bold text-white">{TEAM_MIN}-{TEAM_MAX}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Team Size</div>
          </div>
        </div>

        {cutoff && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            ⚠ Cutoff after this stage — only {cutoff.keep === "half" ? "the top half" : `the top ${cutoff.keep}`} advance
          </div>
        )}

        {stage.tests && stage.tests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {stage.tests.map((test) => (
              <span key={test} className="px-3 py-1 rounded-full bg-[var(--lb-burgundy-900)] border border-[var(--lb-burgundy-700)] text-xs text-white uppercase tracking-wide">
                {test}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Mission briefing + rules */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-8 rounded-2xl bg-white/5 border border-white/10 lb-tilt">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-[var(--lb-burgundy-500)]" />
            <h2 className="text-sm tracking-widest text-white/50 uppercase">Mission Briefing</h2>
          </div>
          {overviewBullets.length > 0 ? (
            <ul className="space-y-2.5">
              {overviewBullets.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-white/80 text-sm leading-relaxed">
                  <span className="text-[var(--lb-burgundy-300)] shrink-0">▸</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/50 text-sm">No overview provided.</p>
          )}
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="p-8 rounded-2xl bg-white/5 border border-white/10 lb-tilt">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-[var(--lb-burgundy-500)]" />
            <h2 className="text-sm tracking-widest text-white/50 uppercase">Rules of Engagement</h2>
          </div>
          {rulesBullets.length > 0 ? (
            <ul className="space-y-2.5">
              {rulesBullets.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-white/80 text-sm leading-relaxed">
                  <span className="text-[var(--lb-burgundy-300)] shrink-0">▸</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/50 text-sm">No rules provided.</p>
          )}
        </motion.div>
      </div>

      {/* Squad roles + match flow */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-8 rounded-2xl bg-white/5 border border-white/10 lb-tilt">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1 h-5 rounded-full bg-[var(--lb-burgundy-500)]" />
            <h2 className="text-sm tracking-widest text-white/50 uppercase">Your Squad</h2>
          </div>
          {roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <span key={role} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white/90 text-xs font-medium">
                  {role}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/50 text-sm">No roles provided.</p>
          )}
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="p-8 rounded-2xl relative overflow-hidden" style={{ background: "var(--lb-gold-grad)", border: "1px solid var(--lb-burgundy-500)" }}>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1 h-5 rounded-full bg-white/60" />
            <h2 className="text-sm tracking-widest text-white/70 uppercase">Match Flow</h2>
          </div>
          <div className="space-y-0">
            {stage.phases.map((phase, i) => (
              <div key={i} className="flex items-center gap-4 relative">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  {i < stage.phases.length - 1 && <div className="w-px flex-1 bg-white/20 min-h-[28px]" />}
                </div>
                <span className="text-white font-medium pb-7">{phase.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center">
        <Link
          href={`/stages/${slug}/challenge`}
          className="inline-block px-8 py-4 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
        >
          Enter the Challenge →
        </Link>
      </motion.div>
    </div>
  );
}
