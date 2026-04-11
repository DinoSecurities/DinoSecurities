import { motion } from "framer-motion";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const PlatformSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="md:p-16 lg:p-20 overflow-hidden flex flex-col border-border border-b p-8 relative gap-10 justify-center min-h-[400px]">
        <CornerBrackets />
        <motion.div className="relative z-10 max-w-5xl" {...fadeUp}>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
              Veliq Architecture / Core.01
            </span>
            <div className="h-px w-12 bg-border" />
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-[6rem] text-foreground leading-[0.85] mb-8 font-light tracking-tight">
            NEURAL <span className="text-muted-foreground">SYNTHE&shy;SIS.</span>
          </h2>

          <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
            Our architecture utilizes deterministic logic gates to bypass conventional latency. Every vector is
            calibrated for absolute structural integrity and optimal throughput.
          </p>
        </motion.div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 relative min-h-[500px]">
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border p-8 md:p-12 lg:p-16 flex flex-col justify-center gap-10">
          {/* Emerald stat */}
          <motion.div
            className="p-6 md:p-8 bg-gradient-to-b from-primary to-primary/90 border border-primary/80 rounded-sm relative group overflow-hidden transition-transform duration-300 hover:-translate-y-1 cursor-default"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 24px rgba(16,185,129,0.15)" }}
            {...fadeUp}
          >
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-primary-foreground/70 font-semibold">
                Execution Latency
              </span>
              <h3 className="text-5xl font-medium text-primary-foreground tracking-tight mt-1">
                0.02 <span className="text-2xl font-normal text-primary-foreground/80 ml-1">ms</span>
              </h3>
              <p className="text-xs text-primary-foreground mt-3 font-medium max-w-[220px] leading-relaxed">
                Zero-point optimization achieved through strict hardwired routing protocols.
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
                System Coherence
              </span>
              <h3 className="text-5xl font-medium text-foreground tracking-tight mt-1">
                99.9 <span className="text-2xl font-normal text-muted-foreground ml-1">%</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-3 font-medium max-w-[220px] leading-relaxed">
                End-to-end coherence measured across distributed fault-tolerant mesh clusters.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right panel - Interactive visualization placeholder */}
        <div className="lg:col-span-8 p-8 md:p-12 flex flex-col gap-10">
          <motion.div {...fadeUp} transition={{ duration: 0.8, delay: 0.2 }}>
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
                Veliq Telemetry / Live.02
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
              LIVE <span className="text-muted-foreground">COGNITION.</span>
            </h2>

            <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed mb-12">
              Observe real-time node utilization, cross-cluster latency, and dynamic load distribution across our
              zero-trust edge compute infrastructure.
            </p>

            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Diagnostics Mode</span>
              <div className="w-12 h-6 rounded-full bg-primary/20 border border-primary/50 relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-primary rounded-full shadow-[0_0_8px] shadow-primary" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-foreground">
                Live Telemetry <span className="text-primary ml-1">Active</span>
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
                  Core Simulation // Active
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
                    SYS_LOAD
                  </span>
                </div>
                <div>
                  <div className="text-5xl font-semibold tracking-tighter text-foreground mb-1">99.8%</div>
                  <div className="text-xs font-medium text-primary-foreground/70">Processing Node Utilization</div>
                </div>
              </motion.div>

              <motion.div
                className="flex-1 bg-foreground/90 p-8 flex flex-col justify-between relative overflow-hidden group"
                {...fadeUp}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-2xl text-background">◆</span>
                  <span className="text-xs font-semibold tracking-widest text-background/50 uppercase">
                    SYNC_RATE
                  </span>
                </div>
                <div>
                  <div className="text-5xl font-semibold tracking-tighter text-background mb-1">2ms</div>
                  <div className="text-xs font-medium text-background/60">Cross-cluster Latency</div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </SectionWrapper>
);

export default PlatformSection;
