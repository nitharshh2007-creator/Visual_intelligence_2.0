"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Palette, Target, Copy, Check, Terminal, ExternalLink, Download, RefreshCw, AlertCircle, FileText, Code, Globe } from "lucide-react";
import type { CyberTheme } from "@/data/cyberThemes";

interface Props {
  teamCode?: string | null;
  regNo?: string | null;
  isEnded?: boolean;
}

interface TeamThemeResponse {
  team_id: string;
  team_name: string;
  theme: CyberTheme;
  error?: string;
}

export default function CyberThemeCard({ teamCode, regNo, isEnded }: Props) {
  const [data, setData] = useState<TeamThemeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const loadTheme = useCallback(async () => {
    if (!teamCode || !regNo) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/cyber-style/my-theme?code=${encodeURIComponent(teamCode)}&reg_no=${encodeURIComponent(regNo)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load theme assignment");
      } else if (!json.theme) {
        setError("No theme assignment found for your team.");
      } else {
        setData(json);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error loading theme assignment");
    } finally {
      setLoading(false);
    }
  }, [teamCode, regNo]);

  useEffect(() => {
    let ignore = false;
    async function fetchTheme() {
      if (!teamCode || !regNo) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/cyber-style/my-theme?code=${encodeURIComponent(teamCode)}&reg_no=${encodeURIComponent(regNo)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!ignore) {
          if (!res.ok) {
            setError(json.error || "Failed to load theme assignment");
          } else if (!json.theme) {
            setError("No theme assignment found for your team.");
          } else {
            setData(json);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Network error loading theme assignment");
          setLoading(false);
        }
      }
    }
    fetchTheme();
    return () => {
      ignore = true;
    };
  }, [teamCode, regNo]);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl border border-wine-500/30 bg-black/40 backdrop-blur-md animate-pulse space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-wine-400" />
          <div className="h-4 w-56 bg-wine-500/20 rounded font-mono" />
        </div>
        <div className="h-12 w-2/3 bg-white/10 rounded" />
        <div className="grid gap-3 pt-2">
          <div className="h-16 w-full bg-white/5 rounded-xl" />
          <div className="h-16 w-full bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-950/20 backdrop-blur-md space-y-4 font-mono">
        <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Theme Assignment Error</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed font-sans">{error}</p>
        <button
          onClick={() => loadTheme()}
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Loading Theme
        </button>
      </div>
    );
  }

  if (!data?.theme) {
    return null;
  }

  const { theme, team_name } = data;
  const primaryColor = theme.palette[1]?.hex || theme.palette[0]?.hex || "#e9adb5";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-wine-500/30 bg-gradient-to-b from-[#1f1416] via-[#170e10] to-[#0e0909] p-6 md:p-8 shadow-2xl backdrop-blur-xl"
      style={{
        boxShadow: "0 0 50px -15px rgb(168 50 74 / .35)",
      }}
    >
      {/* Decorative Cyber Grids */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "#a8324a" }} />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "#6b0f1a" }} />

      {/* Top Header Tag */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-wine-400 animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest uppercase text-wine-300 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-wine-400" />
            ROUND 1 // OFFICIAL THEME ASSIGNMENT
          </span>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 font-mono">
          Team: <span className="text-white font-bold">{team_name}</span>
        </div>
      </div>

      {/* Main Theme Banner */}
      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 font-mono mb-1">Assigned Visual Theme</div>
          <h2
            className="text-4xl md:text-6xl font-black uppercase tracking-wider text-white"
            style={{
              textShadow: `0 0 25px ${primaryColor}80`,
            }}
          >
            {theme.title}
          </h2>
        </div>

        {/* Two-Line Explanation */}
        <div className="grid gap-3 pt-2">
          {/* Line 1: Visual Style */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-wine-500/10 border border-wine-500/30 text-wine-300 shrink-0 mt-0.5">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-wine-300 block font-bold mb-0.5">Visual Style & Palette</span>
              <p className="text-sm md:text-base text-white/90 leading-relaxed font-sans">{theme.description_line1}</p>
            </div>
          </div>

          {/* Line 2: What to Create */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-wine-500/10 border border-wine-500/30 text-wine-300 shrink-0 mt-0.5">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-wine-300 block font-bold mb-0.5">Team Objective // What to Build</span>
              <p className="text-sm md:text-base text-white/90 leading-relaxed font-sans">{theme.description_line2}</p>
            </div>
          </div>
        </div>

        {/* Color Palette Swatches */}
        <div className="pt-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/50 mb-2.5">Suggested Theme Palette (Click to copy hex)</div>
          <div className="flex flex-wrap gap-2.5">
            {theme.palette.map((color) => {
              const isCopied = copiedHex === color.hex;
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => copyToClipboard(color.hex)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 transition-all text-xs font-mono group"
                  title="Click to copy hex code"
                >
                  <span
                    className="w-4 h-4 rounded-md border border-white/20 shadow-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-white/80 group-hover:text-white font-medium">{color.name}</span>
                  <span className="text-white/40 text-[10px] uppercase">{color.hex}</span>
                  {isCopied ? (
                    <Check className="w-3 h-3 text-champagne-400 ml-1" />
                  ) : (
                    <Copy className="w-3 h-3 text-white/20 group-hover:text-white/60 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Directives & Quick Action */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Terminal className="w-4 h-4 text-wine-400" />
            <span>Rule: Prompt GenAI to restyle the base HTML file. No direct coding allowed.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-wine-500 hover:bg-wine-400 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              Download as Code (.txt)
            </button>
            <a
              href="/cyber-styling.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-mono font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Open as Website
            </a>
            {isEnded ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-mono font-bold uppercase tracking-wider cursor-not-allowed">
                <FileText className="w-3.5 h-3.5 text-white/30" />
                Stage Ended · Form Closed
              </div>
            ) : (
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScX1EqwjTGJmmcBORdVcxPS6UxLmAho1b9Mzm-jCF5--ZMuhQ/viewform?usp=publish-editor"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-champagne-500 hover:bg-champagne-400 text-black text-xs font-mono font-bold transition-colors shadow-lg shadow-champagne-500/20"
              >
                <FileText className="w-3.5 h-3.5" />
                Submit Work (Google Form)
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
