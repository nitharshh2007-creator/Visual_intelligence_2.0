"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { checkIsAdmin, getAdminSession, onAdminAuthStateChange, signOutAdmin } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase";
import Loader from "@/components/ui/Loader";

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
    return <div className="admin-shell min-h-screen text-white">{children}</div>;
  }

  const navLinks = [
    { href: "/admin", label: "Dashboard", active: pathname === "/admin" },
    { href: "/admin/stages", label: "Stages", active: pathname.startsWith("/admin/stages") },
    { href: "/admin/teams", label: "Teams & Shortlisting", active: pathname.startsWith("/admin/teams") },
    { href: "/admin/cyber-themes", label: "Cyber Themes", active: pathname.startsWith("/admin/cyber-themes") },
  ];
  const renderLinks = () =>
    navLinks.map((l) => (
      <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined} className="admin-nav-link">
        {l.label}
      </Link>
    ));

  return (
    <div className="admin-shell min-h-screen text-white font-sans">
      {gate === "ok" && (
        <nav aria-label="Control room" className="border-b border-white/10 bg-[#191818]/80 backdrop-blur-md sticky top-0 z-50 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)]">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-5 min-w-0">
              <span className="flex items-center gap-2 font-sans font-bold uppercase tracking-[0.15em] text-sm text-[#e9adb5] shrink-0">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#a8324a_50%,#4a0a12)] shadow-[0_0_10px_rgba(168,50,74,0.8)]" />
                Control Room
              </span>
              <div className="hidden lg:flex items-center gap-1 text-[11px] uppercase tracking-wider text-white/55">
                {renderLinks()}
              </div>
            </div>
            <button
              onClick={async () => {
                await signOutAdmin();
                router.replace("/admin/login");
              }}
              className="shrink-0 min-h-9 text-[11px] uppercase tracking-wider text-white/60 hover:text-white border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full px-4 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
          <div className="lg:hidden flex items-center gap-1 px-3 pb-3 text-[11px] uppercase tracking-wider text-white/55 overflow-x-auto no-scrollbar">
            {renderLinks()}
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {gate === "checking" && <Loader label="Checking session" tone="dark" />}
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
    <Suspense fallback={<div className="admin-shell min-h-screen text-white"><Loader label="Loading" tone="dark" /></div>}>
      <InnerAdminLayout>{children}</InnerAdminLayout>
    </Suspense>
  );
}
