"use client";

import { motion } from "framer-motion";
import { TEAM_MAX, TEAM_MIN } from "@/data/event";
import { slotsRemaining } from "@/lib/registration";
import type { RegistrationTeam } from "@/lib/types";
import InviteQR from "./InviteQR";

interface Props {
  team: RegistrationTeam;
  isCaptainView: boolean;
}

export default function LobbyBoard({ team, isCaptainView }: Props) {
  const remaining = slotsRemaining(team);
  const isFull = team.members.length >= TEAM_MAX; // max reached, 5th slot filled
  const isReady = team.status === "ready"; // minimum (4) reached, eligible to compete
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/register/${team.inviteCode}`
    : `/register/${team.inviteCode}`;

  const whatsappText = encodeURIComponent(
    `Join "${team.name}" for Visual Intelligence 2.0! Use code ${team.inviteCode} or tap: ${inviteLink}`
  );

  const slots = Array.from({ length: TEAM_MAX }, (_, i) => team.members[i] ?? null);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Status */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-brand-fg">{team.name}</h1>
          <p className="text-xs font-sans uppercase tracking-[0.15em] text-brand-fg/50 mt-1">
            Team Lobby
          </p>
        </div>
        <span className={`px-4 py-2 rounded-full text-xs font-sans uppercase tracking-wider font-medium border ${
          isReady
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
            : "bg-brand-accent/10 text-brand-accent-strong border-brand-accent/30"
        }`}>
          {isReady ? `Ready · ${team.members.length}/${TEAM_MAX}` : `Incomplete (${team.members.length}/${TEAM_MIN} min)`}
        </span>
      </div>

      {/* 5-slot isometric member board */}
      <div
        className="flex flex-wrap justify-center gap-6 mb-12"
        style={{ perspective: "1200px" }}
      >
        {slots.map((member, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, rotateX: 8, rotateY: -6 }}
            animate={{ opacity: 1, y: 0, rotateX: 8, rotateY: -6 }}
            transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ rotateX: 0, rotateY: 0, y: -4 }}
            style={{ transformStyle: "preserve-3d" }}
            className={`w-28 md:w-32 aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-shadow ${
              member
                ? "bg-brand-light border-brand-accent/40 shadow-md"
                : "bg-brand-fg/[0.02] border-dashed border-brand-fg/15"
            }`}
          >
            {member ? (
              <>
                <div className="w-10 h-10 rounded-full bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center font-sans text-sm text-brand-fg">
                  {member.initials}
                </div>
                <span className="text-[11px] font-sans text-brand-fg text-center px-1 truncate w-full">{member.name}</span>
                <span className="text-[9px] font-sans uppercase tracking-wider text-brand-accent-strong font-medium">
                  {member.isCaptain ? "Captain" : "Member"}
                </span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full border border-dashed border-brand-fg/20 flex items-center justify-center text-brand-fg/30 font-serif text-lg">
                  {i + 1}
                </div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-brand-fg/30">Waiting…</span>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {isCaptainView && !isFull && (
        <div className="text-center mb-10">
          <p className="font-serif text-xl text-brand-fg italic mb-6">
            {isReady
              ? `Optional: add ${remaining} more teammate${remaining === 1 ? "" : "s"} (up to ${TEAM_MAX})`
              : `Share with ${remaining} more teammate${remaining === 1 ? "" : "s"}`}
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            {/* QR */}
            <div className="p-3 rounded-xl bg-brand-light border border-brand-fg/10">
              <InviteQR data={inviteLink} size={140} />
            </div>

            <div className="flex flex-col gap-3 items-center md:items-start">
              {/* Invite code */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-brand-fg/15 bg-brand-light">
                <span className="text-[10px] font-sans uppercase tracking-wider text-brand-fg/50">Code</span>
                <span className="font-serif text-lg tracking-[0.2em] text-brand-fg">{team.inviteCode}</span>
              </div>

              {/* Invite link */}
              <button
                onClick={() => navigator.clipboard?.writeText(inviteLink)}
                className="px-4 py-2 rounded-full border border-brand-fg/15 text-xs font-sans text-brand-fg/70 hover:text-brand-fg hover:border-brand-fg/40 transition-colors"
              >
                Copy Invite Link
              </button>

              {/* WhatsApp share */}
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="luxury-button inline-block text-center"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {isFull && (
        <div className="text-center">
          <p className="font-serif text-2xl text-emerald-700 italic">Your team is full and ready. See you at the event!</p>
        </div>
      )}
    </div>
  );
}
