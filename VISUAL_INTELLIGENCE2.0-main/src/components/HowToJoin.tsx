"use client";

import { motion } from "framer-motion";

const STEPS = [
  { num: "1", title: "Form a team of 4–5" },
  { num: "2", title: "Register and get your team code" },
  { num: "3", title: "Join on the day with the code" },
];

export default function HowToJoin() {
  return (
    <section 
      id="how-to-join" 
      data-desk 
      className="py-28 px-6 lg:px-12 bg-brand-fg/[0.04] text-brand-fg relative z-10 border-t border-brand-fg/10"
    >
      <div className="page-col">
        <h2 className="font-serif text-xs uppercase tracking-[0.2em] text-brand-fg/50 mb-12">
          How to Join · 3 Steps
        </h2>

        <div className="flex flex-col border-b border-brand-fg/10">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: idx * 0.12, ease: [0.76, 0, 0.24, 1] }}
              className="border-t-2 border-brand-fg py-6 lg:py-8 flex items-center gap-6 lg:gap-10"
            >
              <span className="font-serif italic text-brand-accent text-[clamp(64px,6.5vw,96px)] leading-none block select-none shrink-0 w-16 sm:w-20">
                {step.num}
              </span>
              <h3 className="font-serif text-[clamp(24px,2.4vw,32px)] leading-tight text-brand-fg flex-1">
                {step.title}
              </h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
