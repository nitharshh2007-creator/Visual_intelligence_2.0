/* eslint-disable @next/next/no-img-element */
"use client";

import { eventDetails } from "@/data/event";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  return (
    <footer 
      data-bg="dark" 
      data-desk 
      data-desk-a="0" 
      className="py-24 px-6 lg:px-12 text-brand-bg font-sans relative"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-16">
        
        <div className="space-y-12">
          <div className="font-serif italic text-3xl md:text-5xl">
            Visual<br/>Intelligence
          </div>
          
          <div className="text-xs uppercase tracking-[0.1em] text-brand-bg/50 max-w-sm leading-relaxed">
            {eventDetails.title}: {eventDetails.subtitle}.
            Empowering the next generation of engineers with AI literacy.
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-12 md:gap-24 text-xs uppercase tracking-[0.1em]">
          <div>
            <h4 className="text-brand-bg/50 mb-4">Contact</h4>
            <div className="space-y-2">
              <p>{eventDetails.venue}</p>
              <a href="mailto:contact@ieee-cse.org" className="block hover:opacity-50 transition-opacity">
                contact@ieee-cse.org
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-brand-bg/50 mb-4">Navigation</h4>
            <div className="space-y-2 flex flex-col items-start">
              <button onClick={scrollToTop} className="hover:opacity-50 transition-opacity">Back to Top</button>
              <a href="#register" className="hover:opacity-50 transition-opacity">Register</a>
            </div>
          </div>
        </div>
      </div>

      {/* Organizer & Partner Logos */}
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-brand-bg/10 flex flex-wrap items-center gap-8 md:gap-12">
        <img
          src="/logos/karunya.png"
          alt="Karunya"
          className="h-8 md:h-10 w-auto object-contain invert brightness-0 opacity-60 hover:opacity-100 transition-opacity"
        />
        <img
          src="/logos/ieee_cs_logo.png"
          alt="IEEE Computer Society"
          className="h-7 md:h-9 w-auto object-contain invert brightness-0 opacity-60 hover:opacity-100 transition-opacity"
        />
        <img
          src="/logos/acm.png"
          alt="ACM"
          className="h-7 md:h-9 w-auto object-contain invert brightness-0 opacity-60 hover:opacity-100 transition-opacity"
        />
      </div>
      
      <div className="max-w-7xl mx-auto mt-8 pt-4 text-[10px] uppercase tracking-[0.1em] text-brand-bg/30">
        © 2026 IEEE Computer Society CSE.
      </div>
    </footer>
  );
}
