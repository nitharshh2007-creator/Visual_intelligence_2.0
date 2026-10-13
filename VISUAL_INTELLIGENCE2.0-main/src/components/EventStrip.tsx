"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function EventStrip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const heroEl = document.getElementById("hero");
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Visible when hero is scrolled out of view
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  return (
    <aside
      aria-label="Event summary bar"
      inert={!visible}
      className={`fixed top-[76px] left-0 right-0 z-40 h-12 md:h-14 bg-[#050505] text-brand-bg border-b border-brand-fg/20 transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto shadow-2xl"
          : "-translate-y-2 opacity-0 pointer-events-none"
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-6 lg:px-12 flex items-center justify-between font-sans text-xs uppercase tracking-[0.18em]">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-brand-accent" />
          <span className="hidden sm:inline">14 OCT · 2:00 – 4:00 PM · FOOD PROCESSING GALLERY HALL</span>
          <span className="sm:hidden">14 OCT · 2 PM</span>
        </div>

        <Link
          href="/register"
          className="font-semibold text-brand-bg hover:text-brand-accent transition-colors flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5"
        >
          REGISTER →
        </Link>
      </div>
    </aside>
  );
}
