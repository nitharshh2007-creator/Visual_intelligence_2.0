// Covers this entire subtree (/stages and /stages/[slug]/*). The
// nested [slug]/layout.tsx is itself a Client Component (usePathname,
// use(params) for the tab bar), which Cache Components otherwise
// treats as a build-blocking client bailout with no static shell —
// `instant` can't be set there directly ("cannot be used in Client
// Components"), so it's set here instead, as low in the server-
// rendered part of the tree as it can go.
export const instant = false;

import { Suspense } from "react";
import "@/app/lb-theme.css";
import Navbar from "@/components/Navbar";
import TeamGate from "@/components/stages/TeamGate";

export default function StagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lb-theme min-h-screen bg-[var(--lb-black)] text-[var(--lb-white)]">
      {/* Background silk effect */}
      <div className="lb-bg fixed inset-0 -z-10">
        <div className="lb-bg-glow" />
        <div className="lb-bg-silk" />
        <div className="lb-bg-grain" />
      </div>

      <Navbar />

      <main className="pt-32 pb-16 relative z-10">
        {/* The nested [slug] layout+pages are entirely client-rendered
            (stage access/content is localStorage-session-based, no
            cookie for a server component to read) — this boundary is
            what lets Next produce a static shell for that subtree
            instead of throwing during prerender. */}
        <Suspense fallback={null}>
          <TeamGate>{children}</TeamGate>
        </Suspense>
      </main>
    </div>
  );
}
