"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStageGate } from "@/hooks/useStageGate";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";
import StageLockCard, { StageNotFound, isEliminatedAccess } from "@/components/stages/StageLockCard";
import StageProgressRail from "@/components/stages/StageProgressRail";
import CyberThemeCard from "@/components/stages/CyberThemeCard";
import Loader from "@/components/ui/Loader";
import { OFFICIAL_GAME_RULES } from "@/data/officialGameRules";
import { FileText, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert, Sparkles, ExternalLink, Laptop, Bug, Video, Trophy, Download, Code, Globe } from "lucide-react";

function renderStageIcon(slug: string) {
  switch (slug) {
    case "cyber-styling":
      return <Laptop className="w-9 h-9" style={{ color: "#191818" }} />;
    case "bugx-hacker":
      return <Bug className="w-9 h-9" style={{ color: "#191818" }} />;
    case "prompt-rumble":
      return <Video className="w-9 h-9" style={{ color: "#191818" }} />;
    case "prompt-charades":
      return <Sparkles className="w-9 h-9" style={{ color: "#191818" }} />;
    default:
      return <Trophy className="w-9 h-9" style={{ color: "#191818" }} />;
  }
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
};

export default function StageOverviewClient() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, entry, content, session } = useStageGate(slug);
  const [allStages, setAllStages] = useState<StageAccessEntry[]>([]);

  useEffect(() => {
    getStageAccess(session?.teamCode, session?.regNo).then(setAllStages);
  }, [session?.teamCode, session?.regNo, entry?.stage_status]);

  if (!hydrated) return <Loader label="Loading stage" tone="dark" />;

  if (!entry) {
    return <div className="p-8 text-center text-white/50">Stage not found</div>;
  }

  if (isEliminatedAccess(entry.state, entry.reason)) return <StageNotFound />;

  const isEnded = entry.stage_status === "ended" || entry.reason === "stage_ended";

  // If content is null and stage is locked (not released or eliminated), show lock card.
  // BUT if stage has ended, always allow participants to read the stage's rules & description!
  if (!content && !isEnded) {
    return <StageLockCard stage={entry.stage} name={entry.name} state={entry.state} reason={entry.reason} />;
  }

  const officialRule = OFFICIAL_GAME_RULES[slug];

  const stage = content?.stage ?? {
    slug,
    number: entry.stage,
    name: entry.name ?? officialRule?.name ?? `Stage ${entry.stage}`,
    hook: officialRule?.tagline ?? "",
    overview_md: officialRule?.overview ?? "",
    rules_md: officialRule?.rules ? officialRule.rules.join("\n") : "",
    roles_md: "",
    duration_min: 0,
    phases: [],
    tests: [],
  };

  // Official fields with fallbacks
  const tagline = officialRule?.tagline || stage.hook || "Official Game Challenge";
  const overviewText = officialRule?.overview || stage.overview_md || "";
  const howToPlaySteps = officialRule?.howToPlay || (stage.phases?.map((p) => p.name) ?? []);
  const rulesList = officialRule?.rules || (stage.rules_md ? stage.rules_md.split("\n").filter(Boolean) : []);
  const requiredOutput = officialRule?.requiredOutput || "Completed challenge output submitted through the official Google Form.";
  const teamRoles = officialRule?.teamRoles || (stage.roles_md ? stage.roles_md.split(",").map((r) => ({ role: r.trim(), description: "Active squad member" })) : []);
  const isLive = content?.state === "LIVE";

  return (
    <div className="space-y-12 pb-24 max-w-5xl mx-auto px-4 sm:px-6">
      {allStages.length > 0 && <StageProgressRail stages={allStages} />}

      {entry.stage_status === "ended" && (
        <div className="p-4 rounded-2xl border border-champagne-400/30 bg-champagne-400/10 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-champagne-200">Stage Ended</p>
          <p className="text-xs text-white/70 mt-1">
            {entry.stage < 4
              ? "The host has concluded this round. Submissions are closed; check the stage list for results and the next release."
              : "All stages are complete. Check the leaderboard for final rankings."}
          </p>
        </div>
      )}

      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center space-y-6">
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl relative"
          style={{ background: "var(--lb-gold-grad)", border: "1px solid var(--lb-burgundy-500)" }}
        >
          <span className="relative z-10">{renderStageIcon(stage.slug)}</span>
          <div className="absolute inset-0 rounded-full overflow-hidden lb-shine" />
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="px-3.5 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] tracking-widest text-white/60 font-mono">
            LEVEL 0{stage.number} OF 04
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 px-3.5 py-1 bg-champagne-500/10 border border-champagne-500/30 rounded-full text-[10px] tracking-widest text-champagne-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-champagne-400 lb-live-dot" /> LIVE NOW
            </span>
          )}
        </div>

        <div className="space-y-2">
          <h1 className="lb-display text-4xl sm:text-6xl md:text-7xl text-white tracking-tight">{stage.name}</h1>
          <p className="text-base sm:text-xl text-[#e9adb5] font-mono tracking-wide max-w-2xl mx-auto italic font-medium">
            &ldquo;{tagline}&rdquo;
          </p>
        </div>

        {/* Contest Quick Stats */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {stage.duration_min != null && (
            <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 min-w-[100px]">
              <div className="text-xl font-bold text-white font-mono">{stage.duration_min}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Minutes</div>
            </div>
          )}
          <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 min-w-[100px]">
            <div className="text-xl font-bold text-white font-mono">{teamRoles.length}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Team Roles</div>
          </div>
          <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 min-w-[100px]">
            <div className="text-xl font-bold text-white font-mono">{howToPlaySteps.length}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Steps to Play</div>
          </div>
        </div>

        {stage.tests && stage.tests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {stage.tests.map((test) => (
              <span key={test} className="px-3 py-1 rounded-full bg-[var(--lb-burgundy-900)] border border-[var(--lb-burgundy-700)] text-[11px] text-white/90 uppercase tracking-wide font-mono">
                {test}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Cyber Theme Allocation Card (Stage 1 only) */}
      {stage.slug === "cyber-styling" && session && (
        <CyberThemeCard teamCode={session.teamCode} regNo={session.regNo} isEnded={isEnded} />
      )}

      {/* Cyber Styling Starter HTML Actions (Always accessible for Level 1) */}
      {stage.slug === "cyber-styling" && (
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-5 sm:p-6 rounded-2xl bg-wine-950/20 border border-wine-500/30 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-wine-500/5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-wine-500/10 border border-wine-500/30 text-wine-400">
              <Code className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Cyber Styling HTML Starter File</h3>
              <p className="text-xs text-white/60 mt-0.5">
                Download the official HTML code as a text file or open it directly in your browser as a website.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const res = await fetch("/cyber-styling.txt");
                  const text = await res.text();
                  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "cyber-styling.txt";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                } catch {
                  window.location.href = "/api/cyber-style/download";
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-500 hover:bg-wine-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-wine-500/20 cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Download as Code (.txt)</span>
            </button>
            <a
              href="/cyber-styling.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold transition-all"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Open as Website</span>
            </a>
          </div>
        </motion.div>
      )}

      {/* Mission Overview */}
      <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-6 sm:p-8 lb-panel rounded-2xl bg-white/[0.03] border border-white/10 shadow-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-1.5 h-5 rounded-full bg-[var(--lb-burgundy-500)]" />
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#e9adb5] uppercase">Mission Overview</h2>
        </div>
        <p className="text-white/90 text-sm sm:text-base leading-relaxed">
          {overviewText}
        </p>
      </motion.div>

      {/* How to Play & Rules Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* How to Play (Step-by-step instructions) */}
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-6 sm:p-8 lb-panel rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-5 rounded-full bg-wine-400" />
              <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-wine-300 uppercase">How to Play</h2>
            </div>
            <ol className="space-y-3.5">
              {howToPlaySteps.map((step, i) => (
                <li key={i} className="flex gap-3 text-white/80 text-xs sm:text-sm leading-relaxed">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-wine-500/15 border border-wine-500/30 text-wine-300 font-mono text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </motion.div>

        {/* Rules of Engagement */}
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="p-6 sm:p-8 lb-panel rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-5 rounded-full bg-[var(--lb-burgundy-500)]" />
              <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#e9adb5] uppercase">Official Rules</h2>
            </div>
            <ul className="space-y-3">
              {rulesList.map((rule, i) => (
                <li key={i} className="flex gap-3 text-white/80 text-xs sm:text-sm leading-relaxed">
                  <span className="text-[var(--lb-burgundy-300)] shrink-0 font-bold">◆</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Team Roles */}
      {teamRoles.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="p-6 sm:p-8 lb-panel rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-champagne-400" />
              <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-champagne-300 uppercase">Team Roles & Responsibilities</h2>
            </div>
            {stage.slug === "prompt-charades" && (
              <span className="px-3 py-1 rounded-full bg-champagne-500/10 border border-champagne-500/30 text-[10px] font-mono text-champagne-300">
                Observer sees image · Prompter must not see it directly
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {teamRoles.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--lb-burgundy-400)]" />
                  {r.role}
                </div>
                <p className="text-xs text-white/60 leading-relaxed pl-4">
                  {r.description}
                </p>
              </div>
            ))}
          </div>
          {stage.slug === "prompt-charades" && (
            <div className="mt-4 p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 text-xs text-red-200 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>
                <strong>Confidentiality Rule:</strong> The prompter must not directly see the reference image during the challenge. Team members must communicate exclusively through the permitted process.
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Required Output / Submission Card */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5 }}
        className="p-6 sm:p-8 rounded-2xl border border-champagne-500/30 bg-champagne-950/20 shadow-xl shadow-champagne-950/10 flex flex-wrap items-center justify-between gap-6"
      >
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-champagne-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-champagne-300">Required Submission</h3>
          </div>
          <p className="text-sm text-white/90 font-medium">
            {requiredOutput}
          </p>
          <p className="text-xs text-white/50">
            Submit your completed work through the official Google Form before the round closes.
          </p>
        </div>

        {officialRule?.formUrl && (
          isEnded ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 font-mono text-xs uppercase tracking-wider">
              <span>Stage Ended · Submissions Closed</span>
            </div>
          ) : (
            <a
              href={officialRule.formUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-champagne-500 hover:bg-champagne-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-champagne-500/20"
            >
              <span>Official Google Form</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )
        )}
      </motion.div>

      {/* Call to Action */}
      <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center pt-4">
        <Link
          href={`/stages/${slug}/challenge`}
          className="lb-cta group inline-flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xs sm:text-sm uppercase tracking-widest"
        >
          <span>{entry.stage_status === "ended" ? "View Stage Materials" : "Enter Challenge & Materials"}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </div>
  );
}
