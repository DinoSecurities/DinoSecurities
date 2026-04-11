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
      <AboutSection />
      <PlatformSection />
      <HowItWorksSection />
      <SecurityTypesSection />
      <FeaturesGrid />
      <ComparisonSection />
      <TestimonialsSection />
      <RoadmapSection />
      <PricingSection />
      <CTASection />
    </main>
    <FooterSection />
  </>
);

export default Index;
