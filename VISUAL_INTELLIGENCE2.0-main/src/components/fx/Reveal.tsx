"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

// Scroll reveal without re-rendering: one IntersectionObserver per
// element sets `data-inview` the first time it enters the viewport and
// then disconnects. Everything visual lives in CSS (`[data-reveal]` in
// app/landing.css), which also shows the final state immediately under
// prefers-reduced-motion — so nothing ever waits on an animation.
type RevealTag = "div" | "section" | "header" | "figure" | "ol" | "ul" | "blockquote" | "p" | "h2" | "dl";

export default function Reveal({
  as = "div",
  className,
  style,
  margin = "0px 0px -12% 0px",
  children,
  id,
}: {
  as?: RevealTag;
  className?: string;
  style?: CSSProperties;
  margin?: string;
  children?: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.setAttribute("data-inview", "");
        observer.disconnect();
      },
      { rootMargin: margin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [margin]);

  // Typed as "div" for the ref; every RevealTag is an HTMLElement.
  const Tag = as as "div";
  return (
    <Tag ref={ref} className={className} style={style} id={id} data-reveal="">
      {children}
    </Tag>
  );
}

// Splits a phrase into per-word masks so a heading can rise out of its
// own baseline. Words stay real text (selectable, read normally by
// screen readers); --i staggers them in CSS.
export function MaskedWords({ text, offset = 0, className }: { text: string; offset?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className={className ? `mask-word ${className}` : "mask-word"}>
            <span style={{ "--i": i + offset } as CSSProperties}>{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
