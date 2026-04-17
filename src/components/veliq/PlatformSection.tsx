import { motion } from "framer-motion";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";
import ClickToVerifyStat from "@/components/ClickToVerifyStat";
import { useRecentSettlements } from "@/hooks/useRecentSettlements";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const PlatformSection = () => {
  const { data } = useRecentSettlements(5);
  const latest = data?.items?.[0];
  const avgFinalityMs = data?.aggregates?.avgFinalityMs;
  const total = data?.aggregates?.totalSettlements ?? 0;

  // Fall back to a plausible static number when we have no sample yet.
  const finalityValue = latest?.finalityMs
    ? latest.finalityMs < 1000
      ? `${Math.round(latest.finalityMs)}ms`
      : `${(latest.finalityMs / 1000).toFixed(1)}s`
    : avgFinalityMs
      ? `${Math.round(avgFinalityMs)}ms`
      : "400ms";

  const finalityCaption = latest?.finalityMs
    ? "Latest mainnet settlement"
    : avgFinalityMs
      ? `Avg over ${data?.aggregates?.samplesWithFinality ?? 0} settlements`
      : "Solana confirmation time";

  const settlementsLabel = total > 0 ? `${total}` : "—";

  return (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="md:p-16 lg:p-20 overflow-hidden flex flex-col border-border border-b p-8 relative gap-10 justify-center min-h-[400px]">
        <CornerBrackets />
        <motion.div className="relative z-10 max-w-5xl" {...fadeUp}>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
              DinoSecurities / Architecture
            </span>
            <div className="h-px w-12 bg-border" />
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-[6rem] text-foreground leading-[0.85] mb-8 font-light tracking-tight">
            ATOMIC <span className="text-muted-foreground">SETTLE&shy;MENT.</span>
          </h2>

          <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
            Delivery vs Payment in a single Solana transaction. Sub-second finality, less than $0.01 cost.
            No intermediaries, no counterparty risk.
          </p>
        </motion.div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 relative min-h-[500px]">
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border p-8 md:p-12 lg:p-16 flex flex-col justify-center gap-10">
          {/* Primary stat */}
          <motion.div
            className="p-6 md:p-8 bg-gradient-to-b from-primary to-primary/90 border border-primary/80 rounded-sm relative group overflow-hidden transition-transform duration-300 hover:-translate-y-1 cursor-default"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 24px rgba(139,92,246,0.15)" }}
            {...fadeUp}
          >
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-primary-foreground/70 font-semibold">
                Settlement Time
              </span>
              <h3 className="text-5xl font-medium text-primary-foreground tracking-tight mt-1">
                {"<1"} <span className="text-2xl font-normal text-primary-foreground/80 ml-1">sec</span>
              </h3>
              <p className="text-xs text-primary-foreground mt-3 font-medium max-w-[220px] leading-relaxed">
                Atomic DvP settlement in a single Solana transaction with 400ms finality.
              </p>
            </div>
          </motion.div>

          {/* Dark stat */}
          <motion.div
            className="p-6 md:p-8 bg-gradient-to-b from-foreground/[0.08] to-foreground/[0.02] border border-border rounded-sm relative group overflow-hidden transition-transform duration-300 hover:-translate-y-1 cursor-default"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 16px rgba(0,0,0,0.4)" }}
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Transaction Cost
              </span>
              <h3 className="text-5xl font-medium text-foreground tracking-tight mt-1">
                {"<$0.01"}
              </h3>
              <p className="text-xs text-muted-foreground mt-3 font-medium max-w-[220px] leading-relaxed">
                Compared to $5-200 per settlement in traditional capital markets infrastructure.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-8 p-8 md:p-12 flex flex-col gap-10">
          <motion.div {...fadeUp} transition={{ duration: 0.8, delay: 0.2 }}>
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
                DvP Engine / Live
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
              SETTLEMENT <span className="text-muted-foreground">ENGINE.</span>
            </h2>

            <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed mb-12">
              Watch atomic Delivery vs Payment execution in real-time. Securities and payment settle simultaneously
              in a single on-chain transaction — eliminating counterparty risk entirely.
            </p>

            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Settlement Mode</span>
              <div className="w-12 h-6 rounded-full bg-primary/20 border border-primary/50 relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-primary rounded-full shadow-[0_0_8px] shadow-primary" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-foreground">
                Atomic DvP <span className="text-primary ml-1">Active</span>
              </span>
            </div>
          </motion.div>

          {/* Visualization panels */}
          <div className="relative border border-border/80 bg-secondary/40 p-1 flex flex-col lg:flex-row gap-1">
            <motion.div
              className="flex-1 min-h-[400px] flex overflow-hidden bg-background relative items-center justify-center"
              {...fadeUp}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              {/* Animated geometric shape */}
              <div className="relative w-48 h-48">
                <motion.div
                  className="absolute inset-0 border border-primary/30"
                  style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-4 border border-primary/50"
                  style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-8 bg-primary/10 border border-primary/70"
                  style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_20px] shadow-primary animate-pulse" />
                </div>
              </div>

              {/* Corner markers */}
              <div className="absolute top-4 left-4 w-2 h-2 border-t border-l border-muted-foreground z-20" />
              <div className="absolute top-4 right-4 w-2 h-2 border-t border-r border-muted-foreground z-20" />
              <div className="absolute bottom-4 left-4 w-2 h-2 border-b border-l border-muted-foreground z-20" />
              <div className="absolute bottom-4 right-4 w-2 h-2 border-b border-r border-muted-foreground z-20" />

              <div className="absolute bottom-8 left-8 z-20 flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 border border-border rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px] shadow-primary" />
                <span className="text-[10px] font-medium tracking-widest uppercase text-primary">
                  DvP Settlement // Live
                </span>
              </div>
            </motion.div>

            {/* Right accent panels */}
            <div className="w-full lg:w-80 flex flex-col gap-1">
              <motion.div
                className="flex-1 bg-primary p-8 flex flex-col justify-between relative overflow-hidden group"
                {...fadeUp}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-2xl">⬡</span>
                  <span className="text-xs font-semibold tracking-widest text-primary-foreground/70 uppercase">
                    FINALITY
                  </span>
                </div>
                <ClickToVerifyStat
                  value={finalityValue}
                  label={latest?.finalityMs ? "Wall-clock order → settled" : "Solana confirmation time"}
                  caption={finalityCaption}
                  signature={latest?.signature}
                  variant="light"
                />
              </motion.div>

              <motion.div
                className="flex-1 bg-foreground/90 p-8 flex flex-col justify-between relative overflow-hidden group"
                {...fadeUp}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-2xl text-background">◆</span>
                  <span className="text-xs font-semibold tracking-widest text-background/50 uppercase">
                    SETTLED
                  </span>
                </div>
                <ClickToVerifyStat
                  value={settlementsLabel}
                  label="Atomic DvP settlements on mainnet"
                  caption={total > 0 ? "Every one verifiable on-chain" : "Awaiting first settlement"}
                  signature={latest?.signature}
                  variant="dark"
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  </SectionWrapper>
  );
};

export default PlatformSection;
