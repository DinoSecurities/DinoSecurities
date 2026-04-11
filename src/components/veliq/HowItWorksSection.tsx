import { motion } from "framer-motion";
import { FileText, UserCheck, Zap } from "lucide-react";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Create Series",
    desc: "Issuers define security parameters, upload legal documents to Arweave, and deploy a Token-2022 mint with compliance extensions baked in.",
  },
  {
    icon: UserCheck,
    step: "02",
    title: "KYC Investors",
    desc: "Investors complete identity verification via Jumio or Persona. KYC status is recorded on-chain as a HolderRecord PDA, enabling permissioned transfers.",
  },
  {
    icon: Zap,
    step: "03",
    title: "Atomic Settlement",
    desc: "Securities and payment settle atomically in a single Solana transaction. No escrow, no intermediaries, no counterparty risk. Sub-second finality.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const HowItWorksSection = () => (
  <SectionWrapper>
    <div className="md:p-16 lg:p-20 overflow-hidden flex flex-col bg-secondary/50 border border-border relative items-center justify-center">
      <CornerBrackets />
      <motion.div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center mb-16" {...fadeUp}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-border" />
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
            DinoSecurities / Protocol Flow
          </span>
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <div className="h-px w-8 bg-border" />
        </div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
          HOW IT <span className="text-muted-foreground">WORKS.</span>
        </h2>
      </motion.div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-0 w-full border border-border">
        {steps.map((s, i) => (
          <motion.div
            key={s.step}
            className={`p-8 lg:p-12 flex flex-col ${i < 2 ? "border-b md:border-b-0 md:border-r" : ""} border-border relative group`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.15 }}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-6xl font-extralight text-foreground/10 tracking-tighter">{s.step}</span>
              <s.icon className="text-primary" size={24} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-foreground tracking-tight mb-3">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default HowItWorksSection;
