"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { checkIsAdmin, getAdminSession, onAdminAuthStateChange, signOutAdmin } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase";

type GateState = "checking" | "signed-out" | "not-admin" | "ok" | "unconfigured";

function InnerAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<GateState>("checking");

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    function earlyGate() {
      if (isLoginPage) {
        setGate("ok");
        return true;
      }
      if (!isSupabaseConfigured()) {
        setGate("unconfigured");
        return true;
      }
      return false;
    }
    if (earlyGate()) return;

    let cancelled = false;
    async function check() {
      const session = await getAdminSession();
      if (!session) {
        if (!cancelled) setGate("signed-out");
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const admin = await checkIsAdmin();
      if (!cancelled) setGate(admin ? "ok" : "not-admin");
    }
    check();

    const unsubscribe = onAdminAuthStateChange((signedIn) => {
      if (!signedIn) {
        setGate("signed-out");
        router.replace("/admin/login");
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#191818] text-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#191818] text-white font-mono">
      {gate === "ok" && (
        <nav className="border-b border-white/10 bg-white/[0.03] backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-sans font-bold uppercase tracking-[0.15em] text-sm text-[#e9adb5]">
                Control Room
              </span>
              <div className="hidden md:flex items-center gap-4 text-[11px] uppercase tracking-wider text-white/50">
                <Link
                  href="/admin"
                  className={`hover:text-white transition-colors ${pathname === "/admin" ? "text-white font-bold" : ""}`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/stages"
                  className={`hover:text-white transition-colors ${pathname.startsWith("/admin/stages") ? "text-white font-bold" : ""}`}
                >
                  Stages
                </Link>
                <Link
                  href="/admin/scoring"
                  className={`hover:text-white transition-colors ${pathname.startsWith("/admin/scoring") ? "text-white font-bold" : ""}`}
                >
                  Scoring
                </Link>
                <Link
                  href="/admin/teams"
                  className={`hover:text-white transition-colors ${pathname.startsWith("/admin/teams") ? "text-white font-bold" : ""}`}
                >
                  Teams & Shortlisting
                </Link>
                <Link
                  href="/admin/cyber-themes"
                  className={`hover:text-white transition-colors ${pathname.startsWith("/admin/cyber-themes") ? "text-white font-bold" : ""}`}
                >
                  Cyber Themes
                </Link>
              </div>
            </div>
            <button
              onClick={async () => {
                await signOutAdmin();
                router.replace("/admin/login");
              }}
              className="text-[11px] uppercase tracking-wider text-white/50 hover:text-white border border-white/15 rounded px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
          <div className="md:hidden flex items-center gap-4 px-4 pb-3 text-[11px] uppercase tracking-wider text-white/50 overflow-x-auto">
            <Link
              href="/admin"
              className={`hover:text-white transition-colors whitespace-nowrap ${pathname === "/admin" ? "text-white font-bold" : ""}`}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/stages"
              className={`hover:text-white transition-colors whitespace-nowrap ${pathname.startsWith("/admin/stages") ? "text-white font-bold" : ""}`}
            >
              Stages
            </Link>
            <Link
              href="/admin/scoring"
              className={`hover:text-white transition-colors whitespace-nowrap ${pathname.startsWith("/admin/scoring") ? "text-white font-bold" : ""}`}
            >
              Scoring
            </Link>
            <Link
              href="/admin/teams"
              className={`hover:text-white transition-colors whitespace-nowrap ${pathname.startsWith("/admin/teams") ? "text-white font-bold" : ""}`}
            >
              Teams & Shortlisting
            </Link>
            <Link
              href="/admin/cyber-themes"
              className={`hover:text-white transition-colors whitespace-nowrap ${pathname.startsWith("/admin/cyber-themes") ? "text-white font-bold" : ""}`}
            >
              Cyber Themes
            </Link>
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {gate === "checking" && (
          <div className="flex items-center justify-center py-32 text-white/40 text-sm uppercase tracking-wider">
            Checking session…
          </div>
        )}
        {gate === "unconfigured" && (
          <div className="flex items-center justify-center py-32 text-center">
            <div>
              <p className="text-amber-400 text-sm uppercase tracking-wider mb-2">Supabase not configured</p>
              <p className="text-white/40 text-sm">Set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY to use the admin console.</p>
            </div>
          </div>
        )}
        {gate === "not-admin" && (
          <div className="flex items-center justify-center py-32 text-center">
            <div>
              <p className="text-red-400 text-sm uppercase tracking-wider mb-2">Access denied</p>
              <p className="text-white/40 text-sm mb-4">This account isn&apos;t in the admins table.</p>
              <button
                onClick={async () => {
                  await signOutAdmin();
                  router.replace("/admin/login");
                }}
                className="text-xs uppercase tracking-wider border border-white/15 rounded px-4 py-2 hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
        {gate === "ok" && children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#191818] text-white">Loading...</div>}>
      <InnerAdminLayout>{children}</InnerAdminLayout>
    </Suspense>
  );
}
