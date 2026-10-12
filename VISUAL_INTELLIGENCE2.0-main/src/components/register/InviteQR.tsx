"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  data: string;
  size?: number;
}

// Generates the QR code entirely client-side (no third-party image API call).
export default function InviteQR({ data, size = 160 }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      color: { dark: "#1A1A1A", light: "#F5F3EF" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [data, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-md bg-brand-fg/5 animate-pulse"
        aria-label="Generating QR code"
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code to join the team" width={size} height={size} className="rounded-md" />;
}
