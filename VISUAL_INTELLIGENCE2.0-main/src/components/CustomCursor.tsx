"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

export default function CustomCursor() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const sparkleId = useRef(0);
  const lastPos = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsVisible(true);

      const dist = Math.hypot(
        e.clientX - lastPos.current.x,
        e.clientY - lastPos.current.y
      );

      if (dist > 30) {
        lastPos.current = { x: e.clientX, y: e.clientY };

        const newSparkle: Sparkle = {
          id: sparkleId.current++,
          x: e.clientX + (Math.random() - 0.5) * 24,
          y: e.clientY + (Math.random() - 0.5) * 24,
          size: Math.random() * 18 + 12,
          rotation: Math.random() * 180,
        };

        setSparkles((prev) => [...prev.slice(-10), newSparkle]);

        setTimeout(() => {
          setSparkles((prev) => prev.filter((s) => s.id !== newSparkle.id));
        }, 700);
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovered(
        target.tagName.toLowerCase() === "a" ||
          target.tagName.toLowerCase() === "button" ||
          !!target.closest("a") ||
          !!target.closest("button") ||
          window.getComputedStyle(target).cursor === "pointer"
      );
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, []);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-4 h-4 bg-white rounded-full pointer-events-none z-[10000] mix-blend-difference"
        animate={{
          x: mousePos.x - 8,
          y: mousePos.y - 8,
          scale: isHovered ? 3.5 : 1,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 600, damping: 32, mass: 0.4 }}
      />

      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <AnimatePresence>
          {sparkles.map((sparkle) => (
            <motion.div
              key={sparkle.id}
              initial={{ scale: 0, x: sparkle.x, y: sparkle.y, rotate: sparkle.rotation }}
              animate={{ scale: [0, 1, 0], y: sparkle.y + 32, rotate: sparkle.rotation + 80 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute text-white flex items-center justify-center mix-blend-difference"
              style={{
                width: sparkle.size,
                height: sparkle.size,
                marginLeft: -sparkle.size / 2,
                marginTop: -sparkle.size / 2,
              }}
            >
              ✦
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
