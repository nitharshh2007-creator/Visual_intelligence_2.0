// Oversized type band between the hero and About. Pure CSS loop
// (landing.css, `.marquee`); decorative, so hidden from assistive tech.
const WORDS = ["Prompt", "Context", "Reasoning", "Output", "Four Stages", "One Team"];

export default function Marquee() {
  const row = WORDS.map((w, i) => (
    <span key={i} className={i % 2 ? "marquee-word marquee-outline" : "marquee-word"}>
      {w}<i aria-hidden="true">✦</i>
    </span>
  ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
