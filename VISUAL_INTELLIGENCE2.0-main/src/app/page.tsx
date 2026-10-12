import DeskBackground from "@/components/DeskBackground";
import Navbar from "@/components/Navbar";
import EventStrip from "@/components/EventStrip";
import Hero from "@/components/Hero";
import About from "@/components/About";
import StageCards from "@/components/StageCards";
import HowToJoin from "@/components/HowToJoin";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <DeskBackground />
      <Navbar />
      <EventStrip />
      <Hero />
      <About />
      <StageCards />
      <HowToJoin />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
