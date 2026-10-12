"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { TEAM_MAX, TEAM_MIN } from "@/data/event";

const EASE_OUT_EXPO = [0.76, 0, 0.24, 1] as const;

export default function Hero() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const textVariants: Variants = {
    hidden: { y: "105%", opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: { duration: 1, ease: EASE_OUT_EXPO }
    }
  };

  return (
    <section 
      id="hero" 
      data-desk 
      className="relative min-h-screen flex flex-col justify-between pt-32 pb-16 overflow-hidden px-6 lg:px-12 z-10"
    >
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 flex flex-col justify-center page-col"
      >
        <div className="overflow-hidden mb-4">
          <motion.p variants={textVariants} className="font-sans text-xs uppercase tracking-[0.2em] text-brand-fg/50 mb-2">
            IEEE COMPUTER SOCIETY · DSCS PRESENTS
          </motion.p>
        </div>
        
        {/* Title */}
        <div className="font-serif leading-[0.95] tracking-tight text-brand-fg text-[clamp(56px,7.4vw,108px)]">
          <div className="overflow-hidden pb-1">
            <motion.h1 variants={textVariants}>Visual</motion.h1>
          </div>
          <div className="overflow-hidden pb-4">
            <motion.h1 variants={textVariants} className="italic text-[#6b0f1a]">
              <span className="italic text-[#6b0f1a]">Intelligence 2.0</span>
            </motion.h1>
          </div>
        </div>

        {/* Big Info Band */}
        <motion.div
          variants={textVariants}
          className="mt-6 border-t border-brand-fg border-b border-brand-fg/10 py-[26px]"
        >
          <div 
            className="flex flex-wrap items-start" 
            style={{ gap: "28px 48px" }}
          >
            {/* Block 1: Date */}
            <div style={{ flex: "0 1 auto" }}>
              <span className="block font-sans text-[13px] uppercase tracking-[0.24em] text-brand-fg/60 font-medium">
                Date
              </span>
              <p className="font-serif text-[clamp(32px,3.2vw,52px)] leading-[1.05] text-brand-fg my-1.5 whitespace-nowrap">
                14 October
              </p>
              <span className="block font-sans text-[14px] md:text-[16px] uppercase tracking-[0.12em] text-brand-fg/60 font-medium">
                Wednesday
              </span>
            </div>

            {/* Block 2: Time */}
            <div style={{ flex: "0 1 auto" }}>
              <span className="block font-sans text-[13px] uppercase tracking-[0.24em] text-brand-fg/60 font-medium">
                Time
              </span>
              <p className="font-serif text-[clamp(32px,3.2vw,52px)] leading-[1.05] text-brand-fg my-1.5 whitespace-nowrap">
                2:00 – 4:00 PM
              </p>
              <span className="block font-sans text-[14px] md:text-[16px] uppercase tracking-[0.12em] text-brand-fg/60 font-medium">
                Two Hours · Four Stages
              </span>
            </div>

            {/* Block 3: Location */}
            <div style={{ flex: "0 1 auto" }}>
              <span className="block font-sans text-[13px] uppercase tracking-[0.24em] text-brand-fg/60 font-medium">
                Location
              </span>
              <p className="font-serif text-[clamp(32px,3.2vw,52px)] leading-[1.05] text-brand-fg my-1.5 whitespace-nowrap">
                DSCS Gallery Hall
              </p>
              <span className="block font-sans text-[14px] md:text-[16px] uppercase tracking-[0.12em] text-brand-fg/60 font-medium">
                Karunya Campus
              </span>
            </div>
          </div>
        </motion.div>

        {/* CTA Row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8, ease: EASE_OUT_EXPO }}
          className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-6 sm:gap-8 flex-wrap"
        >
          <Link
            href="/register"
            className="h-16 px-10 bg-brand-accent text-brand-bg font-sans text-xs uppercase tracking-[0.2em] font-semibold flex items-center justify-center hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            Register Team
          </Link>
          <Link
            href="/register?mode=join"
            className="font-sans text-xs uppercase tracking-[0.15em] text-brand-fg underline underline-offset-4 decoration-brand-fg hover:opacity-70 transition-opacity flex items-center justify-center py-2"
          >
            Join with Code →
          </Link>
          <span className="font-sans text-xs uppercase tracking-[0.15em] text-brand-fg/50 text-center sm:text-left">
            {TEAM_MIN}–{TEAM_MAX} Members per Team · Free Entry · E-Certificate
          </span>
        </motion.div>
      </motion.div>

      {/* Subtle bottom divider for structure */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="mt-12 pt-4 border-t border-brand-fg/10"
      >
        <div className="page-col font-sans text-[11px] uppercase tracking-[0.18em] text-brand-fg/40 flex justify-between items-center">
          <span>First-Year AI Literacy Championship</span>
          <span className="hidden sm:inline">Visual Intelligence 2.0 · DSCS</span>
        </div>
      </motion.div>
    </section>
  );
}
