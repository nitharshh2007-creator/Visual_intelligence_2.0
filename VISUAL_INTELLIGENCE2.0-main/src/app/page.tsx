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
    <main id="main-content" className="landing-page min-h-screen">
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
