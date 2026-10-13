"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAdmin } from "@/lib/admin";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const loginEmail = email.includes('@') ? email : `${email.toLowerCase()}@admin.com`;
      await signInAdmin(loginEmail, password);
      router.replace(searchParams.get("next") || "/admin");
    } catch {
      setError("Invalid ID or password.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-white/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] focus:outline-none transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 font-mono">
      <div className="w-full max-w-sm admin-login-card">
        <div
          aria-hidden="true"
          className="w-11 h-11 mb-6 rounded-full bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.85)_0_6%,rgba(255,255,255,0.15)_16%,transparent_30%),radial-gradient(circle_at_50%_60%,#a8324a,#6b0f1a_40%,#2a0009_80%)] shadow-[inset_-6px_-8px_14px_rgba(0,0,0,0.45),0_12px_28px_-10px_rgba(168,50,74,0.7)]"
        />
        <h1 className="font-sans font-bold uppercase tracking-[0.15em] text-xl mb-1 text-[#e9adb5]">
          Control Room
        </h1>
        <p className="text-xs text-white/45 uppercase tracking-wider mb-8">Admin sign-in · no public sign-up</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-id" className="block text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">Admin ID or Email</label>
            <input
              id="admin-id"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin ID or Email"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className={fieldClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-300 px-3 py-2 rounded-md border-l-2 border-red-400 bg-red-500/10">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="luxury-button w-full !font-mono !tracking-wider"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
