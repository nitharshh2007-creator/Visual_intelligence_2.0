"use client";

import { useEffect, useState } from "react";

// Ticking clock for computing "time ago" labels. Returns null until the
// component has mounted on the client, so render stays pure/deterministic
// (no Date.now() calls during render) and SSR output matches first paint.
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setNow(Date.now());
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
