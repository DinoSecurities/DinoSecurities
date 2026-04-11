import { motion } from "framer-motion";
import SectionWrapper from "./SectionWrapper";

const rows = [
  { metric: "Settlement Time", traditional: "T+2 (2 days)", dino: "< 1 second" },
  { metric: "Transaction Cost", traditional: "$5 – $200", dino: "< $0.01" },
  { metric: "Finality", traditional: "15 min – 2 days", dino: "400ms" },
  { metric: "Counterparty Risk", traditional: "High (custodians)", dino: "Zero (atomic)" },
  { metric: "Compliance", traditional: "Backend middleware", dino: "On-chain hooks" },
  { metric: "Trading Hours", traditional: "9:30am – 4pm ET", dino: "24/7/365" },
  { metric: "Minimum Investment", traditional: "$10,000+", dino: "Fractional (any)" },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const ComparisonSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      <motion.div className="text-center mb-4" {...fadeUp}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-border" />
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
            DinoSecurities / vs Traditional
          </span>
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <div className="h-px w-8 bg-border" />
        </div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
          WHY <span className="text-muted-foreground">ON-CHAIN.</span>
        </h2>
      </motion.div>

      <motion.div className="border border-border overflow-hidden" {...fadeUp} transition={{ duration: 0.8, delay: 0.2 }}>
        {/* Header */}
        <div className="grid grid-cols-3 border-b border-border bg-secondary/50">
          <div className="p-4 md:p-6 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Metric</div>
          <div className="p-4 md:p-6 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground border-l border-border">Traditional</div>
          <div className="p-4 md:p-6 text-[10px] uppercase tracking-widest font-semibold text-primary border-l border-border">DinoSecurities</div>
        </div>
        {rows.map((row, i) => (
          <div key={row.metric} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b" : ""} border-border group hover:bg-secondary/30 transition-colors`}>
            <div className="p-4 md:p-6 text-sm font-medium text-foreground">{row.metric}</div>
            <div className="p-4 md:p-6 text-sm text-muted-foreground border-l border-border">{row.traditional}</div>
            <div className="p-4 md:p-6 text-sm text-primary font-semibold border-l border-border">{row.dino}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </SectionWrapper>
);

export default ComparisonSection;
