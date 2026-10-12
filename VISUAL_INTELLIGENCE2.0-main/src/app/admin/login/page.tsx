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

  return (
    <div className="min-h-screen flex items-center justify-center px-6 font-mono">
      <div className="w-full max-w-sm">
        <h1 className="font-sans font-bold uppercase tracking-[0.15em] text-xl mb-1 bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
          Control Room
        </h1>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-8">Admin sign-in · no public sign-up</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin ID or Email"
            required
            className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912] text-xs uppercase tracking-wider font-bold disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
