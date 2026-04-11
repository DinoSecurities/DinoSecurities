import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const tiers = [
  {
    label: "Node / Foundation",
    price: "$0",
    period: "/mo",
    desc: "Elementary access for initial prototyping and neural calibration sequences.",
    features: ["64 Core Threads", "100GB Matrix Storage", "Community Channels"],
    cta: "Initialize Node",
    variant: "dark" as const,
  },
  {
    label: "Cluster / Pro",
    price: "$249",
    period: "/mo",
    desc: "Full cluster deployment with live telemetry and priority routing across all edge nodes.",
    features: ["1024 Core Threads", "5TB Matrix Storage", "Live Telemetry Channels"],
    cta: "Deploy Cluster",
    variant: "emerald" as const,
  },
  {
    label: "Matrix / Enterprise",
    price: "Custom",
    period: "",
    desc: "Absolute structural integrity for hyper-scale operations with dedicated bridging.",
    features: ["Unlimited Threading", "Infinite Cloud Storage", "Direct Command Access"],
    cta: "Contact Command",
    variant: "dark" as const,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const PricingSection = () => (
  <SectionWrapper>
    <div className="w-full flex flex-col gap-12">
      {/* Header */}
      <div className="md:p-12 lg:p-16 overflow-hidden flex flex-col bg-secondary/50 border border-border relative items-center justify-center">
        <CornerBrackets />
        <motion.div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center" {...fadeUp}>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-8 bg-border" />
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
              Veliq Network / Allocation
            </span>
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <div className="h-px w-8 bg-border" />
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
            RESOURCE <span className="text-muted-foreground">ALLOCATION.</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
            Select a computational tier. Each level unlocks progressively deeper system access and raw processing
            throughput.
          </p>
        </motion.div>
      </div>

      {/* Pricing cards */}
      <div className="flex flex-col lg:flex-row border border-border">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.label}
            className={`flex-1 p-8 lg:p-12 flex flex-col ${
              i < 2 ? "border-b lg:border-b-0 lg:border-r" : ""
            } border-border ${
              tier.variant === "emerald"
                ? "bg-gradient-to-b from-primary to-primary/90"
                : "bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]"
            } group transition-colors duration-500 overflow-hidden relative`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.15 }}
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                <span
                  className={`text-[10px] font-medium tracking-widest uppercase ${
                    tier.variant === "emerald" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {tier.label}
                </span>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    className={`text-5xl md:text-6xl font-light tracking-tight ${
                      tier.variant === "emerald" ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className={tier.variant === "emerald" ? "text-primary-foreground/70" : "text-muted-foreground"}>
                      {tier.period}
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs mt-4 leading-relaxed ${
                    tier.variant === "emerald" ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {tier.desc}
                </p>
              </div>

              <div className="flex-1 mb-10">
                <ul className="flex flex-col gap-4">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-3 text-sm ${
                        tier.variant === "emerald" ? "text-primary-foreground font-medium" : "text-foreground/80"
                      }`}
                    >
                      <Check
                        size={16}
                        className={`mt-0.5 ${tier.variant === "emerald" ? "text-primary-foreground/80" : "text-primary"}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={`w-full py-4 text-[10px] uppercase tracking-widest font-semibold transition-all duration-300 mt-auto ${
                  tier.variant === "emerald"
                    ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    : i === 2
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default PricingSection;
