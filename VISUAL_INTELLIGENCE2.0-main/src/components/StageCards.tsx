"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { loadSession } from "@/lib/registration";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";

// Anti-leak (Phase 3 Section C): this used to import a static `stages`
// array with every stage's name/hook baked into the client bundle and
// rendered unconditionally — a locked stage's content was visible to
// any anonymous visitor on the homepage. It now asks get_stage_access()
// the same way /stages does: name is null (so we fall back to "Stage N")
// unless the stage is released or reveal_stage_names is on, and there is
// no hook/rules/content line here at all — that detail only ever lives
// behind get_stage_content() on the gated stage pages.
const STATUS_LABEL: Record<string, string> = {
  LOCKED: "Locked",
  RELEASED: "Opens soon",
  LIVE: "Live now",
  COMPLETED: "Completed",
  ELIMINATED: "Closed",
};

export default function StageCards() {
  const [stages, setStages] = useState<StageAccessEntry[]>([]);

  useEffect(() => {
    const session = loadSession();
    getStageAccess(session?.teamCode, session?.regNo).then(setStages);
  }, []);

  const displayStages: StageAccessEntry[] = stages.length > 0 
    ? stages 
    : [1, 2, 3, 4].map((s) => ({ stage: s, slug: "", name: null, state: "LOCKED" as const, reason: "not_released" }));

  return (
    <section 
      id="stages" 
      data-desk 
      className="py-32 px-6 lg:px-12 text-brand-fg relative z-10"
    >
      <div className="page-col">
        <h2 className="font-serif text-4xl md:text-5xl mb-16 border-b border-brand-fg/10 pb-8">
          The Stages
        </h2>

        {/* 2x2 card grid with ink top border & 1px hairlines between cards */}
        <div className="border-t border-brand-fg grid grid-cols-1 min-[760px]:grid-cols-2 divide-y divide-brand-fg/10 min-[760px]:divide-y-0">
          {displayStages.map((stage, idx) => {
            const isLive = stage.state === "LIVE";
            const isCompleted = stage.state === "COMPLETED";
            const accessible = isLive || isCompleted;
            const stageName = stage.name ?? `Stage ${stage.stage}`;

            const card = (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.65, delay: idx * 0.08, ease: [0.76, 0, 0.24, 1] }}
                whileHover={{ scale: accessible ? 1.01 : 1 }}
                className={`p-6 lg:p-8 flex flex-col justify-between min-h-[260px] lg:min-h-[300px] group transition-colors duration-200 hover:bg-black/[0.03] border-brand-fg/10 ${
                  idx % 2 === 0 ? "min-[760px]:border-r" : ""
                } ${idx < 2 ? "min-[760px]:border-b" : ""}`}
              >
                <div>
                  <span className="font-sans text-[14px] uppercase tracking-[0.15em] text-brand-fg/40 block mb-6">
                    0{stage.stage}
                  </span>
                  <h3
                    className={`font-serif text-[clamp(36px,3.6vw,52px)] leading-[1.05] tracking-tight transition-colors ${
                      isLive ? "italic text-brand-accent" : "text-brand-fg group-hover:text-brand-accent"
                    }`}
                  >
                    {stageName}
                  </h3>
                </div>

                <div className="mt-8 pt-4">
                  {isLive ? (
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand-accent bg-brand-accent text-brand-bg text-[12px] font-sans uppercase tracking-[0.2em] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-bg animate-pulse" />
                      Live
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-fg/30 text-brand-fg/80 text-[12px] font-sans uppercase tracking-[0.2em] font-medium">
                      <span className="text-xs">✓</span> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-brand-fg/20 text-brand-fg/60 text-[12px] font-sans uppercase tracking-[0.2em]">
                      {STATUS_LABEL[stage.state] ?? "Locked"}
                    </span>
                  )}
                </div>
              </motion.div>
            );

            return accessible && stage.slug ? (
              <Link key={stage.stage} href={`/stages/${stage.slug}`} className="block">
                {card}
              </Link>
            ) : (
              <div key={stage.stage}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
