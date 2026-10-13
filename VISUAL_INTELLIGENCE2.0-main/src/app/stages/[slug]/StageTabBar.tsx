"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function StageTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();

  const tabs = [
    { name: "OVERVIEW", path: `/stages/${slug}` },
    { name: "CHALLENGE", path: `/stages/${slug}/challenge` },
  ];

  return (
    <div className="flex bg-black/40 p-1 rounded-full border border-white/10 mb-12">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.name}
            href={tab.path}
            aria-current={isActive ? "page" : undefined}
            className="flex-1 text-center relative py-2.5 px-4 text-xs tracking-widest font-bold rounded-full focus-visible:outline-2 focus-visible:outline-[var(--lb-rose-200)] focus-visible:outline-offset-2"
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-full border border-[var(--lb-burgundy-400)] bg-[linear-gradient(180deg,rgba(143,15,46,0.55),rgba(74,0,18,0.55))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-10px_rgba(109,0,26,0.8)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className={`relative z-10 ${isActive ? "text-white" : "text-white/50 hover:text-white/80 transition-colors"}`}>
              {tab.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
