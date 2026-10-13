"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function FinalCTA() {
  return (
    <section 
      id="register" 
      data-desk 
      data-desk-a="0" 
      className="py-24 md:py-32 px-6 lg:px-12 bg-brand-accent text-brand-bg relative z-10"
    >
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-12 lg:gap-16">
        {/* Left Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
        >
          <h2 className="font-serif text-[clamp(44px,7vw,96px)] leading-[0.95] tracking-tight text-brand-bg">
            Bring your team.
            <br />
            <span className="italic">14 October, 2 PM.</span>
          </h2>
        </motion.div>

        {/* Right Location & Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.76, 0, 0.24, 1] }}
          className="flex flex-col items-start lg:items-end gap-6"
        >
          <p className="font-serif text-[clamp(24px,3vw,36px)] text-brand-bg leading-tight">
            Food Processing Gallery Hall
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5 sm:gap-7 w-full sm:w-auto">
            <Link
              href="/register"
              className="h-14 px-8 bg-brand-bg text-brand-accent font-sans text-xs uppercase tracking-[0.2em] font-semibold flex items-center justify-center hover:opacity-90 transition-opacity w-full sm:w-auto shadow-lg"
            >
              Register Team
            </Link>
            <Link
              href="/register?mode=join"
              className="font-sans text-xs uppercase tracking-[0.15em] text-brand-bg underline underline-offset-4 decoration-brand-bg hover:opacity-80 transition-opacity flex items-center justify-center py-2"
            >
              Join with Code →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
