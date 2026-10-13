"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal, { MaskedWords } from "./fx/Reveal";

interface FAQItem {
  q: string;
  a: string;
  todoComment?: string;
}

const FAQS: FAQItem[] = [
  {
    q: "Who can take part?",
    a: "First-year students. Teams of exactly 4 members.",
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
    a: "14 October (Wednesday), 2:00 – 4:00 PM at the Food Processing Gallery Hall.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx((cur) => (cur === idx ? null : idx));
  };

  return (
    <section id="faq" className="faq-section">
      <div className="landing-col faq-layout">
        <Reveal as="header" className="faq-head">
          <span className="section-eyebrow">Frequently Asked</span>
          <h2 className="section-title">
            <MaskedWords text="Quick" /> <em><MaskedWords text="questions." offset={1} /></em>
          </h2>
          <p className="faq-aside">
            Anything else? Your team lobby shows your live roster and code once you register.
          </p>
        </Reveal>

        <div className="faq-list">
          {FAQS.map((item, idx) => {
            const isOpen = openIdx === idx;
            const contentId = `faq-answer-${idx}`;
            const buttonId = `faq-button-${idx}`;

            return (
              <div key={item.q} className="faq-item" data-open={isOpen || undefined}>
                <h3>
                  <button
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => toggle(idx)}
                    className="faq-button"
                  >
                    <span className="faq-index" aria-hidden="true">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="faq-question">{item.q}</span>
                    <span aria-hidden="true" className="faq-toggle" />
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={contentId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                      className="faq-answer"
                    >
                      <p>{item.a}</p>
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
