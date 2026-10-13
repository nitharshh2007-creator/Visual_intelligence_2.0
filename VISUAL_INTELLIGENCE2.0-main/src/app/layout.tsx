import type { Metadata } from "next";
import "./globals.css";
import MotionPreferences from "@/components/MotionPreferences";

export const metadata: Metadata = {
  title: "Visual Intelligence 2.0",
  description: "4 Stages of Chaos. A live first-year event run by the IEEE Computer Society, CSE.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased text-brand-fg selection:bg-brand-fg selection:text-brand-bg">
        <MotionPreferences>{children}</MotionPreferences>
      </body>
    </html>
  );
}
