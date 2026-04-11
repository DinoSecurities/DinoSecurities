import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const CTASection = () => (
  <SectionWrapper>
    <div className="md:p-16 lg:p-24 overflow-hidden flex flex-col text-center bg-gradient-to-b from-secondary/80 to-background border border-border relative items-center justify-center">
      <CornerBrackets />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--veliq-emerald)_/_0.08)_0%,transparent_60%)] pointer-events-none z-0" />

      <motion.div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center p-8" {...fadeUp}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-border" />
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
            DinoSecurities / Get Started
          </span>
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <div className="h-px w-8 bg-border" />
        </div>

        <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
          BUILD THE <span className="text-muted-foreground">FUTURE.</span>
        </h2>

        <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed mb-12">
          Join the next generation of capital markets infrastructure. Issue, trade, and govern tokenized securities
          on Solana with institutional-grade compliance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <button
            className="w-full sm:w-auto px-8 py-4 bg-foreground text-[10px] uppercase tracking-widest text-background font-semibold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 20px rgba(255,255,255,0.1)" }}
          >
            Launch App
            <ArrowRight size={14} />
          </button>
          <button className="w-full sm:w-auto px-8 py-4 border border-border text-[10px] uppercase tracking-widest text-foreground font-semibold hover:bg-secondary hover:border-foreground/30 transition-all duration-300 backdrop-blur-sm flex items-center justify-center gap-2 group">
            <Terminal size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            Read Documentation
          </button>
        </div>
      </motion.div>
    </div>
  </SectionWrapper>
);

export default CTASection;
