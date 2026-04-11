import { motion } from "framer-motion";
import { Database, Layers, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Distributed Mesh",
    desc: "Zero-point fault routing across multi-region nodes with sub-millisecond failover and automated state reconciliation.",
  },
  {
    icon: Layers,
    title: "Log Consolidation",
    desc: "Consume scattered log artifacts into a strictly parsed, singular data structure. Reveal truth through raw metric convergence.",
  },
  {
    icon: ShieldCheck,
    title: "Identity Engine",
    desc: "Cryptographic identity verification at every compute boundary. Zero-knowledge proofs ensure absolute data sovereignty.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const FeaturesGrid = () => (
  <section className="relative grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-border max-w-7xl mx-auto">
    {features.map((f, i) => (
      <motion.div
        key={f.title}
        className={`relative p-10 ${i < 2 ? "border-b md:border-b-0 md:border-r" : ""} border-border group hover:bg-secondary/50 transition-colors duration-500`}
        {...fadeUp}
        transition={{ duration: 0.8, delay: i * 0.1 }}
      >
        <f.icon className="text-foreground/70 mb-6" size={24} strokeWidth={1.5} />
        <h3 className="text-lg font-semibold text-foreground tracking-tight mb-3">{f.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed font-medium">{f.desc}</p>
      </motion.div>
    ))}
  </section>
);

export default FeaturesGrid;
