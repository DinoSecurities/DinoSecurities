import { motion } from "framer-motion";
import { Star } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const testimonials = [
  {
    quote: "DinoSecurities eliminated our T+2 settlement delay entirely. Atomic DvP on Solana means we close deals in under a second.",
    name: "Elena Vasquez",
    role: "VP Capital Markets, Nexus Partners",
    stars: 5,
    variant: "dark" as const,
  },
  {
    quote: "On-chain compliance via transfer hooks means we don't need middleware for Reg D restrictions. It's enforced at the token layer.",
    name: "Marcus Chen",
    role: "Head of Compliance, Digital Asset Fund",
    stars: 5,
    variant: "purple" as const,
  },
  {
    quote: "The Ricardian contract model gives our investors confidence. Every token is cryptographically linked to its legal document.",
    name: "Sarah Jenkins",
    role: "General Counsel, Blockchain Ventures",
    stars: 5,
    variant: "dark" as const,
  },
  {
    quote: "We tokenized our entire fund on DinoSecurities. LP positions, NAV tracking, and redemption — all on-chain with Solana speed.",
    name: "David Park",
    role: "CTO, Meridian Capital",
    stars: 5,
    variant: "dark" as const,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const TestimonialsSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      <motion.div className="text-center mb-8" {...fadeUp}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-border" />
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
            DinoSecurities / Testimonials
          </span>
          <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
          <div className="h-px w-8 bg-border" />
        </div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
          SIGNAL <span className="text-muted-foreground">LOG.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            className={`${i === 0 ? "md:col-span-7" : i === 1 ? "md:col-span-5" : i === 2 ? "md:col-span-5" : "md:col-span-7"} ${
              i < 2 ? "border-b" : ""
            } ${i % 2 === 0 ? "md:border-r" : ""} border-border p-8 lg:p-12 flex flex-col ${
              t.variant === "purple"
                ? "bg-gradient-to-b from-primary to-primary/90"
                : i === 3
                ? "bg-background"
                : "bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]"
            } group transition-colors duration-500 overflow-hidden relative`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                  <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
                    Log / {String(i + 1).padStart(3, "0")}
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <Star
                        key={s}
                        size={14}
                        fill="currentColor"
                        className={t.variant === "purple" ? "text-primary-foreground" : "text-primary"}
                      />
                    ))}
                  </div>
                </div>
                <p
                  className={`text-lg md:text-xl leading-relaxed tracking-tight mb-10 ${
                    t.variant === "purple"
                      ? "font-medium text-primary-foreground"
                      : i === 3
                      ? "font-light text-foreground"
                      : "font-light text-foreground/80"
                  }`}
                >
                  "{t.quote}"
                </p>
              </div>

              <div className={`flex items-center gap-4 pt-6 border-t ${t.variant === "purple" ? "border-primary-foreground/20" : "border-border"} mt-auto`}>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${t.variant === "purple" ? "text-primary-foreground" : "text-foreground"}`}>
                    {t.name}
                  </div>
                  <div className={`text-[10px] uppercase tracking-widest mt-0.5 ${t.variant === "purple" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default TestimonialsSection;
