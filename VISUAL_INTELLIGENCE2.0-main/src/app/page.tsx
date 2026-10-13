import "./landing.css";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
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
      <Hero />
      <About />
      <StageCards />
      <HowToJoin />
      <Marquee />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
