"use client";

import { useState } from "react";
import { getTeam, loadSession, normalizeTeamCode, saveSession } from "@/lib/registration";

// Recovery path for a member whose browser lost its session (cleared
// storage, new device). Never creates a team or member: it only
// re-establishes the existing code + reg_no session.
//
// The team code alone is not proof of identity — get_team_lobby()
// (supabase/migrations/0019_fix_registration_bugs.sql) refuses a
// reg_no that is not on that team, and code + reg_no is the same pair
// every stage RPC (get_stage_access/get_stage_content) already
// authorizes against server-side.
export default function RejoinTeam() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [regNo, setRegNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const teamCode = normalizeTeamCode(code);
    const reg = regNo.trim();
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(teamCode)) {
      setError("Enter your full team code, e.g. DUM-AB12.");
      return;
    }
    if (!reg) {
      setError("Enter your registration number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const team = await getTeam(teamCode, reg);
      if (!team) {
        setError("That team code and registration number don't match any team member.");
        return;
      }
      const previous = loadSession();
      const sameMember = previous?.teamCode === team.inviteCode && previous.regNo === reg;
      saveSession({ teamCode: team.inviteCode, regNo: reg, isCaptain: sameMember ? previous.isCaptain : false });
      // Reload in place so the gate re-checks the restored session and
      // the member stays on the page they were on.
      window.location.reload();
    } catch {
      setError("Couldn't verify right now. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4 transition-colors"
        >
          Rejoin Team
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="lb-panel mt-10 max-w-md mx-auto p-6 rounded-2xl border border-white/10 bg-white/5 text-left space-y-3"
      aria-labelledby="rejoin-title"
    >
      <h2 id="rejoin-title" className="text-lg font-serif text-white">Rejoin your team</h2>
      <p className="text-xs text-white/60 leading-relaxed">
        Lost access on this device? Enter your team code and the registration number you joined with, exactly as you entered it.
      </p>
      <label htmlFor="rejoin-code" className="block text-[10px] uppercase tracking-widest text-white/50">Team code</label>
      <input
        id="rejoin-code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="DUM-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        required
        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-[var(--lb-rose-200)] focus:shadow-[0_0_0_3px_rgba(235,169,184,0.15)] transition-[border-color,box-shadow]"
      />
      <label htmlFor="rejoin-reg" className="block text-[10px] uppercase tracking-widest text-white/50">Registration number</label>
      <input
        id="rejoin-reg"
        type="text"
        value={regNo}
        onChange={(e) => setRegNo(e.target.value)}
        placeholder="e.g. 24CS045"
        autoComplete="off"
        required
        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-[var(--lb-rose-200)] focus:shadow-[0_0_0_3px_rgba(235,169,184,0.15)] transition-[border-color,box-shadow]"
      />
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="flex-1 px-5 py-2.5 bg-[var(--lb-burgundy-600)] hover:bg-[var(--lb-burgundy-500)] text-white rounded font-bold text-sm uppercase tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:translate-y-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Verifying…" : "Rejoin"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="px-4 py-2.5 rounded border border-white/10 text-white/70 hover:text-white text-sm uppercase tracking-wider transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
