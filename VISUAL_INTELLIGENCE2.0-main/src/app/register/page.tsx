"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createTeam, getTeam, loadSession, clearSession, normalizeTeamCode, subscribeToTeam } from "@/lib/registration";
import { TEAM_MAX, eventDetails } from "@/data/event";
import type { RegistrationTeam } from "@/lib/types";
import type { RegistrationErrorCode } from "@/lib/types";
import LobbyBoard from "@/components/register/LobbyBoard";
import JoinTeamFlow from "@/components/register/JoinTeamFlow";
import Loader from "@/components/ui/Loader";

const DRAFT_KEY = "vi2-captain-code";

const ERROR_MESSAGES: Record<RegistrationErrorCode, string> = {
  INVALID_CODE: "Team name or captain name is missing or invalid.",
  TEAM_FULL: "This team is already full.",
  ALREADY_REGISTERED: "That registration number is already on a team.",
  REGISTRATION_CLOSED: "Registration has closed.",
  NAME_TAKEN: "That team name is already taken — try another.",
  NOT_ELIGIBLE: "Not eligible for this event — registration is first-year students only.",
  RATE_LIMITED: "Please wait a moment before trying again.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  MISSING_FIELDS: "Please fill in the team name, captain name, registration number and email.",
  EMAIL_TAKEN: "That email is already registered on a team — use a different email.",
  SERVER_ERROR: "Registration couldn't be completed because of a server problem. Please try again, or ask an organizer for help.",
};

type Mode = "choose" | "create" | "join";

