"use client";

// Original geometric trophy illustration (no third-party artwork) —
// built from basic SVG primitives (cup, two handle arcs, stem, base)
// filled with the podium card's own material gradient, so it reads
// as carved from the same block the card is made of.

export type PodiumMaterial = "gold" | "pearl" | "graphite";

const MATERIAL_GRADIENT: Record<PodiumMaterial, [string, string]> = {
  gold: ["#D8405F", "#2A0009"],
  pearl: ["#FFFFFF", "#9A9AA3"],
  graphite: ["#55555C", "#0A0A0B"],
};

const ORDINAL: Record<number, string> = { 1: "1ST", 2: "2ND", 3: "3RD" };

interface Props {
  material: PodiumMaterial;
  rank: 1 | 2 | 3;
  size?: number;
  className?: string;
}

export default function TrophyIcon({ material, rank, size = 96, className }: Props) {
  const gradId = `lb-trophy-grad-${material}`;
  const [from, to] = MATERIAL_GRADIENT[material];
  const strokeColor = material === "pearl" ? "rgba(11,11,12,0.25)" : "rgba(255,255,255,0.35)";

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* Base */}
      <rect x="30" y="122" width="60" height="10" rx="2" fill={`url(#${gradId})`} stroke={strokeColor} strokeWidth="1" />
      <rect x="42" y="110" width="36" height="14" rx="2" fill={`url(#${gradId})`} stroke={strokeColor} strokeWidth="1" />

      {/* Stem */}
      <rect x="54" y="88" width="12" height="24" fill={`url(#${gradId})`} stroke={strokeColor} strokeWidth="1" />

      {/* Handles */}
      <path
        d="M34 34 C14 34 10 58 26 68 C32 72 40 70 44 64"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M86 34 C106 34 110 58 94 68 C88 72 80 70 76 64"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Cup */}
      <path
        d="M30 20 H90 C90 56 76 90 60 90 C44 90 30 56 30 20 Z"
        fill={`url(#${gradId})`}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      {/* Highlight streak on the cup */}
      <path
        d="M42 26 C40 50 46 72 56 84"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Engraved ordinal plate */}
      <rect x="40" y="96" width="40" height="16" rx="3" fill="rgba(0,0,0,0.25)" />
      <text
        x="60"
        y="108"
        textAnchor="middle"
        fontFamily="Montserrat, sans-serif"
        fontWeight="900"
        fontSize="11"
        fill={material === "pearl" ? "#0B0B0C" : "#FFFFFF"}
      >
        {ORDINAL[rank]}
      </text>
    </svg>
  );
}
