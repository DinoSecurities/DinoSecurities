import { motion } from "framer-motion";
import { Landmark, Vote, Zap, ShieldCheck, Coins, Globe } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Transfer Hooks",
    desc: "Compliance logic enforced at the token level via Solana Token-2022 transfer hooks. Every transfer is validated against KYC, jurisdiction, and regulation requirements.",
  },
  {
    icon: Zap,
    title: "Atomic DvP",
    desc: "Delivery vs Payment in a single transaction. Securities and cash settle simultaneously — sub-second, under $0.01 cost, zero counterparty risk.",
  },
  {
    icon: Vote,
    title: "On-Chain Governance",
    desc: "Token-weighted DAO voting for each security series via SPL Governance (Realms). Proposals, quorum, and timelocks enforced on-chain.",
  },
  {
    icon: Coins,
    title: "DeFi Composability",
    desc: "Security tokens tradeable on Jupiter, lendable on Marginfi, listable on Tensor and Magic Eden. Full Solana DeFi ecosystem access.",
  },
  {
    icon: Landmark,
    title: "Institutional Grade",
    desc: "KYC/AML integration, permanent delegate for regulatory clawback, multisig admin controls, and comprehensive audit trails.",
  },
  {
    icon: Globe,
    title: "Multi-Jurisdiction",
    desc: "Support for Reg D, Reg S, Reg CF, and Reg A+ with per-jurisdiction transfer restriction enforcement baked into every token.",
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
        className={`relative p-10 ${i < 3 ? "border-b" : ""} ${i % 3 !== 2 ? "md:border-r" : ""} border-border group hover:bg-secondary/50 transition-colors duration-500`}
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
