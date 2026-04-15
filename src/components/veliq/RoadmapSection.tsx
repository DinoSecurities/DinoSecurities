import { motion } from "framer-motion";
import SectionWrapper from "./SectionWrapper";
import CornerBrackets from "./CornerBrackets";

const phases = [
  { phase: "Phase 1", title: "Foundation", weeks: "Weeks 1–4", desc: "Anchor workspace, dino_core program skeleton, account structures, platform initialization, issuer registration, security series creation.", status: "complete" },
  { phase: "Phase 2", title: "Token-2022", weeks: "Weeks 5–8", desc: "Multi-extension mint creation, transfer hook program, holder registration, compliant minting, force transfer via Permanent Delegate.", status: "complete" },
  { phase: "Phase 3", title: "Settlement", weeks: "Weeks 9–10", desc: "DinoSettlementEngine, atomic DvP swap, split token-program support for classic SPL payment mints, settlement agent self-heal ATAs.", status: "complete" },
  { phase: "Phase 4", title: "Frontend", weeks: "Weeks 11–16", desc: "React + Vite + Tailwind scaffold, wallet adapter, landing page, issuer portal, marketplace, portfolio, settings + KYC flow.", status: "complete" },
  { phase: "Phase 5", title: "Infrastructure", weeks: "Weeks 17–20", desc: "Helius RPC + webhooks, Didit KYC oracle, Arweave document pipeline, Token-2022 metadata writes, DigitalOcean backend + Supabase indexer.", status: "complete" },
  { phase: "Phase 6", title: "Mainnet Launch", weeks: "Weeks 21–22", desc: "Three Anchor programs deployed on mainnet-beta, platform initialized, Reg D accreditation + Reg S geo-fence enforced on-chain, end-to-end DvP with real USDC verified.", status: "complete" },
  { phase: "Phase 7", title: "Trust Signals", weeks: "Next", desc: "Click-to-verify landing-page stats linking to real mainnet txs, client-side Ricardian document hash verifier, and a public pre-trade compliance simulator anyone can run without a wallet.", status: "active" },
  { phase: "Phase 8", title: "Demonstration", weeks: "Upcoming", desc: "Live mainnet settlement ticker on the landing page and anonymized per-series holder geography heatmap for issuer dashboards.", status: "upcoming" },
  { phase: "Phase 9", title: "Governance", weeks: "Upcoming", desc: "dino_governance UI — per-series realms, proposal creation, token-weighted voting, and timelock-enforced execution for UpdateLegalDoc, MintAdditional, FreezeHolder, EmergencyPause, and TreasuryTransfer proposals.", status: "upcoming" },
  { phase: "Phase 10", title: "Distribution", weeks: "Upcoming", desc: "Automatic Rule 10b-10-style trade-confirmation PDF receipts after every settlement, plus an embeddable iframe widget so issuers can surface their series on their own corporate websites.", status: "upcoming" },
  { phase: "Phase 11", title: "Ecosystem", weeks: "Upcoming", desc: "Soulbound investor-passport NFT minted after KYC, making DinoSecurities a verification source for the rest of the Solana RWA ecosystem. Holding-period enforcement via HolderExt PDAs.", status: "upcoming" },
  { phase: "Phase 12", title: "Hardening", weeks: "Ongoing", desc: "Third-party security audit (OtterSec / Trail of Bits / Halborn), Squads multisig transfer of program upgrade authority, securities counsel review, insurance procurement, Blowfish/Phantom reputation submission.", status: "upcoming" },
];

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8 },
};

const RoadmapSection = () => (
  <SectionWrapper>
    <div className="flex flex-col gap-10">
      <div className="md:p-16 lg:p-20 overflow-hidden flex flex-col bg-secondary/50 border border-border relative items-center justify-center">
        <CornerBrackets />
        <motion.div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center" {...fadeUp}>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-8 bg-border" />
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase">
              DinoSecurities / Build Phases
            </span>
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <div className="h-px w-8 bg-border" />
          </div>
          <h2 className="text-4xl md:text-6xl lg:text-7xl text-foreground leading-[0.85] mb-6 font-light tracking-tight">
            ROAD<span className="text-muted-foreground">MAP.</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
            From on-chain program foundation through mainnet launch and into the next wave of trust-signal, distribution, and ecosystem work.
          </p>
        </motion.div>
      </div>

      {/* Timeline */}
      <div className="relative border border-border">
        {phases.map((p, i) => (
          <motion.div
            key={p.phase}
            className={`flex flex-col md:flex-row ${i < phases.length - 1 ? "border-b" : ""} border-border group hover:bg-secondary/30 transition-colors duration-500`}
            {...fadeUp}
            transition={{ duration: 0.8, delay: i * 0.08 }}
          >
            {/* Left: phase info */}
            <div className="w-full md:w-64 p-6 md:p-8 flex flex-col gap-2 md:border-r border-border shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    p.status === "complete"
                      ? "bg-primary shadow-[0_0_8px] shadow-primary"
                      : p.status === "active"
                      ? "bg-primary animate-pulse shadow-[0_0_12px] shadow-primary"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {p.phase}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">{p.title}</h3>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{p.weeks}</span>
            </div>

            {/* Right: description */}
            <div className="flex-1 p-6 md:p-8 flex items-center">
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default RoadmapSection;
