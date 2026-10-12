"use client";

// Original "pearl coin" rank medal — a circular coin with a metallic
// bevel (two concentric circles + a gradient) and the rank number.
// Used on every list row (rank 4+), always in the white-pearl material
// per spec, independent of PodiumMaterial.

interface Props {
  rank: number;
  size?: number;
  className?: string;
}

export default function MedalCoin({ rank, size = 32, className }: Props) {
  const gradId = "lb-medal-grad";

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E4E4E8" />
          <stop offset="100%" stopColor="#B8B8C0" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${gradId})`} stroke="#8F0F2E" strokeWidth="1" />
      <circle cx="20" cy="20" r="14.5" fill="none" stroke="rgba(11,11,12,0.18)" strokeWidth="1" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="Montserrat, sans-serif"
        fontWeight="900"
        fontSize="15"
        fill="#0B0B0C"
      >
        {rank}
      </text>
    </svg>
  );
}
