/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadSession } from "@/lib/registration";
import { getStageAccess } from "@/lib/stageAccess";
import type { StageAccessEntry } from "@/lib/supabase";

export default function Navbar() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [stages, setStages] = useState<StageAccessEntry[]>([]);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let active = true;
    const session = loadSession();
    getStageAccess(session?.teamCode, session?.regNo).then(value => { if (active) setStages(value); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const close = () => { if (window.innerWidth >= 1100) dialog.current?.close(); };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (pathname === "/leaderboard") return null;
  const dark = pathname.startsWith("/stages") || pathname.startsWith("/admin/stages");
  const current = (match: boolean) => (match ? ("page" as const) : undefined);
  const onStages = current(pathname.startsWith("/stages"));
  const onRegister = current(pathname.startsWith("/register"));
  const links = [
    { href: "/#about", label: "About" },
    { href: "/stages", label: "Stages", current: onStages },
    { href: "/register", label: "Register Team", current: onRegister },
    { href: "/register?mode=join", label: "Join with Code" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];
  return <>
    <nav aria-label="Main navigation" data-scrolled={scrolled || undefined} className={"site-nav " + (dark ? "site-nav-dark" : "")}>
      <div className="site-container nav-inner">
        <Link href="/" className="nav-logos" aria-label="Visual Intelligence home">
          <img src="/logos/karunya.png" alt="Karunya" />
          <img src="/logos/ieee_cs_logo.png" alt="IEEE CS" />
          <img src="/logos/acm.png" alt="ACM" />
        </Link>
        <div className="nav-links">
          <Link href="/#about">About</Link>
          <div className="nav-stage-group">
            <Link href="/stages" aria-current={onStages}>Stages</Link>
            <div className="nav-stage-menu">
              {stages.map(s => <Link key={s.stage} href={"/stages/" + s.slug} aria-current={current(pathname.startsWith("/stages/" + s.slug))}>
                <span>{s.name ?? "Stage " + s.stage}</span>
                <span aria-label={s.state} className={"stage-dot " + (s.state === "LIVE" ? "stage-dot-live" : "")} />
              </Link>)}
            </div>
          </div>
          <Link href="/register" className="nav-register" aria-current={onRegister}>Register Team</Link>
          <Link href="/register?mode=join">Join with Code</Link>
          <Link href="/leaderboard" className="nav-leaderboard"><span className="stage-dot stage-dot-live" />Leaderboard</Link>
        </div>
        <button className="menu-trigger" aria-haspopup="dialog" aria-controls="mobile-menu" onClick={() => dialog.current?.showModal()}>Menu <span aria-hidden="true">☰</span></button>
      </div>
    </nav>
    <dialog id="mobile-menu" ref={dialog} className="mobile-menu" aria-label="Navigation">
      <div className="mobile-menu-header"><span>Visual Intelligence</span><button autoFocus onClick={() => dialog.current?.close()}>Close</button></div>
      <div className="mobile-menu-links">
        {links.map((l, i) => <Link key={l.href} href={l.href} data-index={"0" + (i + 1)} aria-current={l.current} onClick={() => dialog.current?.close()}>{l.label}</Link>)}
      </div>
    </dialog>
  </>;
}
