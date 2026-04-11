import Navbar from "@/components/veliq/Navbar";
import FramingLines from "@/components/veliq/FramingLines";
import HeroSection from "@/components/veliq/HeroSection";
import PlatformSection from "@/components/veliq/PlatformSection";
import FeaturesGrid from "@/components/veliq/FeaturesGrid";
import TestimonialsSection from "@/components/veliq/TestimonialsSection";
import PricingSection from "@/components/veliq/PricingSection";
import CTASection from "@/components/veliq/CTASection";
import FooterSection from "@/components/veliq/FooterSection";

const Index = () => (
  <>
    <Navbar />
    <FramingLines />
    <main className="z-10 flex flex-col w-full relative items-center">
      <HeroSection />
      <PlatformSection />
      <FeaturesGrid />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
    </main>
    <FooterSection />
  </>
);

export default Index;