export default function RegisterPage() {
  const router = useRouter();
  const [team, setTeam] = useState<RegistrationTeam | null>(null);
  const [isCaptainView, setIsCaptainView] = useState(true);
  const [mode, setMode] = useState<Mode>("choose");
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [email, setEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReenter, setShowReenter] = useState(false);
  const [reenterCode, setReenterCode] = useState("");

  // "Join with Code" links straight here with ?mode=join.
  useEffect(() => {
    function detectJoinMode() {
      if (new URLSearchParams(window.location.search).get("mode") === "join") setMode("join");
    }
    detectJoinMode();
  }, []);

  // Resume an in-progress registration from this browser, if any.
  // Only runs once on mount — navigating to /register always starts
  // with a fresh React tree, so this is the correct place to restore.
  useEffect(() => {
    // If ?new=1 is in the URL, skip resume and show the choose screen.
    // This lets "Register a different team" work without clearing valid sessions.
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setHydrated(true);
      return;
    }
    async function resume() {
      const session = loadSession();
      const savedCode = localStorage.getItem(DRAFT_KEY) ?? session?.teamCode;
      if (savedCode) {
        try {
          const existing = await getTeam(savedCode);
          if (existing) {
            setTeam(existing);
            setIsCaptainView(session ? session.isCaptain : true);
          } else {
            // Definitive VI001: team no longer exists — clear stale local state.
            localStorage.removeItem(DRAFT_KEY);
            clearSession();
          }
        } catch {
          // Network/RLS error — don't clear session; user may be offline.
        }
      }
      setHydrated(true);
    }
    resume();
  }, []);

  const inviteCode = team?.inviteCode ?? null;
  useEffect(() => {
    if (!inviteCode) return;
    return subscribeToTeam(inviteCode, (updated) => {
      if (updated) setTeam(updated);
    });
  }, [inviteCode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !captainName.trim() || !regNo.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTeam(teamName, captainName, regNo, email);
      // createTeam already sets DRAFT_KEY and session via registration.ts
      setTeam(created);
      setIsCaptainView(true);
    } catch (err) {
      const code = (err as { code?: RegistrationErrorCode }).code;
      setError(code ? ERROR_MESSAGES[code] : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reenterCode.trim()) return;
    router.push(`/register/${normalizeTeamCode(reenterCode)}`);
  };

  if (!hydrated) {
    return (
      <main className="registration-page relative z-10 min-h-screen text-brand-fg px-6 lg:px-12 py-20">
        <Loader label="Loading registration" />
      </main>
    );
  }

  return (
    <main className="registration-page relative z-10 min-h-screen text-brand-fg px-6 lg:px-12 py-20">
      <div className={`${mode === "join" && !team ? "max-w-5xl" : "max-w-3xl"} mx-auto mb-12`}>
        {mode === "choose" || team ? (
          <Link href="/" className="font-sans text-xs uppercase tracking-[0.15em] text-brand-fg/50 hover:text-brand-fg transition-colors">
            ← Back home
          </Link>
        ) : (
          <button
            onClick={() => setMode("choose")}
            className="font-sans text-xs uppercase tracking-[0.15em] text-brand-fg/50 hover:text-brand-fg transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {team ? (
        <LobbyBoard
          team={team}
          isCaptainView={isCaptainView}
          onRegisterNew={() => {
            // Clear form fields but keep the existing session intact —
            // the user can return to their lobby via "Already registered?"
            setTeamName("");
            setCaptainName("");
            setRegNo("");
            setEmail("");
            setError(null);
            setTeam(null);
            setMode("choose");
          }}
        />
      ) : mode === "choose" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="font-serif text-4xl md:text-5xl mb-3 text-center">Register for Visual Intelligence 2.0</h1>
          <p className="font-sans text-sm text-brand-fg/60 mb-12 text-center max-w-md mx-auto">
            {eventDetails.eligibility}
          </p>

          <div className="choose-grid grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode("create")}
              data-tilt
              data-tilt-max="4"
              className="group text-left p-8 vi-card vi-card-interactive"
            >
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-brand-accent-strong mb-3">Start a team</p>
              <h2 className="font-serif text-2xl md:text-3xl mb-3">Create a Team</h2>
              <p className="font-sans text-sm text-brand-fg/60">
                You&apos;re the captain. Get an invite code, link, and QR to bring in the rest of your {TEAM_MAX}.
              </p>
              <span className="inline-block mt-6 text-xs font-sans uppercase tracking-wider text-brand-fg group-hover:text-brand-accent-strong transition-colors">
                Get started <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </button>

            <button
              onClick={() => setMode("join")}
              data-tilt
              data-tilt-max="4"
              className="group text-left p-8 vi-card vi-card-interactive"
            >
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-brand-accent-strong mb-3">Have a code?</p>
              <h2 className="font-serif text-2xl md:text-3xl mb-3">Join With a Code</h2>
              <p className="font-sans text-sm text-brand-fg/60">
                Your captain already created the team. Enter the code they shared to hop on the roster.
              </p>
              <span className="inline-block mt-6 text-xs font-sans uppercase tracking-wider text-brand-fg group-hover:text-brand-accent-strong transition-colors">
                Enter code <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </button>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => setShowReenter((v) => !v)}
              aria-expanded={showReenter}
              className="min-h-11 px-2 text-xs font-sans uppercase tracking-wider text-brand-fg/60 hover:text-brand-accent underline-offset-4 hover:underline transition-colors"
            >
              Already registered? Re-enter your lobby
            </button>
            {showReenter && (
              <form onSubmit={handleReenter} className="reenter-form mt-4 flex gap-2 max-w-sm mx-auto">
                <input
                  aria-label="Team code"
                  value={reenterCode}
                  onChange={(e) => setReenterCode(e.target.value)}
                  placeholder="DUM-XXXX"
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors uppercase"
                />
                <button type="submit" className="px-5 py-2 rounded-lg border border-brand-fg/20 bg-brand-light text-xs font-sans uppercase tracking-wider text-brand-fg/80 hover:text-brand-fg hover:border-brand-accent/60 hover:shadow-md active:scale-[0.98] transition-all">
                  Go
                </button>
              </form>
            )}
          </div>
        </motion.div>
      ) : mode === "join" ? (
        <JoinTeamFlow
          onJoined={(joined) => {
            setIsCaptainView(false);
            setTeam(joined);
          }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="max-w-md mx-auto"
        >
          <h1 className="font-serif text-4xl md:text-5xl mb-3">Create a Team</h1>
          <p className="font-sans text-sm text-brand-fg/60 mb-10">
            {eventDetails.eligibility} You&apos;ll get an invite code, link, and QR to bring in the rest of your {TEAM_MAX}.
          </p>

          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label htmlFor="team-name" className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Team Name
              </label>
              <input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Prompt Engineers"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="captain-name" className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Your Name (Captain)
              </label>
              <input
                id="captain-name"
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                placeholder="Tara"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="registration-number" className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Registration Number
              </label>
              <input
                id="registration-number"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                placeholder="URK26CSXXXX"
                pattern="URK26CS[0-9]{4}"
                maxLength={11}
                title="Use the format URK26CS followed by four digits."
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@karunya.edu.in"
                pattern="[A-Za-z0-9._%+-]+@karunya\.edu\.in"
                title="Use your @karunya.edu.in email address."
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            {error && <p role="alert" className="text-xs font-sans text-red-600">{error}</p>}

            <button type="submit" disabled={submitting} aria-busy={submitting} className="luxury-button w-full">
              {submitting ? "Creating…" : "Create Team"}
            </button>
          </form>
        </motion.div>
      )}
    </main>
  );
}
