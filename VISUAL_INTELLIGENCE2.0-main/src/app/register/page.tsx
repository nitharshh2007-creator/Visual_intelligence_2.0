"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createTeam, getTeam, loadSession, normalizeTeamCode, subscribeToTeam } from "@/lib/registration";
import { TEAM_MAX, eventDetails } from "@/data/event";
import type { RegistrationTeam } from "@/lib/types";
import type { RegistrationErrorCode } from "@/lib/types";
import LobbyBoard from "@/components/register/LobbyBoard";
import JoinTeamFlow from "@/components/register/JoinTeamFlow";

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
  useEffect(() => {
    async function resume() {
      const session = loadSession();
      const savedCode = localStorage.getItem(DRAFT_KEY) ?? session?.teamCode;
      if (savedCode) {
        const existing = await getTeam(savedCode);
        if (existing) {
          setTeam(existing);
          // DRAFT_KEY only exists for captains (set by createTeam), so
          // its presence alone is a reliable captain signal even if
          // the session record predates the isCaptain field.
          setIsCaptainView(session ? session.isCaptain : true);
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
      localStorage.setItem(DRAFT_KEY, created.inviteCode);
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

  if (!hydrated) return null;

  return (
    <main className="relative z-10 min-h-screen bg-brand-bg/50 backdrop-blur-md text-brand-fg px-6 lg:px-12 py-20">
      <div className="max-w-3xl mx-auto mb-12">
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
        <LobbyBoard team={team} isCaptainView={isCaptainView} />
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

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode("create")}
              className="group text-left p-8 rounded-2xl border-2 border-brand-fg/15 bg-brand-light hover:border-brand-accent/50 transition-colors"
            >
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-brand-accent-strong mb-3">Start a team</p>
              <h2 className="font-serif text-2xl md:text-3xl mb-3">Create a Team</h2>
              <p className="font-sans text-sm text-brand-fg/60">
                You&apos;re the captain. Get an invite code, link, and QR to bring in the rest of your {TEAM_MAX}.
              </p>
              <span className="inline-block mt-6 text-xs font-sans uppercase tracking-wider text-brand-fg group-hover:text-brand-accent-strong transition-colors">
                Get started →
              </span>
            </button>

            <button
              onClick={() => setMode("join")}
              className="group text-left p-8 rounded-2xl border-2 border-brand-fg/15 bg-brand-light hover:border-brand-accent/50 transition-colors"
            >
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-brand-accent-strong mb-3">Have a code?</p>
              <h2 className="font-serif text-2xl md:text-3xl mb-3">Join With a Code</h2>
              <p className="font-sans text-sm text-brand-fg/60">
                Your captain already created the team. Enter the code they shared to hop on the roster.
              </p>
              <span className="inline-block mt-6 text-xs font-sans uppercase tracking-wider text-brand-fg group-hover:text-brand-accent-strong transition-colors">
                Enter code →
              </span>
            </button>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => setShowReenter((v) => !v)}
              className="text-xs font-sans uppercase tracking-wider text-brand-fg/50 hover:text-brand-fg transition-colors"
            >
              Already registered? Re-enter your lobby
            </button>
            {showReenter && (
              <form onSubmit={handleReenter} className="mt-4 flex gap-2 max-w-sm mx-auto">
                <input
                  value={reenterCode}
                  onChange={(e) => setReenterCode(e.target.value)}
                  placeholder="DUM-XXXX"
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors uppercase"
                />
                <button type="submit" className="px-4 py-2 rounded-lg border border-brand-fg/15 text-xs font-sans uppercase tracking-wider text-brand-fg/70 hover:text-brand-fg hover:border-brand-fg/40 transition-colors">
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
              <label className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Team Name
              </label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Prompt Engineers"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Your Name (Captain)
              </label>
              <input
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                placeholder="e.g. Aarav S."
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Registration Number
              </label>
              <input
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. 24CS045"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-brand-fg/50 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-light border border-brand-fg/15 text-sm font-sans text-brand-fg placeholder:text-brand-fg/30 focus:outline-none focus:border-brand-accent/50 transition-colors"
              />
            </div>

            {error && <p className="text-xs font-sans text-red-600">{error}</p>}

            <button type="submit" disabled={submitting} className="luxury-button w-full disabled:opacity-50">
              {submitting ? "Creating…" : "Create Team"}
            </button>
          </form>
        </motion.div>
      )}
    </main>
  );
}
