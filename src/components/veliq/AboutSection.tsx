import { motion } from "framer-motion";
import { Shield, Link2, Scale } from "lucide-react";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const AboutSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      <div className="md:p-16 lg:p-20 overflow-hidden flex flex-col border-border border-b p-8 relative gap-10 justify-center min-h-[400px]">
        <CornerBrackets />
        <motion.div className="relative z-10 max-w-5xl" {...fadeUp}>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
              About / DinoSecurities
            </span>
            <div className="h-px w-12 bg-border" />
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-[6rem] text-foreground leading-[0.85] mb-8 font-light tracking-tight">
            WHAT IS <span className="text-muted-foreground">DINO.</span>
          </h2>

          <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            DinoSecurities is a Solana-native tokenized securities platform that enables the issuance,
            management, trading, and governance of legally enforceable security tokens. Tokens represent
            real equity, debt, fund interests, or LLC memberships — with compliance logic baked into
            the token layer itself.
          </p>
        </motion.div>
      </div>

      {/* Ricardian Heritage + Key Principles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {[
          {
            icon: Link2,
            title: "Ricardian Contracts",
            desc: "Every token is cryptographically linked to its governing legal document via SHA-256 hash stored immutably on-chain. The act of minting constitutes acceptance of the document's terms.",
          },
          {
            icon: Shield,
            title: "On-Chain Compliance",
            desc: "Transfer restrictions for Reg D, Reg S, Reg CF, and Reg A+ are enforced at the token level via Solana's Token-2022 transfer hooks — not backend middleware.",
          },
          {
            icon: Scale,
            title: "Legal Enforceability",
            desc: "Inheriting from LexDAO's Ricardian LLC on Ethereum, every security token is simultaneously a legal instrument and a programmable digital asset.",
          },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            className={`relative p-10 ${i < 2 ? "border-b lg:border-b-0 lg:border-r" : ""} border-border group hover:bg-secondary/50 transition-colors duration-500`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          >
            <item.icon className="text-foreground/70 mb-6" size={24} strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-foreground tracking-tight mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default AboutSection;
