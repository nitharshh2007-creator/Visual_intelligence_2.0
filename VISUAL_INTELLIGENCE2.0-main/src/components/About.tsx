"use client";

import { motion } from "framer-motion";
import { TEAM_MAX, TEAM_MIN } from "@/data/event";

const EASE_OUT_EXPO = [0.76, 0, 0.24, 1] as const;

export default function About() {
  return (
    <section 
      id="about" 
      data-bg="dark" 
      data-desk 
      className="py-24 px-6 md:px-12 xl:py-[96px] xl:px-[80px] text-brand-bg relative"
    >
      <div className="page-col flex flex-col">
        {/* 1. Eyebrow */}
        <span className="font-sans text-[13px] uppercase tracking-[0.26em] text-brand-bg/60 block mb-6">
          ABOUT · IEEE CS × ACM × DSCS
        </span>

        {/* Heading */}
        <h2 className="font-serif text-[clamp(56px,6.7vw,96px)] leading-[1] tracking-tight mb-10">
          <span className="block text-brand-bg">Beyond the</span>
          <span className="block italic text-brand-accent">Foundations.</span>
        </h2>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.05 }}
          className="flex flex-col"
        >
          {/* 2. Lead statement */}
          <p className="font-serif text-[clamp(26px,2.8vw,40px)] leading-[1.25] text-brand-bg/90 mb-10">
            <strong className="text-brand-bg font-medium">IEEE Computer Society & DSCS</strong> bridge the gap between academic theory and bleeding-edge industry practices. We believe in fostering technical elegance.
          </p>

          {/* 3. Three labelled rows */}
          <div className="border-b border-brand-bg/15 mb-10">
            {/* Row 1: IEEE */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.1 }}
              className="border-t border-brand-bg/15 py-6 flex flex-col min-[1100px]:flex-row min-[1100px]:items-start gap-4 min-[1100px]:gap-8"
            >
              <div className="w-[150px] shrink-0 font-sans text-[14px] uppercase tracking-[0.22em] text-brand-bg font-medium">
                IEEE
              </div>
              <div className="font-sans text-[18px] leading-[1.55] text-brand-bg/70 flex-1">
                IEEE is the world&apos;s largest technical professional organization. Every Wi-Fi connection (IEEE 802.11) and Ethernet cable (IEEE 802.3) runs on a standard IEEE wrote.
              </div>
            </motion.div>

            {/* Row 2: IEEE CS */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.18 }}
              className="border-t border-brand-bg/15 py-6 flex flex-col min-[1100px]:flex-row min-[1100px]:items-start gap-4 min-[1100px]:gap-8"
            >
              <div className="w-[150px] shrink-0 font-sans text-[14px] uppercase tracking-[0.22em] text-brand-bg font-medium">
                IEEE CS
              </div>
              <div className="font-sans text-[18px] leading-[1.55] text-brand-bg/70 flex-1">
                The Computer Society (<strong className="text-brand-bg font-medium">IEEE CS</strong>) — coding, software, AI — is the chapter running this event.
              </div>
            </motion.div>

            {/* Row 3: ACM */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.26 }}
              className="border-t border-brand-bg/15 py-6 flex flex-col min-[1100px]:flex-row min-[1100px]:items-start gap-4 min-[1100px]:gap-8"
            >
              <div className="w-[150px] shrink-0 font-sans text-[14px] uppercase tracking-[0.22em] text-brand-bg font-medium">
                ACM
              </div>
              <div className="font-sans text-[18px] leading-[1.55] text-brand-bg/70 flex-1">
                Alongside the <strong className="text-brand-bg font-medium">ACM</strong> (Association for Computing Machinery), the world&apos;s largest computing society and a close partner community for events like this one.
              </div>
            </motion.div>
          </div>

          {/* 4. Body paragraph */}
          <p className="font-sans text-[18px] leading-[1.6] text-brand-bg/70 mb-10">
            <strong className="text-brand-bg font-medium">Visual Intelligence 2.0</strong> is exclusively designed for first-year students to accelerate their AI literacy. In an era where AI is ubiquitous, the ability to effectively instruct and collaborate with these models is a foundational craft.
          </p>

          {/* Pull quote */}
          <p className="font-serif italic text-[clamp(24px,2.6vw,38px)] leading-[1.25] text-brand-bg mb-12">
            This isn&apos;t just a competition. It&apos;s a high-stakes, 4-stage pursuit of precision that demands rapid coordination, sharp memory, and creative linguistics — played out across teams of {TEAM_MIN}–{TEAM_MAX}, where every member&apos;s role decides the outcome.
          </p>

          {/* 5. Stats row inside the column */}
          <div className="border-t border-brand-bg/15 pt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <span className="font-serif text-[clamp(34px,3.6vw,56px)] leading-none text-brand-bg block">
                400,000+
              </span>
              <span className="font-sans text-[13px] uppercase tracking-[0.2em] text-brand-bg/60 block mt-3">
                IEEE Members
              </span>
            </div>
            <div>
              <span className="font-serif text-[clamp(34px,3.6vw,56px)] leading-none text-brand-bg block">
                160+
              </span>
              <span className="font-sans text-[13px] uppercase tracking-[0.2em] text-brand-bg/60 block mt-3">
                Countries
              </span>
            </div>
            <div>
              <span className="font-serif italic text-brand-accent text-[clamp(34px,3.6vw,56px)] leading-none block">
                1963
              </span>
              <span className="font-sans text-[13px] uppercase tracking-[0.2em] text-brand-bg/60 block mt-3">
                Since
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
