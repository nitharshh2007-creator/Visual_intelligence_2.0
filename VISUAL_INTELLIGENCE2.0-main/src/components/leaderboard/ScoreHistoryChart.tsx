"use client";

// Split into its own chunk and lazy-loaded by TeamDrawer (next/dynamic)
// since it only ever renders inside an already-opened drawer.
interface Props {
  data: number[];
}

export default function ScoreHistoryChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--lb-grey-400)" }}>
        Not enough data yet
      </div>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 300;
    const y = 75 - ((v - min) / range) * 70;
    return `${x},${y}`;
  });
  const areaPoints = `${points.join(" ")} 300,80 0,80`;

  return (
    <svg width="100%" height="100%" viewBox="0 0 300 80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lb-line-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#lb-line-grad)" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
