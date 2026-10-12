"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadSession } from "@/lib/registration";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";

const DOT_COLOR: Record<string, string> = {
  LOCKED: "bg-white/20",
  RELEASED: "bg-white/50",
  LIVE: "bg-emerald-500/50",
  COMPLETED: "bg-white/50",
  ELIMINATED: "bg-red-500/40",
};

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isLeaderboard = pathname === "/leaderboard";
  // Anti-leak (Phase 3 Section C): this dropdown used to hardcode all 4
  // stage names unconditionally with a "live" dot regardless of actual
  // state — every page using this navbar leaked every locked stage's
  // name. Now sourced from the same gated get_stage_access() the rest
  // of the stage UI uses; name stays null (falls back to "Stage N")
  // unless released or reveal_stage_names is on.
  const [stagesList, setStagesList] = useState<StageAccessEntry[]>([]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const session = loadSession();
    getStageAccess(session?.teamCode, session?.regNo).then(setStagesList);
  }, []);

  // Don't render the landing navbar on the leaderboard page (it has its own)
  if (isLeaderboard) return null;

  const isLbTheme = pathname.startsWith('/stages') || pathname.startsWith('/admin/stages');

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 border-b transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${
          isScrolled 
            ? isLbTheme ? "py-2 bg-[#0A0A0A]/90 backdrop-blur-sm border-white/10" : "py-2 bg-brand-bg/90 backdrop-blur-sm border-[#050505]/20" 
            : isLbTheme ? "py-4 bg-transparent border-white/10" : "py-4 bg-transparent border-[#050505]/20"
        } ${isLbTheme ? "text-white" : "text-brand-fg"}`}
      >
        <div className="container mx-auto px-6 lg:px-12 flex justify-between items-center font-sans text-xs uppercase tracking-[0.15em]">
          <Link href="/" className="flex items-center gap-4 md:gap-6 z-10 shrink-0">
            <motion.img
              src="/logos/karunya.png"
              alt="Karunya"
              initial={{ opacity: 0, filter: "blur(8px)", x: -15 }}
              animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className={`h-10 md:h-14 w-auto object-contain transition-all duration-300 hover:scale-105 ${
                isLbTheme
                  ? "invert brightness-0 opacity-80 hover:opacity-100"
                  : "grayscale opacity-70 hover:grayscale-0 hover:opacity-100"
              }`}
            />
            <motion.img
              src="/logos/ieee_cs_logo.png"
              alt="IEEE CS"
              initial={{ opacity: 0, filter: "blur(8px)", x: -15 }}
              animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className={`h-8 md:h-10 hidden md:block w-auto object-contain transition-all duration-300 hover:scale-105 ${
                isLbTheme
                  ? "invert brightness-0 opacity-80 hover:opacity-100"
                  : "grayscale opacity-70 hover:grayscale-0 hover:opacity-100"
              }`}
            />
            <motion.img
              src="/logos/acm.png"
              alt="ACM"
              initial={{ opacity: 0, filter: "blur(8px)", x: -15 }}
              animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className={`h-8 md:h-10 hidden md:block w-auto object-contain transition-all duration-300 hover:scale-105 ${
                isLbTheme
                  ? "invert brightness-0 opacity-80 hover:opacity-100"
                  : "grayscale opacity-70 hover:grayscale-0 hover:opacity-100"
              }`}
            />
          </Link>
          
          <div className="hidden md:flex gap-12 items-center">
            <Link href="/#about" className="relative group pb-1">
              About
              <span className={`absolute bottom-0 left-0 w-full h-[1px] ${isLbTheme ? "bg-white" : "bg-brand-fg"} scale-x-0 origin-right transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 group-hover:origin-left`} />
            </Link>
            
            <div className="relative group pb-1">
              <Link href="/stages" className="hover:opacity-80 transition-opacity">
                Stages
              </Link>
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300">
                <div className={`flex flex-col w-48 py-2 rounded-lg ${isLbTheme ? "bg-[#111] border border-white/10" : "bg-brand-bg border border-brand-fg/10 shadow-xl"}`}>
                  {stagesList.map(s => (
                    <Link key={s.stage} href={`/stages/${s.slug}`} className={`px-4 py-3 hover:bg-black/5 flex items-center justify-between ${pathname === `/stages/${s.slug}` ? "font-bold" : ""}`}>
                      <span>{s.name ?? `Stage ${s.stage}`}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[s.state] ?? "bg-white/20"}`} />
                    </Link>
                  ))}
                </div>
              </div>
              <span className={`absolute bottom-0 left-0 w-full h-[1px] ${isLbTheme ? "bg-white" : "bg-brand-fg"} scale-x-0 origin-right transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 group-hover:origin-left`} />
            </div>

            <Link href="/register" className="relative group pb-1">
              Register Team
              <span className={`absolute bottom-0 left-0 w-full h-[1px] ${isLbTheme ? "bg-white" : "bg-brand-fg"} scale-x-0 origin-right transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 group-hover:origin-left`} />
            </Link>

            <Link href="/register?mode=join" className="relative group pb-1">
              Join with Code
              <span className={`absolute bottom-0 left-0 w-full h-[1px] ${isLbTheme ? "bg-white" : "bg-brand-fg"} scale-x-0 origin-right transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 group-hover:origin-left`} />
            </Link>

            {/* Leaderboard with LIVE dot */}
            <Link
              href="/leaderboard"
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all group ${isLbTheme ? "border-white/20 hover:border-white/40" : "border-brand-fg/20 hover:border-brand-fg/40"}`}
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              />
              <span className="text-[10px] font-medium">Leaderboard</span>
            </Link>
          </div>

          <button onClick={() => setMenuOpen(true)} className="md:hidden">
            Menu
          </button>
        </div>
      </nav>

      {/* Full Screen Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: "-100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-50 bg-brand-dark text-brand-bg flex flex-col p-6"
          >
            <div className="flex justify-between items-center font-sans text-xs uppercase tracking-[0.15em]">
              <span className="font-serif italic capitalize text-lg tracking-normal">Visual Intelligence</span>
              <button onClick={() => setMenuOpen(false)}>Close</button>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center gap-8 font-serif text-5xl">
              <a href="#about" onClick={() => setMenuOpen(false)} className="hover:italic transition-all">About</a>
              <a href="#stages" onClick={() => setMenuOpen(false)} className="hover:italic transition-all">Stages</a>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="hover:italic transition-all">Register Team</Link>
              <Link href="/register?mode=join" onClick={() => setMenuOpen(false)} className="hover:italic transition-all">Join with Code</Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="hover:italic transition-all flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                Leaderboard
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
