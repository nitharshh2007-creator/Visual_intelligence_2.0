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
            className="flex-1 text-center relative py-2.5 px-4 text-xs tracking-widest font-bold"
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white/10 border border-white/20 rounded-full"
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
