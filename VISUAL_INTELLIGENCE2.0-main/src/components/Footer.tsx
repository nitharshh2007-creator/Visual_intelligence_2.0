/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { eventDetails } from "@/data/event";

const LINKS = [
  { href: "/#about", label: "About" },
  { href: "/stages", label: "Stages" },
  { href: "/register", label: "Register Team" },
  { href: "/register?mode=join", label: "Join with Code" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  return (
    <footer data-bg="dark" className="site-footer">
      <div className="landing-col">
        <div className="footer-top">
          <div className="footer-brand">
            <p className="footer-mark">Visual<br /><em>Intelligence</em> <span>2.0</span></p>
            <p className="footer-blurb">
              {eventDetails.title}: {eventDetails.subtitle}. Empowering the next generation of engineers with AI literacy.
            </p>
          </div>

          <div className="footer-cols">
            <div>
              <h4>Event</h4>
              <ul>
                <li>{eventDetails.date}</li>
                <li>{eventDetails.time}</li>
                <li>{eventDetails.venue}</li>
              </ul>
            </div>
            <div>
              <h4>Navigation</h4>
              <ul>
                {LINKS.map((l) => (
                  <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:contact@ieee-cse.org">contact@ieee-cse.org</a></li>
                <li><button type="button" onClick={scrollToTop}>Back to Top ↑</button></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Organizer & Partner Logos */}
        <div className="footer-logos">
          <img src="/logos/karunya.png" alt="Karunya" className="footer-logo-lg" />
          <img src="/logos/ieee_cs_logo.png" alt="IEEE Computer Society" />
          <img src="/logos/acm.png" alt="ACM" />
          <span className="footer-copy">© 2026 IEEE Computer Society CSE.</span>
        </div>
      </div>
    </footer>
  );
}
