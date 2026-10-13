import { TEAM_SIZE_LABEL } from "@/data/event";
import Reveal, { MaskedWords } from "./fx/Reveal";

// "Beyond the Foundations" — the event's own copy, recomposed as an
// editorial statement: a monumental heading over a cropped outline word,
// the lead + purpose paragraph beside a small diagram of the craft the
// event teaches (an idea becomes a prompt, the model answers, you
// iterate on the output), then the pull quote as the section's
// typographic climax and the organiser ledger as a footnote.
const ORGANISERS = [
  {
    label: "IEEE",
    body: <>IEEE is the world&rsquo;s largest technical professional organization. Every Wi-Fi connection (IEEE 802.11) and Ethernet cable (IEEE 802.3) runs on a standard IEEE wrote.</>,
  },
  {
    label: "IEEE CS",
    body: <>The Computer Society (<strong>IEEE CS</strong>) — coding, software, AI — is the chapter running this event.</>,
  },
  {
    label: "ACM",
    body: <>Alongside the <strong>ACM</strong> (Association for Computing Machinery), the world&rsquo;s largest computing society and a close partner community for events like this one.</>,
  },
];

const STATS = [
  { value: "400,000+", label: "IEEE Members" },
  { value: "160+", label: "Countries" },
  { value: "1963", label: "Since", accent: true },
];

export default function About() {
  return (
    <section id="about" data-bg="dark" className="about-section">
      <div className="landing-col">
        <Reveal as="header" className="about-head">
          <span className="section-eyebrow section-eyebrow-dark">About · IEEE CS × ACM × DSCS</span>
          <h2 className="about-title">
            <MaskedWords text="Beyond the" />{" "}
            <em><MaskedWords text="Foundations." offset={2} /></em>
          </h2>
        </Reveal>

        <div className="about-split">
          <Reveal className="about-copy">
            <p className="about-lead">
              <strong>IEEE CS</strong> bridges the gap between academic theory and <em>bleeding-edge industry practices</em>. We believe in fostering technical elegance.
            </p>
            <p className="about-body">
              <strong>Visual Intelligence 2.0</strong> is exclusively designed for first-year students to accelerate their AI literacy. In an era where AI is ubiquitous, the ability to effectively instruct and collaborate with these models is a foundational craft.
            </p>
          </Reveal>
          <Reveal as="figure" className="about-diagram">
            <IdeaFlow />
            <figcaption>Instruct · Collaborate · Iterate</figcaption>
          </Reveal>
        </div>

        <Reveal as="blockquote" className="about-statement">
          <p>
            This isn&rsquo;t just a competition. It&rsquo;s a <em>high-stakes, 4-stage pursuit of precision</em> that demands{" "}
            <mark>rapid coordination</mark>, <mark>sharp memory</mark>, and <mark>creative linguistics</mark> — played out across teams of {TEAM_SIZE_LABEL}, where every member&rsquo;s role decides the outcome.<span className="about-quote-close" aria-hidden="true">&rdquo;</span>
          </p>
        </Reveal>

        <div className="about-foot">
          <Reveal as="dl" className="about-ledger">
            {ORGANISERS.map((row, i) => (
              <div key={row.label} style={{ "--i": i } as React.CSSProperties}>
                <dt>{row.label}</dt>
                <dd>{row.body}</dd>
              </div>
            ))}
          </Reveal>
          <Reveal className="about-stats">
            {STATS.map((s) => (
              <div key={s.label} className="about-stat">
                <span className={s.accent ? "about-stat-value about-stat-accent" : "about-stat-value"}>{s.value}</span>
                <span className="about-stat-label">{s.label}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// Idea → Prompt → Model → Output, with the iterate loop back to the
// prompt. Pure SVG; the path draws and the nodes light in sequence once
// the figure is in view (landing.css, `.flow-*`).
function IdeaFlow() {
  return (
    <svg className="flow" viewBox="0 0 420 360" fill="none" role="img" aria-label="An idea becomes a prompt, the model responds, and the output is refined by iterating">
      <defs>
        <radialGradient id="flow-orb" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#f6dfe3" />
          <stop offset=".28" stopColor="#a8324a" />
          <stop offset=".7" stopColor="#4a0a12" />
          <stop offset="1" stopColor="#1c0408" />
        </radialGradient>
      </defs>
      <g className="flow-grid">
        {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="0" x2="420" y1={i * 60} y2={i * 60} />)}
        {Array.from({ length: 8 }, (_, i) => <line key={`v${i}`} y1="0" y2="360" x1={i * 60} x2={i * 60} />)}
      </g>
      {["M58 92 C 120 92, 130 92, 172 92", "M228 92 C 300 92, 300 150, 300 168", "M300 232 C 300 270, 250 290, 214 290"].map((d, i) => (
        <path key={d} className="flow-path" pathLength={1} d={d} style={{ "--n": i } as React.CSSProperties} />
      ))}
      <path className="flow-loop" d="M120 290 C 40 290, 40 160, 150 118" />
      <path className="flow-signal" d="M58 92 C 120 92, 130 92, 172 92 L 228 92 C 300 92, 300 150, 300 168 L 300 232 C 300 270, 250 290, 214 290" />

      {/* Idea */}
      <g className="flow-node" style={{ "--n": 0 } as React.CSSProperties}>
        <circle cx="40" cy="92" r="18" className="flow-ring" />
        <circle cx="40" cy="92" r="4" className="flow-dot" />
        <text x="40" y="136" textAnchor="middle">Idea</text>
      </g>
      {/* Prompt */}
      <g className="flow-node" style={{ "--n": 1 } as React.CSSProperties}>
        <rect x="172" y="62" width="56" height="60" rx="8" className="flow-card" />
        <line x1="182" x2="214" y1="78" y2="78" className="flow-text flow-text-accent" />
        <line x1="182" x2="218" y1="90" y2="90" className="flow-text" />
        <line x1="182" x2="206" y1="102" y2="102" className="flow-text" />
        <text x="200" y="40" textAnchor="middle">Prompt</text>
      </g>
      {/* Model */}
      <g className="flow-node" style={{ "--n": 2 } as React.CSSProperties}>
        <ellipse cx="300" cy="200" rx="58" ry="16" className="flow-ring flow-orbit" />
        <circle cx="300" cy="200" r="32" fill="url(#flow-orb)" />
        <text x="372" y="204" textAnchor="start">Model</text>
      </g>
      {/* Output */}
      <g className="flow-node" style={{ "--n": 3 } as React.CSSProperties}>
        <rect x="120" y="258" width="94" height="64" rx="8" className="flow-card" />
        {[0, 1, 2].map((c) => [0, 1].map((r) => (
          <rect key={`${c}${r}`} x={130 + c * 26} y={268 + r * 24} width="20" height="18" rx="3" className={(c + r) % 2 === 0 ? "flow-tile flow-tile-on" : "flow-tile"} />
        )))}
        <text x="167" y="346" textAnchor="middle">Output</text>
      </g>
      <text x="58" y="214" className="flow-loop-label" textAnchor="middle">iterate</text>
    </svg>
  );
}
