"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface Props {
  value: number;
  className?: string;
}

export default function AnimatedNumber({ value, className }: Props) {
  const spring = useSpring(value, { stiffness: 120, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());
  const [text, setText] = useState(() => Math.round(value).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
  }, [display]);

  return <motion.span className={className}>{text}</motion.span>;
}
