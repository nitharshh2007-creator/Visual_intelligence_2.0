"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { findTeamByCode, joinTeam } from "@/lib/registration";
import { TEAM_MAX } from "@/data/event";
import type { RegistrationErrorCode, RegistrationTeam, TeamPreview } from "@/lib/types";
import CodeInput from "./CodeInput";

const ERROR_MESSAGES: Record<RegistrationErrorCode, string> = {
  INVALID_CODE: "No team found for that code.",
  TEAM_FULL: "This team is already full.",
  ALREADY_REGISTERED: "That registration number is already on a team.",
  REGISTRATION_CLOSED: "Registration has closed.",
  NAME_TAKEN: "That name is already on the roster — use your full name.",
  NOT_ELIGIBLE: "Not eligible for this event — registration is first-year students only.",
  RATE_LIMITED: "Please wait a moment before trying again.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
};

interface Props {
  initialCode?: string;
  onJoined: (team: RegistrationTeam) => void;
}

export default function JoinTeamFlow({ initialCode, onJoined }: Props) {
  const [code, setCode] = useState(initialCode ?? "");
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<TeamPreview | null>(null);
  const [lookupError, setLookupError] = useState<RegistrationErrorCode | null>(null);

  const [memberName, setMemberName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<RegistrationErrorCode | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<RegistrationTeam | null>(null);

  async function handleFind(codeArg?: string) {
    const target = codeArg ?? code;
    if (!target.trim() || looking) return;
    setLooking(true);
    setLookupError(null);
    setPreview(null);
    try {
      const result = await findTeamByCode(target);
      if (result.preview) setPreview(result.preview);
      else setLookupError(result.error ?? "INVALID_CODE");
    } catch (err) {
      setLookupError((err as { code?: RegistrationErrorCode }).code ?? "NETWORK_ERROR");
    } finally {
      setLooking(false);
    }
  }

  // The invite link / QR opens here with the code prefilled — look it
  // up immediately instead of waiting for the student to press the button.
  useEffect(() => {
    function autoLookup() {
      if (initialCode) handleFind(initialCode);
    }
    autoLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function handleCodeChange(next: string) {
    setCode(next);
    // Any edit to the code invalidates the preview — force a fresh lookup.
    if (preview) setPreview(null);
    if (lookupError) setLookupError(null);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim() || !regNo.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setJoinError(null);
    try {
      const yearNum = year.trim() ? Number(year.trim()) : undefined;
      const result = await joinTeam(code, memberName, regNo, email, phone.trim() || undefined, section.trim() || undefined, yearNum);
      if (result.error) {
        setJoinError(result.error);
      } else if (result.team) {
        setJoinedTeam(result.team);
      }
    } catch (err) {
      setJoinError((err as { code?: RegistrationErrorCode }).code ?? "NETWORK_ERROR");
    } finally {
      setSubmitting(false);
    }
  }

  const lobbyLink = typeof window !== "undefined" && joinedTeam
    ? `${window.location.origin}/register/${joinedTeam.inviteCode}`
    : joinedTeam
    ? `/register/${joinedTeam.inviteCode}`
    : "";

  // ── Success screen ──
  if (joinedTeam) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        className="max-w-md mx-auto text-center"
      >
        <h1 className="font-serif text-4xl mb-3">You&apos;re in!</h1>
        <p className="font-sans text-sm text-brand-fg/60 mb-8">
          Welcome to <span className="text-brand-fg font-medium">{joinedTeam.name}</span>. Bookmark your lobby link to check back in:
        </p>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-brand-fg/15 bg-brand-light mb-8">
          <code className="flex-1 text-xs font-mono text-brand-fg/70 truncate text-left">{lobbyLink}</code>
          <button
            onClick={() => navigator.clipboard?.writeText(lobbyLink)}
            className="text-[10px] font-sans uppercase tracking-wider text-brand-accent-strong flex-shrink-0"
          >
            Copy
          </button>
        </div>
        <button onClick={() => onJoined(joinedTeam)} className="luxury-button w-full">
          View My Lobby
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
      className="max-w-md mx-auto"
    >
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Join With a Code</h1>
      <p className="font-sans text-sm text-brand-fg/60 mb-8">
        Enter the code your captain shared with you.
      </p>

      <div className="space-y-3 mb-2">
        <CodeInput value={code} onChange={handleCodeChange} onSubmit={() => handleFind()} autoFocus />
        <button
          type="button"
          onClick={() => handleFind()}
          disabled={looking || !code.trim()}
          className="luxury-button w-full disabled:opacity-50"
        >
          {looking ? "Looking…" : "Find Team"}
        </button>
      </div>

      {lookupError && (
        <div className="text-center mt-3">
          <p className="text-xs font-sans text-red-600">{ERROR_MESSAGES[lookupError]}</p>
          {lookupError === "INVALID_CODE" && (
            <Link href="/register" className="text-xs font-sans uppercase tracking-wider text-brand-accent-strong hover:underline mt-2 inline-block">
              Register a new team instead →
            </Link>
          )}
        </div>
      )}

      {preview && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6 p-5 rounded-xl border border-brand-accent/30 bg-brand-accent/[0.06]"
        >
          <p className="font-serif text-2xl text-brand-fg mb-1">{preview.name}</p>
          <p className="text-xs font-sans text-brand-fg/60">
            {preview.memberCount}/{TEAM_MAX} slots filled · captain {preview.captainFirstName || "—"}
          </p>
        </motion.div>
      )}

      {preview && preview.status === "full" && (
        <p className="text-xs font-sans text-red-600 mt-4 text-center">{ERROR_MESSAGES.TEAM_FULL}</p>
      )}

      {preview && preview.status !== "full" && (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onSubmit={handleJoin}
          className="space-y-4 mt-6"
        >
          <input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Your full name"
            required
            className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
          <input
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            placeholder="Registration number (e.g. 24CS045)"
            required
            className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            required
            className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Section (optional)"
              className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year of study (optional)"
            min={1}
            max={5}
            className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />

          {joinError && <p className="text-xs font-sans text-red-600">{ERROR_MESSAGES[joinError]}</p>}

          <button type="submit" disabled={submitting} className="luxury-button w-full disabled:opacity-50">
            {submitting ? "Joining…" : "Join Team"}
          </button>
        </motion.form>
      )}
    </motion.div>
  );
}
