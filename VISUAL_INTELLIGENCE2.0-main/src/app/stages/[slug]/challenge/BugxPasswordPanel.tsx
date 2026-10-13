"use client";

import { useState } from "react";
import { submitBugxPassword, StageActionError } from "@/lib/stageAccess";

export default function BugxPasswordPanel({
  slug,
  teamCode,
  regNo,
  solved,
  formUrl,
  onSolved,
  isEnded,
}: {
  slug: string;
  teamCode: string;
  regNo: string;
  solved: boolean;
  formUrl: string | null;
  onSolved: () => void;
  isEnded?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitBugxPassword(teamCode, regNo, slug, password.trim());
      if (result.success) {
        setPassword("");
        onSolved();
      } else {
        setError("Wrong password — keep hunting.");
      }
    } catch (e) {
      setError(e instanceof StageActionError ? e.message : "Could not check password right now.");
    } finally {
      setSubmitting(false);
    }
  }

  if (solved) {
    return (
      <div className="p-6 border border-emerald-500/30 bg-emerald-500/10 rounded-xl text-center space-y-3">
        <p className="text-emerald-300 font-bold uppercase tracking-wider text-sm">Password unlocked</p>
        <p className="text-white/60 text-sm">The locked file above is now available. Submit your final answer here:</p>
        {formUrl && (
          isEnded ? (
            <div className="inline-block px-5 py-2.5 bg-white/5 border border-white/10 text-white/40 rounded font-mono font-bold text-xs uppercase tracking-wider">
              Stage Ended · Form Closed
            </div>
          ) : (
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block px-5 py-2.5 bg-emerald-500 text-black rounded font-bold text-sm uppercase tracking-wider"
            >
              Open Google Form →
            </a>
          )
        )}
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="p-6 border border-white/10 bg-white/5 rounded-xl text-center space-y-2">
        <p className="text-white/70 font-medium text-sm">Stage has ended.</p>
        <p className="text-white/40 text-xs">Password verification and submissions are now closed.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-white/10 bg-white/5 rounded-xl space-y-3">
      <p className="text-white font-medium">Enter the password you found to unlock the locked file.</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Password"
          className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded text-white"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !password.trim()}
          className="px-5 py-2.5 bg-[var(--lb-burgundy-600)] hover:bg-[var(--lb-burgundy-500)] text-white rounded font-bold text-sm uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
