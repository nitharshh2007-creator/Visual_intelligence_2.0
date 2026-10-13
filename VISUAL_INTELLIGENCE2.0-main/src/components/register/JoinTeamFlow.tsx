"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { findTeamByCode, joinTeam, normalizeTeamCode } from "@/lib/registration";
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
  MISSING_FIELDS: "Please fill in your name, registration number and email.",
  EMAIL_TAKEN: "That email is already registered on a team — use a different email.",
  SERVER_ERROR: "Couldn't join because of a server problem. Please try again, or ask an organizer for help.",
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
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<RegistrationErrorCode | null>(null);

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
      if (initialCode && normalizeTeamCode(initialCode).length >= 7) handleFind(initialCode);
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
      const result = await joinTeam(code, memberName, regNo, email);
      if (result.error) {
        setJoinError(result.error);
      } else if (result.team) {
        onJoined(result.team);
      } else {
        setJoinError("SERVER_ERROR");
      }
    } catch (err) {
      setJoinError((err as { code?: RegistrationErrorCode }).code ?? "NETWORK_ERROR");
    } finally {
      setSubmitting(false);
    }
  }


  const teamFull = !!preview && (preview.status === "full" || preview.memberCount >= TEAM_MAX);
  const step = !preview ? 1 : teamFull ? 2 : 3;
  const STEPS = ["Enter the team code", "Confirm your team", "Add your details"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
      className="join-layout"
    >
      <div className="join-intro">
        <p className="join-eyebrow">Have a code?</p>
        <h1 className="join-title">Join with a <em>code.</em></h1>
        <p className="join-lede">
          Your captain already created the team. Enter the code they shared to take your place on the roster.
        </p>
        <ol className="join-steps" aria-label="Joining steps">
          {STEPS.map((label, i) => (
            <li key={label} data-state={i + 1 < step ? "done" : i + 1 === step ? "current" : "todo"} aria-current={i + 1 === step ? "step" : undefined}>
              <span className="join-step-num" aria-hidden="true">{i + 1 < step ? "\u2713" : i + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="join-orbit" aria-hidden="true"><span /><span /><i /></div>
      </div>

      <div className="join-card">
        <label htmlFor="team-code" className="join-label">Team code</label>
        <div className="space-y-3">
          <CodeInput id="team-code" value={code} onChange={handleCodeChange} onSubmit={() => handleFind()} autoFocus />
          <button
            type="button"
            onClick={() => handleFind()}
            disabled={looking || !code.trim()}
            aria-busy={looking}
            className="luxury-button w-full"
          >
            {looking ? "Looking…" : "Find Team"} {!looking && <span aria-hidden="true">→</span>}
          </button>
        </div>
        <p className="join-hint">Format DUM-1234 · the dash is added for you</p>

        {lookupError && (
          <div className="join-error">
            <p role="alert">{ERROR_MESSAGES[lookupError]}</p>
            {lookupError === "INVALID_CODE" && (
              <Link href="/register" className="join-error-link">
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
            className="join-preview"
          >
            <p className="join-preview-kicker">Team found</p>
            <p className="join-preview-name">{preview.name}</p>
            <div className="join-slots" aria-hidden="true">
              {Array.from({ length: TEAM_MAX }, (_, i) => (
                <span key={i} data-filled={i < preview.memberCount || undefined} />
              ))}
            </div>
            <p className="join-preview-meta">
              {preview.memberCount > TEAM_MAX
                ? `${preview.memberCount} members · Team full`
                : `${preview.memberCount}/${TEAM_MAX} slots filled`}
              {" · "}captain {preview.captainFirstName || "—"}
            </p>
          </motion.div>
        )}

        {teamFull && (
          <div className="join-error"><p role="alert">{ERROR_MESSAGES.TEAM_FULL}</p></div>
        )}

        {preview && !teamFull && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onSubmit={handleJoin}
            className="join-form"
          >
            <div>
              <label htmlFor="join-name" className="join-label">Your full name</label>
              <input id="join-name" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Tara" required autoComplete="name" className="join-input" />
            </div>
            <div>
              <label htmlFor="join-reg" className="join-label">Registration number</label>
              <input id="join-reg" value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase())} placeholder="URK26CSXXXX" pattern="URK26CS[0-9]{4}" maxLength={11} title="Use the format URK26CS followed by four digits." required className="join-input" />
            </div>
            <div>
              <label htmlFor="join-email" className="join-label">Email</label>
              <input id="join-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@karunya.edu.in" pattern="[A-Za-z0-9._%+-]+@karunya\.edu\.in" title="Use your @karunya.edu.in email address." required autoComplete="email" className="join-input" />
            </div>

            {joinError && <div className="join-error"><p role="alert">{ERROR_MESSAGES[joinError]}</p></div>}

            <button type="submit" disabled={submitting} aria-busy={submitting} className="luxury-button w-full">
              {submitting ? "Joining…" : "Join Team"} {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </motion.form>
        )}
      </div>
    </motion.div>
  );
}
