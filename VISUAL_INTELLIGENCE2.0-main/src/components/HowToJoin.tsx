"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { TEAM_MAX, TEAM_SIZE_LABEL } from "@/data/event";
import Reveal, { MaskedWords } from "./fx/Reveal";

// The real registration flow, in order (register/page.tsx →
// LobbyBoard → TeamGate): a captain creates the team and gets an invite
// code/link/QR, teammates join with that code until the lobby is full,
// and the full team's code is what opens the stages on the day.
const STEPS = [
  {
    title: `Form a team of ${TEAM_SIZE_LABEL}`,
    body: `First-year students only. Gather your ${TEAM_MAX} — every member's role decides the outcome.`,
    glyph: "team",
  },
  {
    title: "Captain registers the team",
    body: "One member creates the team and receives an invite code, link and QR.",
    glyph: "register",
  },
  {
    title: "Teammates join with the code",
    body: `Everyone else picks Join with Code. The lobby fills until all ${TEAM_MAX} slots are taken.`,
    glyph: "code",
  },
  {
    title: "Enter on 14 October",
    body: "With a full team, your team code opens the stages — one at a time, in order.",
    glyph: "enter",
  },
] as const;

// Steps light up as they cross the middle of the viewport, and the
// route between them draws to match. One observer for the whole list;
// it only writes attributes/variables, never React state.
export default function HowToJoin() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = wrapRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>(".journey-step"));
    let reached = -1;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = items.indexOf(entry.target as HTMLElement);
          if (idx > reached) reached = idx;
        }
        items.forEach((item, i) => item.toggleAttribute("data-active", i <= reached));
        list.style.setProperty("--route", String(Math.max(reached, 0) / (items.length - 1)));
        if (reached === items.length - 1) observer.disconnect();
      },
      { rootMargin: "0px 0px -35% 0px" }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-to-join" className="join-section">
      <div className="landing-col">
        <Reveal as="header" className="join-head">
          <span className="section-eyebrow">How to Join · {STEPS.length} Steps</span>
          <h2 className="section-title">
            <MaskedWords text="From squad" /> <em><MaskedWords text="to stage." offset={2} /></em>
          </h2>
        </Reveal>

        <div ref={wrapRef} className="journey-wrap">
          <div className="journey-route" aria-hidden="true"><span /></div>
          <ol className="journey">
            {STEPS.map((step, idx) => (
              <li key={step.title} className="journey-step" style={{ "--i": idx } as CSSProperties}>
                <span className="journey-num" aria-hidden="true">{idx + 1}</span>
                <div className="journey-glyph" aria-hidden="true"><Glyph kind={step.glyph} /></div>
                <h3 className="journey-title">
                  <span className="sr-only">Step {idx + 1}: </span>
                  {step.title}
                </h3>
                <p className="journey-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="join-actions">
          <Link href="/register" className="button-primary button-lg">
            Register Team <span aria-hidden="true" className="button-arrow">→</span>
          </Link>
          <Link href="/register?mode=join" className="button-secondary button-lg">
            Join with Code <span aria-hidden="true" className="button-arrow">→</span>
          </Link>
          <span className="join-note">Free entry · E-certificate for participating</span>
        </div>
      </div>
    </section>
  );
}

function Glyph({ kind }: { kind: (typeof STEPS)[number]["glyph"] }) {
  switch (kind) {
    case "team":
      return (
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="30" className="g-orbit" />
          {[[40, 10], [70, 40], [40, 70], [10, 40]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="6" className="g-dot" style={{ "--i": i } as CSSProperties} />
          ))}
          <circle cx="40" cy="40" r="5" className="g-core" />
        </svg>
      );
    case "register":
      return (
        <svg viewBox="0 0 80 80" fill="none">
          <rect x="16" y="12" width="48" height="56" rx="6" className="g-card" />
          <line x1="26" x2="50" y1="26" y2="26" className="g-line g-line-accent" />
          <line x1="26" x2="54" y1="36" y2="36" className="g-line" />
          <line x1="26" x2="44" y1="46" y2="46" className="g-line" />
          <rect x="26" y="54" width="16" height="6" rx="2" className="g-core" />
        </svg>
      );
    case "code":
      return (
        <svg viewBox="0 0 80 80" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={8 + i * 17} y="28" width="13" height="24" rx="3" className={i === 3 ? "g-slot g-slot-open" : "g-slot"} style={{ "--i": i } as CSSProperties} />
          ))}
          <line x1="8" x2="72" y1="62" y2="62" className="g-line" />
        </svg>
      );
    case "enter":
      return (
        <svg viewBox="0 0 80 80" fill="none">
          <path d="M22 68 V22 a18 18 0 0 1 36 0 V68" className="g-card" />
          <path d="M30 68 V26 a10 10 0 0 1 20 0 V68" className="g-door" />
          <circle cx="40" cy="44" r="4" className="g-core" />
          <line x1="10" x2="70" y1="68" y2="68" className="g-line" />
        </svg>
      );
  }
}
