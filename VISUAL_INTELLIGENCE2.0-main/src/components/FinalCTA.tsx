import Link from "next/link";
import { TEAM_SIZE_LABEL } from "@/data/event";
import Reveal, { MaskedWords } from "./fx/Reveal";

// Closing statement: the hero's orbit language returns as a quiet,
// tilted system behind the type, so the page ends where it began.
export default function FinalCTA() {
  return (
    <section id="register" className="cta-section">
      <div className="cta-orbits" aria-hidden="true">
        <span className="cta-orbit cta-orbit-a"><i /></span>
        <span className="cta-orbit cta-orbit-b"><i /></span>
        <span className="cta-orbit cta-orbit-c" />
        <span className="cta-orb" />
      </div>
      <div className="cta-ghost" aria-hidden="true">2.0</div>

      <div className="landing-col cta-layout">
        <Reveal as="header" className="cta-copy">
          <span className="section-eyebrow section-eyebrow-dark">Visual Intelligence 2.0 · IEEE CS × CSE</span>
          <h2 className="cta-title">
            <MaskedWords text="Bring your team." />
            <br />
            <em><MaskedWords text={"14 October, 2 PM."} offset={3} /></em>
          </h2>
        </Reveal>

        <Reveal className="cta-side">
          <dl className="cta-meta">
            <div><dt>Venue</dt><dd>Food Processing Gallery Hall</dd></div>
            <div><dt>Team</dt><dd>{TEAM_SIZE_LABEL} first-year students</dd></div>
            <div><dt>Entry</dt><dd>Free · E-certificate</dd></div>
          </dl>
          <div className="cta-actions">
            <Link href="/register" className="cta-button">
              Register Team <span aria-hidden="true" className="button-arrow">→</span>
            </Link>
            <Link href="/register?mode=join" className="cta-link">
              Join with Code <span aria-hidden="true" className="button-arrow">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
