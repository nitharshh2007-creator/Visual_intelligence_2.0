"use client";

import { useEffect, useRef } from "react";

// The hero's "intelligence core": a burgundy glass nucleus inside
// metallic orbit rings, a faint network of connected ideas behind it,
// and floating prompt / context / reasoning / output fragments — built
// from CSS 3D transforms (styles in app/landing.css, `.core*`), so it
// renders on every device without WebGL and costs no JS per frame.
//
// JS does three cheap things, all through CSS variables on the hero
// section so the backdrop and title can share the same depth system:
//   --px / --py  pointer position (-1…1), fine pointers only
//   --sp         hero scroll progress (0…1) for the hand-off to About
// plus pausing every animation while the hero is off-screen or the tab
// is hidden. Writes are batched into one rAF.
const NETWORK_NODES: [number, number][] = [
  [62, 118], [104, 52], [196, 30], [292, 58], [346, 132],
  [352, 248], [300, 336], [198, 368], [96, 330], [44, 236],
];
// Index pairs; the first three carry the flowing "signal" dash.
const NETWORK_LINKS: [number, number][] = [
  [0, 1], [3, 4], [6, 7], [1, 2], [2, 3], [4, 5], [5, 6], [7, 8], [8, 9], [9, 0], [1, 9], [3, 5],
];

export default function IntelligenceCore() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const host = el.closest<HTMLElement>(".hero-section") ?? el;

    let visible = true;
    const syncPaused = () => el.toggleAttribute("data-paused", !visible || document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPaused();
    });
    observer.observe(host);
    document.addEventListener("visibilitychange", syncPaused);

    const pointerMedia = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let frame = 0;
    let x = 0;
    let y = 0;
    let sp = 0;
    const paint = () => {
      frame = 0;
      host.style.setProperty("--px", x.toFixed(3));
      host.style.setProperty("--py", y.toFixed(3));
      host.style.setProperty("--sp", sp.toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onMove = (e: PointerEvent) => {
      if (!visible || e.pointerType === "touch") return;
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    const onScroll = () => {
      if (!visible) return;
      const h = host.offsetHeight || 1;
      sp = Math.min(Math.max(window.scrollY / h, 0), 1);
      schedule();
    };
    const sync = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (pointerMedia.matches) window.addEventListener("pointermove", onMove, { passive: true });
      if (motionMedia.matches) {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else {
        x = y = sp = 0;
        schedule();
      }
    };
    sync();
    pointerMedia.addEventListener("change", sync);
    motionMedia.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPaused);
      pointerMedia.removeEventListener("change", sync);
      motionMedia.removeEventListener("change", sync);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="core" aria-hidden="true">
      <div className="core-floor" />
      <div className="core-shadow" />
      <div className="core-stage">
        <svg className="core-network" viewBox="0 0 400 400" fill="none">
          {NETWORK_LINKS.map(([a, b], i) => (
            <line
              key={i}
              x1={NETWORK_NODES[a][0]}
              y1={NETWORK_NODES[a][1]}
              x2={NETWORK_NODES[b][0]}
              y2={NETWORK_NODES[b][1]}
              className={i < 3 ? "core-link core-link-signal" : "core-link"}
              style={i < 3 ? { animationDelay: `${i * -2.2}s` } : undefined}
            />
          ))}
          {NETWORK_NODES.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={i % 3 === 0 ? 3.2 : 2.2}
              className="core-net-node"
              style={{ animationDelay: `${i * -0.9}s` }}
            />
          ))}
        </svg>
        <div className="core-float">
          <div className="core-halo" />
          <div className="core-ring core-ring-a" />
          <div className="core-ring core-ring-b" />
          <div className="core-ring core-ring-c" />
          <div className="core-ring-dots" />
          <div className="core-orbit"><span className="core-node" /></div>
          <div className="core-orbit core-orbit-b"><span className="core-node" /></div>
          <div className="core-orbit core-orbit-c"><span className="core-node" /></div>
          <div className="core-pulse" />
          <div className="core-nucleus"><span className="core-nucleus-light" /></div>
          <div className="core-shell" />
        </div>
        <div className="core-pane core-pane-prompt">
          <span className="core-pane-label"><b />Prompt</span>
          <i className="accent" style={{ width: "72%" }} />
          <i style={{ width: "100%" }} />
          <i style={{ width: "84%" }} />
          <i className="core-caret" style={{ width: "46%" }} />
        </div>
        <div className="core-pane core-pane-output">
          <span className="core-pane-label"><b />Output</span>
          <div className="tiles">
            <b /><b /><b /><b /><b /><b />
          </div>
        </div>
        <span className="core-chip core-chip-context">Context</span>
        <span className="core-chip core-chip-reasoning">
          Reasoning
          <span className="core-dots"><i /><i /><i /></span>
        </span>
      </div>
    </div>
  );
}
