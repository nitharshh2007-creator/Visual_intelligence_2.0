import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import MotionPreferences from "@/components/MotionPreferences";
import TiltController from "@/components/fx/TiltController";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Visual Intelligence 2.0",
  description: "4 Stages of Chaos. A live first-year event run by the IEEE Computer Society, CSE.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased text-brand-fg selection:bg-brand-fg selection:text-brand-bg">
        <MotionPreferences>{children}</MotionPreferences>
        <TiltController />
      </body>
    </html>
  );
}
