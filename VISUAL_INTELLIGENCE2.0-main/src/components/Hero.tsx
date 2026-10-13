import type { CSSProperties } from "react";
import Link from "next/link";
import { TEAM_SIZE_LABEL, eventDetails } from "@/data/event";
import IntelligenceCore from "./IntelligenceCore";

// Server-rendered hero. Every entrance is CSS-only (landing.css, "Hero"),
// so the title and both actions are visible without waiting on JS.
// IntelligenceCore is the only client island: it drives the orb and
// writes the --px/--py (pointer) and --sp (scroll) variables onto this
// section, which the backdrop, title and orb each read at a different
// depth.
export default function Hero() {
  return (
    <section id="hero" className="hero-section">
      <div className="hero-backdrop" aria-hidden="true">
        <div className="hero-backdrop-grid" />
        <div className="hero-backdrop-arc" />
      </div>
      <div className="site-container">
        <p className="eyebrow hero-eyebrow">IEEE Computer Society · CSE presents</p>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span className="hero-line hero-line-visual">
                <span className="hero-mask"><span className="hero-word">Visual</span></span>
                <span className="hero-rule" aria-hidden="true" />
              </span>
              <span className="hero-line hero-line-main">
                <span className="hero-mask">
                  <span className="sr-only">Intelligence</span>
                  <span className="hero-word hero-letters" aria-hidden="true">
                    {Array.from("Intelligence", (ch, i) => (
                      <span key={i} style={{ "--l": i } as CSSProperties}>{ch}</span>
                    ))}
                  </span>
                </span>
              </span>
              <span className="hero-line hero-line-version">
                <span className="hero-tagline" aria-hidden="true">
                  <span>{eventDetails.tagline}</span>
                  <span>{eventDetails.subtitle}</span>
                </span>
                <span className="hero-mask"><span className="hero-word hero-version">2.0</span></span>
              </span>
            </h1>
            <p className="hero-lede">
              Enter the world of intelligence. Turn ideas into experiences — a live AI challenge for first-year teams.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="button-primary button-lg">
                Register Team <span aria-hidden="true" className="button-arrow">→</span>
              </Link>
              <Link href="/register?mode=join" className="button-secondary button-lg">
                Join with Code <span aria-hidden="true" className="button-arrow">→</span>
              </Link>
            </div>
            <p className="hero-benefits">{TEAM_SIZE_LABEL} Members per Team · Free Entry · E-Certificate</p>
          </div>
          <div className="hero-art" aria-hidden="true"><IntelligenceCore /></div>
        </div>
        <dl className="event-details">
          <div>
            <dt><span className="event-index">01</span>Date</dt>
            <dd>14 October<small>Wednesday</small></dd>
          </div>
          <div>
            <dt><span className="event-index">02</span>Time</dt>
            <dd>2:00 – 4:00 PM<small>Two Hours · Four Stages</small></dd>
          </div>
          <div>
            <dt><span className="event-index">03</span>Location</dt>
            <dd>Food Processing Gallery Hall<small>Karunya Campus</small></dd>
          </div>
        </dl>
        <div className="hero-caption">
          <span>First-Year AI Literacy Championship</span>
          <span className="hero-scroll" aria-hidden="true">Scroll to explore</span>
          <span>Visual Intelligence 2.0 · CSE</span>
        </div>
      </div>
    </section>
  );
}
