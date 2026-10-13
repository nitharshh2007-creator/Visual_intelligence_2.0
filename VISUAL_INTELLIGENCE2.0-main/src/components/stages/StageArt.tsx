import type { CSSProperties } from "react";

// One abstract artwork per stage NUMBER, so each stage reads as its own
// world on the homepage. Deliberately content-free: stage names, hooks
// and rules are gated behind get_stage_access()/get_stage_content()
// (see StageCards), so nothing here may hint at what a stage contains —
// these are compositions, not illustrations of the challenge.
// Motion lives in app/landing.css (`.art-*`) and only runs while the
// panel is hovered/focused/featured.
export default function StageArt({ stage }: { stage: number }) {
  switch (stage) {
    case 1: return <SignalArt />;
    case 2: return <MatrixArt />;
    case 3: return <LatticeArt />;
    default: return <PrismArt />;
  }
}

// 01 — concentric signal field with a sweeping beam.
function SignalArt() {
  return (
    <svg className="art art-signal" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" fill="none">
      <g className="art-signal-rings">
        {[40, 72, 104, 136, 168, 200].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} style={{ "--i": i } as CSSProperties} strokeDasharray={i % 2 ? "2 6" : undefined} />
        ))}
      </g>
      <line x1="0" y1="200" x2="400" y2="200" className="art-axis" />
      <line x1="200" y1="0" x2="200" y2="400" className="art-axis" />
      <g className="art-signal-sweep">
        <path d="M200 200 L200 0 A200 200 0 0 1 341 59 Z" className="art-signal-beam" />
        <line x1="200" y1="200" x2="200" y2="0" className="art-signal-arm" />
      </g>
      <circle cx="268" cy="118" r="4" className="art-blip" />
      <circle cx="132" cy="262" r="3" className="art-blip" style={{ animationDelay: "-1.4s" }} />
      <circle cx="300" cy="250" r="2.5" className="art-blip" style={{ animationDelay: "-2.6s" }} />
      <circle cx="200" cy="200" r="7" className="art-core" />
    </svg>
  );
}

// 02 — a dot matrix with a few cells held "in memory"; a diagonal wave
// passes through on hover.
const MATRIX_ON = new Set([12, 17, 23, 34, 45, 46, 51, 58, 67, 73, 76, 84]);
function MatrixArt() {
  return (
    <svg className="art art-matrix" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" fill="none">
      {Array.from({ length: 100 }, (_, i) => {
        const col = i % 10;
        const row = Math.floor(i / 10);
        const on = MATRIX_ON.has(i);
        return (
          <rect
            key={i}
            x={22 + col * 38}
            y={22 + row * 38}
            width={on ? 18 : 6}
            height={on ? 18 : 6}
            rx={3}
            transform={on ? "translate(-6 -6)" : undefined}
            className={on ? "art-cell art-cell-on" : "art-cell"}
            style={{ "--d": col + row } as CSSProperties}
          />
        );
      })}
      <path d="M22 288 H170 V136 H322" className="art-matrix-trace" pathLength={1} />
    </svg>
  );
}

// 03 — a triangulated lattice: many nodes, one connected structure.
const LATTICE: [number, number][] = [
  [40, 70], [150, 40], [270, 64], [372, 30], [96, 168], [214, 150], [330, 176],
  [36, 272], [160, 252], [276, 274], [380, 300], [100, 372], [226, 360], [340, 390],
];
const LATTICE_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6], [4, 5], [5, 6],
  [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [6, 10], [7, 8], [8, 9], [9, 10], [7, 11], [8, 11], [8, 12], [9, 12], [9, 13], [10, 13], [11, 12], [12, 13],
];
function LatticeArt() {
  return (
    <svg className="art art-lattice" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" fill="none">
      {LATTICE_LINKS.map(([a, b], i) => (
        <line
          key={i}
          x1={LATTICE[a][0]}
          y1={LATTICE[a][1]}
          x2={LATTICE[b][0]}
          y2={LATTICE[b][1]}
          className={i % 4 === 0 ? "art-link art-link-live" : "art-link"}
          style={{ "--i": i } as CSSProperties}
        />
      ))}
      {LATTICE.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 5 || i === 8 ? 7 : 4} className={i === 5 || i === 8 ? "art-node art-node-hub" : "art-node"} />
      ))}
    </svg>
  );
}

// 04 — converging perspective lines resolving into a single point.
function PrismArt() {
  const rays = Array.from({ length: 15 }, (_, i) => -20 + i * (440 / 14));
  return (
    <svg className="art art-prism" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" fill="none">
      <g className="art-prism-floor">
        {rays.map((x, i) => <line key={`r${i}`} x1={x} y1="400" x2="200" y2="168" />)}
        {[214, 246, 290, 346].map((y, i) => <line key={`h${i}`} x1="-20" x2="420" y1={y} y2={y} style={{ "--i": i } as CSSProperties} />)}
      </g>
      <g className="art-prism-shape">
        <path d="M200 52 L262 150 L200 196 L138 150 Z" className="art-prism-face" />
        <path d="M200 52 L262 150 L200 196 Z" className="art-prism-face art-prism-face-lit" />
        <path d="M200 52 L200 196" className="art-prism-edge" />
      </g>
      <circle cx="200" cy="168" r="5" className="art-focus" />
    </svg>
  );
}
