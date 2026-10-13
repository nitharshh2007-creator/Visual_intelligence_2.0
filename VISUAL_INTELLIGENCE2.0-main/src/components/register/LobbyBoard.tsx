"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Check } from "lucide-react";
import { TEAM_MAX, TEAM_MIN } from "@/data/event";
import { slotsRemaining } from "@/lib/registration";
import type { RegistrationTeam } from "@/lib/types";
import InviteQR from "./InviteQR";

interface Props {
  team: RegistrationTeam;
  isCaptainView: boolean;
  onRegisterNew?: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
    }
  };
  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : `Copy ${label}`}
      className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-md border border-wine-700 bg-wine-600 text-[11px] font-sans font-semibold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_18px_-10px_rgba(107,15,26,0.8)] hover:bg-wine-500 transition-all focus-visible:outline-2 focus-visible:outline-brand-accent"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Copied
          </motion.span>
        ) : (
          <motion.span key="copy" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            Copy {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function LobbyBoard({ team, isCaptainView, onRegisterNew }: Props) {
  const remaining = slotsRemaining(team);
  const isFull = team.members.length >= TEAM_MAX;
  const isOverLimit = team.members.length > TEAM_MAX;
  const isReady = team.status === "ready" || team.status === "full";
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/register/${team.inviteCode}`
      : `/register/${team.inviteCode}`;

  const whatsappText = encodeURIComponent(
    `Join "${team.name}" for Visual Intelligence 2.0! Code: ${team.inviteCode} — ${inviteLink}`
  );

  const slots = Array.from({ length: Math.max(TEAM_MAX, team.members.length) }, (_, i) => team.members[i] ?? null);

  return (
    <div className="max-w-2xl mx-auto px-0">
      {/* ── Header ── */}
      <div className="lobby-hero">
        <div className="lobby-hero-orbit" aria-hidden="true"><span /><span /><i /></div>
        <div className="min-w-0 relative">
          <p className="lobby-kicker">Team Lobby</p>
          <h1 className="lobby-name">{team.name}</h1>
          <p className="lobby-meta">
            {isOverLimit
              ? `${team.members.length} members · Legacy roster · Eligible to compete`
              : isFull
              ? `${team.members.length} of ${TEAM_MAX} members · Full — eligible to compete`
              : isReady
              ? `${team.members.length} of ${TEAM_MAX} members · Eligible to compete`
              : `${team.members.length} of ${TEAM_MAX} members · ${TEAM_MIN - team.members.length} more needed`}
          </p>
        </div>
        <span
          className="lobby-status"
          data-tone={isOverLimit ? "notice" : isFull ? "full" : isReady ? "ready" : "notice"}
        >
          {isOverLimit ? "Existing team" : isFull ? "Full" : isReady ? "Ready" : "Incomplete"}
        </span>
      </div>

      {isOverLimit && (
        <p className="mb-6 rounded-lg border border-champagne-500/40 bg-champagne-200/40 px-4 py-3 text-xs font-sans text-brand-fg/70">
          This team was registered before the four-member limit changed. Its full roster is preserved, and no additional members can join.
        </p>
      )}

      {/* ── Member roster ── */}
      <div className="mb-8">
        <p className="lobby-section-label">Roster <span>{team.members.length}/{TEAM_MAX}</span></p>
        <div className="space-y-2">
          {slots.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="lobby-member"
              data-empty={member ? undefined : ""}
              data-captain={member?.isCaptain || undefined}
            >
              {member ? (
                <>
                  <div className="lobby-avatar" data-tone={i % 4} aria-hidden="true">
                    {member.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-sans text-brand-fg font-medium truncate">{member.name}</p>
                    <p className="text-[10px] font-sans uppercase tracking-wider text-brand-fg/40 mt-0.5">
                      {member.isCaptain ? "Captain" : "Member"}
                    </p>
                  </div>
                  {member.isCaptain && (
                    <span className="lobby-captain-tag">
                      Captain
                    </span>
                  )}
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full border border-dashed border-brand-fg/15 flex items-center justify-center text-brand-fg/25 text-xs font-sans flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-xs font-sans text-brand-fg/30 italic">Waiting for member…</p>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Invite section (captain only, team not full) ── */}
      {isCaptainView && !isFull && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="vi-card p-6 mb-6"
        >
          <p className="text-[10px] font-sans uppercase tracking-[0.18em] text-brand-fg/40 mb-4">
            {isReady
              ? `Optional: invite ${remaining} more teammate${remaining === 1 ? "" : "s"}`
              : `Invite ${remaining} more teammate${remaining === 1 ? "" : "s"} to be eligible`}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* QR code */}
            <div className="p-2.5 rounded-xl bg-white border border-brand-fg/10 flex-shrink-0">
              <InviteQR data={inviteLink} size={120} />
            </div>

            {/* Code + actions */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Invite code display */}
              <div>
                <p className="text-[10px] font-sans uppercase tracking-wider text-brand-fg/40 mb-1.5">Invite Code</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-brand-fg/15 font-mono text-xl tracking-[0.25em] text-brand-fg font-semibold select-all">
                    {team.inviteCode}
                  </div>
                  <CopyButton text={team.inviteCode} label="Code" />
                </div>
              </div>

              {/* Invite link */}
              <div>
                <p className="text-[10px] font-sans uppercase tracking-wider text-brand-fg/40 mb-1.5">Invite Link</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs font-mono text-brand-fg/50 truncate">{inviteLink}</p>
                  <CopyButton text={inviteLink} label="Link" />
                </div>
              </div>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-white text-xs font-sans font-semibold uppercase tracking-wider hover:bg-[#1ebe5d] transition-colors focus-visible:outline-2 focus-visible:outline-[#25D366]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share on WhatsApp
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Full team banner ── */}
      {isFull && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lobby-full"
        >
          <div>
            <p className="lobby-full-title">Your team is <em>full!</em></p>
            <p className="lobby-full-sub">All {TEAM_MAX} slots filled. You are ready to enter the arena.</p>
          </div>

          <div className="pt-2">
            <Link
              href="/stages/cyber-styling"
              className="lobby-play group"
            >
              <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
              <span>Go to Game / Round 1</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Member view: show invite code read-only ── */}
      {!isCaptainView && (
        <div className="lobby-code">
          <p className="lobby-code-label">Your Team Code</p>
          <div className="flex items-center gap-2">
            <div className="lobby-code-value">
              {team.inviteCode}
            </div>
            <CopyButton text={team.inviteCode} label="Code" />
          </div>
          <p className="lobby-code-hint">Bookmark this page to return to your lobby.</p>
        </div>
      )}
      {/* ── Register a different team ── */}
      <div className="mt-8 pt-6 border-t border-brand-fg/10 text-center">
        <p className="text-xs font-sans text-brand-fg/40 mb-2">Not your team?</p>
        {onRegisterNew ? (
          <button
            onClick={onRegisterNew}
            className="text-xs font-sans uppercase tracking-wider text-brand-fg/50 hover:text-brand-fg transition-colors underline"
          >
            Register a different team
          </button>
        ) : (
          <Link
            href="/register?new=1"
            className="text-xs font-sans uppercase tracking-wider text-brand-fg/50 hover:text-brand-fg transition-colors underline"
          >
            Register a different team
          </Link>
        )}
      </div>
    </div>
  );
}
