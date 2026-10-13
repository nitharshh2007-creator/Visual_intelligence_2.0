"use client";

import { useEffect } from "react";

// One delegated pointer listener drives every [data-tilt] element in the
// app (see the "Pointer tilt" block in globals.css), so cards opt in with
// a single attribute instead of each mounting its own handlers. Only runs
// for a mouse/pen with hover and no reduced-motion preference; touch
// devices keep the static card. Writes CSS variables only — no React
// state, no re-renders — and at most once per animation frame.
const QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const DEFAULT_MAX_DEG = 6;

export default function TiltController() {
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    let current: HTMLElement | null = null;
    let lastEvent: PointerEvent | null = null;
    let frame = 0;

    function release() {
      if (!current) return;
      const el = current;
      current = null;
      el.removeAttribute("data-tilt-active");
      for (const prop of ["--tilt-x", "--tilt-y", "--tilt-a", "--mx", "--my", "--glow"]) {
        el.style.removeProperty(prop);
      }
    }

    function paint() {
      frame = 0;
      const el = current;
      const e = lastEvent;
      if (!el || !e) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) - 0.5;
      const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) - 0.5;
      const max = Number(el.dataset.tiltMax) || DEFAULT_MAX_DEG;
      // rotateX(-py·max) then rotateY(px·max) collapsed into a single
      // axis-angle rotation so it fits the `rotate` property.
      const rx = -py * max;
      const ry = px * max;
      const angle = Math.hypot(rx, ry);
      el.style.setProperty("--tilt-x", angle ? rx.toFixed(3) : "0");
      el.style.setProperty("--tilt-y", angle ? ry.toFixed(3) : "1");
      el.style.setProperty("--tilt-a", `${angle.toFixed(2)}deg`);
      el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--glow", "1");
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tilt]") : null;
      if (target !== current) {
        release();
        if (target) {
          current = target;
          target.setAttribute("data-tilt-active", "");
        }
      }
      if (!current) return;
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(paint);
    }

    function attach() {
      document.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", release);
      window.addEventListener("scroll", release, { passive: true });
      window.addEventListener("blur", release);
    }

    function detach() {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", release);
      window.removeEventListener("scroll", release);
      window.removeEventListener("blur", release);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      release();
    }

    function sync() {
      detach();
      if (media.matches) attach();
    }

    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      detach();
    };
  }, []);

  return null;
}
