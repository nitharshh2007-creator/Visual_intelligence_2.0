"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  q: string;
  a: string;
  todoComment?: string;
}

const FAQS: FAQItem[] = [
  {
    q: "Who can take part?",
    a: "First-year students. Teams of 4–5 members.",
  },
  {
    q: "What does it cost?",
    a: "Free entry.",
  },
  {
    q: "What do we get?",
    a: "An e-certificate for participating.",
    // TODO: add prizes only when the organisers confirm
  },
  {
    q: "How does the team code work?",
    a: "After you register your team you get a team code. Other members use ‘Join with code’ to join that team.",
  },
  {
    q: "When and where?",
    a: "14 October (Wednesday), 2:00 – 4:00 PM at the DSCS Gallery Hall.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx((cur) => (cur === idx ? null : idx));
  };

  return (
    <section 
      id="faq" 
      data-desk 
      data-desk-end 
      className="py-32 px-6 lg:px-12 text-brand-fg relative z-10 border-t border-brand-fg/10"
    >
      <div className="page-col">
        {/* Heading */}
        <div className="mb-12">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-brand-fg/50 block mb-4">
            Frequently Asked
          </span>
          <h2 className="font-serif text-[clamp(48px,5.4vw,72px)] leading-[1.05] tracking-tight text-brand-fg">
            Quick <span className="italic text-brand-accent">questions</span>
          </h2>
        </div>

        {/* Accordion List */}
        <div className="border-t border-brand-fg divide-y divide-brand-fg/10">
          {FAQS.map((item, idx) => {
            const isOpen = openIdx === idx;
            const contentId = `faq-answer-${idx}`;
            const buttonId = `faq-button-${idx}`;

            return (
              <div key={item.q} className="py-6 lg:py-8">
                <button
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between text-left gap-6 group cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent"
                >
                  <span className="font-serif text-[clamp(22px,2.2vw,32px)] leading-snug text-brand-fg group-hover:text-brand-accent transition-colors">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 w-8 h-8 rounded-full border border-brand-fg/20 flex items-center justify-center font-serif text-lg leading-none text-brand-fg group-hover:border-brand-accent group-hover:text-brand-accent transition-colors"
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={contentId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: [0.76, 0, 0.24, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="font-sans text-sm md:text-base leading-relaxed text-brand-fg/70 pt-4 pb-2 max-w-xl">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
