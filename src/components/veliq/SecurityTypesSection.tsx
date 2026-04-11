import { motion } from "framer-motion";
import { Building2, Banknote, PiggyBank, Users } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const types = [
  {
    icon: Building2,
    name: "Equity",
    desc: "Tokenized shares representing ownership in companies. Cap table management, dividend distributions, and voting rights — all on-chain.",
    regs: ["Reg D", "Reg A+"],
    variant: "dark" as const,
  },
  {
    icon: Banknote,
    name: "Debt",
    desc: "Interest-bearing security tokens leveraging Token-2022's interest-bearing extension. Automated yield accrual with transparent on-chain terms.",
    regs: ["Reg D", "Reg S"],
    variant: "purple" as const,
  },
  {
    icon: PiggyBank,
    name: "Fund Interests",
    desc: "Tokenized LP positions and fund shares. NAV calculations via Pyth price oracle, automated redemption windows, and compliant secondary trading.",
    regs: ["Reg D", "Reg CF"],
    variant: "dark" as const,
  },
  {
    icon: Users,
    name: "LLC Membership",
    desc: "Ricardian LLC membership tokens inheriting from LexDAO's architecture. Legally binding membership agreements hashed and stored on Arweave.",
    regs: ["Ricardian"],
    variant: "dark" as const,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const SecurityTypesSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      <motion.div className="text-center mb-8" {...fadeUp}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-border" />
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
            DinoSecurities / Asset Classes
          </span>
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <div className="h-px w-8 bg-border" />
        </div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
          SECURITY <span className="text-muted-foreground">TYPES.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border">
        {types.map((t, i) => (
          <motion.div
            key={t.name}
            className={`p-8 lg:p-12 flex flex-col ${
              i < 2 ? "border-b" : ""
            } ${i % 2 === 0 ? "md:border-r" : ""} border-border ${
              t.variant === "purple"
                ? "bg-gradient-to-b from-primary to-primary/90"
                : "bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]"
            } group transition-colors duration-500 overflow-hidden relative`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          >
            <div className="relative z-10 flex flex-col h-full">
              <t.icon
                className={`mb-6 ${t.variant === "purple" ? "text-primary-foreground/80" : "text-foreground/70"}`}
                size={28}
                strokeWidth={1.5}
              />
              <h3 className={`text-2xl font-semibold tracking-tight mb-3 ${t.variant === "purple" ? "text-primary-foreground" : "text-foreground"}`}>
                {t.name}
              </h3>
              <p className={`text-sm leading-relaxed mb-6 ${t.variant === "purple" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {t.desc}
              </p>
              <div className="flex gap-2 mt-auto">
                {t.regs.map((reg) => (
                  <span
                    key={reg}
                    className={`text-[10px] uppercase tracking-widest font-semibold px-3 py-1 border ${
                      t.variant === "purple"
                        ? "border-primary-foreground/30 text-primary-foreground/80"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {reg}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default SecurityTypesSection;
