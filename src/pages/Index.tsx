import Navbar from "@/components/veliq/Navbar";
import FramingLines from "@/components/veliq/FramingLines";
import HeroSection from "@/components/veliq/HeroSection";
import AboutSection from "@/components/veliq/AboutSection";
import PlatformSection from "@/components/veliq/PlatformSection";
import HowItWorksSection from "@/components/veliq/HowItWorksSection";
import SecurityTypesSection from "@/components/veliq/SecurityTypesSection";
import FeaturesGrid from "@/components/veliq/FeaturesGrid";
import ComparisonSection from "@/components/veliq/ComparisonSection";
import TestimonialsSection from "@/components/veliq/TestimonialsSection";
import RoadmapSection from "@/components/veliq/RoadmapSection";
import PricingSection from "@/components/veliq/PricingSection";
import CTASection from "@/components/veliq/CTASection";
import FooterSection from "@/components/veliq/FooterSection";

const Index = () => (
  <>
    <Navbar />
    <FramingLines />
    <main className="z-10 flex flex-col w-full relative items-center">
      <HeroSection />
      <div id="about"><AboutSection /></div>
      <div id="platform"><PlatformSection /></div>
      <div id="how-it-works"><HowItWorksSection /></div>
      <div id="securities"><SecurityTypesSection /></div>
      <div id="features"><FeaturesGrid /></div>
      <div id="comparison"><ComparisonSection /></div>
      <div id="testimonials"><TestimonialsSection /></div>
      <div id="roadmap"><RoadmapSection /></div>
      <div id="pricing"><PricingSection /></div>
      <div id="docs"><CTASection /></div>
    </main>
    <FooterSection />
  </>
);

export default Index;
