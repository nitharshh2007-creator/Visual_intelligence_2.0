import type { Metadata } from "next";
import "./globals.css";
import CustomCursor from "@/components/CustomCursor";

export const metadata: Metadata = {
  title: "Visual Intelligence 2.0 | Dum Sarat",
  description: "4 Stages of Chaos. A live first-year event run by the IEEE Computer Society, DSCS.",
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
    <html lang="en">
      <body className="antialiased text-brand-fg selection:bg-brand-fg selection:text-brand-bg animate-[fadeIn_0.4s_ease_forwards]">
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
