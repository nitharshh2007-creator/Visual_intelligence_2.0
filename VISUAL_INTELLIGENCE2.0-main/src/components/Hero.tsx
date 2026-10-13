import Link from "next/link";
import { TEAM_SIZE_LABEL } from "@/data/event";
import DeskBackground from "./DeskBackground";

export default function Hero() {
  return (
    <section id="hero" className="hero-section">
      <div className="site-container">
        <p className="eyebrow hero-eyebrow">IEEE COMPUTER SOCIETY · CSE PRESENTS</p>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">Visual<br /><em>Intelligence</em> <span>2.0</span></h1>
            <div className="hero-actions">
              <Link href="/register" className="button-primary">Register Team <span aria-hidden="true">↗</span></Link>
              <Link href="/register?mode=join" className="button-secondary">Join with Code →</Link>
            </div>
            <p className="hero-benefits">{TEAM_SIZE_LABEL} Members per Team · Free Entry · E-Certificate</p>
          </div>
          <div className="hero-art" aria-hidden="true"><DeskBackground /></div>
        </div>
        <dl className="event-details">
          <div><dt>Date</dt><dd>14 October<small>Wednesday</small></dd></div>
          <div><dt>Time</dt><dd>2:00 – 4:00 PM<small>Two Hours · Four Stages</small></dd></div>
          <div><dt>Location</dt><dd>Food Processing Gallery Hall<small>Karunya Campus</small></dd></div>
        </dl>
        <div className="hero-caption"><span>First-Year AI Literacy Championship</span><span>Visual Intelligence 2.0 · CSE</span></div>
      </div>
    </section>
  );
}
