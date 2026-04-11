import { ArrowRight, Cpu } from "lucide-react";
import BeamLines from "./BeamLines";

const footerLinks = {
  Platform: ["Architecture", "Compute Nodes", "Benchmarks", "Pricing Tiers", "Ecosystem", "Security Protocol", "Core Research"],
  Developers: ["API Reference", "Documentation", "System Status", "SLA & Terms"],
  Network: ["X / Twitter", "GitHub", "Discord"],
};

const FooterSection = () => (
  <footer className="w-full max-w-7xl mx-auto border-b border-border relative z-10 bg-background/90 backdrop-blur-sm">
    <div
      className="overflow-hidden md:px-12 w-full border-t border-border pt-24 px-6 pb-8 relative"
      style={{
        backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 12px)",
      }}
    >
      <BeamLines />

      {/* Giant brand text */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full text-center z-0 pointer-events-none select-none">
        <h1
          className="text-[20vw] leading-[0.75] tracking-tighter font-light text-transparent bg-clip-text opacity-40"
          style={{ backgroundImage: "linear-gradient(to bottom, rgba(16,185,129,0.4) 0%, rgba(16,185,129,0.01) 100%)" }}
        >
          Veliq AI
        </h1>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col xl:flex-row justify-between gap-20 xl:gap-8 mb-40">
        {/* Newsletter */}
        <div className="w-full max-w-md relative p-8 bg-secondary border border-border"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 16px rgba(0,0,0,0.4)" }}>
          <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-primary/40" />

          <div className="flex items-center gap-4 mb-6">
            <span className="w-1.5 h-1.5 bg-primary shadow-[0_0_12px] shadow-primary" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-[0.2em] uppercase">
              Comms / Sync
            </span>
          </div>

          <h2 className="text-3xl font-light text-foreground mb-8 tracking-tight">Initialize updates</h2>

          <div className="flex flex-col gap-3">
            <div className="flex items-center bg-background border border-border p-1">
              <input
                type="email"
                placeholder="ENTER_EMAIL"
                className="bg-transparent font-mono text-xs uppercase tracking-widest text-foreground px-4 py-3 w-full focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <button className="bg-foreground hover:opacity-90 text-background transition-colors duration-300 text-xs font-mono uppercase tracking-widest px-6 py-3.5 whitespace-nowrap font-semibold flex items-center justify-center gap-2 w-full">
              Establish Link
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Link columns */}
        <div className="flex flex-row flex-wrap sm:flex-nowrap gap-16 sm:gap-24 lg:gap-32 mt-8 xl:mt-0">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="flex flex-col gap-4">
              <span className="text-[10px] font-mono text-muted-foreground tracking-[0.2em] uppercase mb-2 border-b border-border pb-3">
                {category}
              </span>
              {links.map((link) => (
                <a key={link} href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="z-10 flex flex-col md:flex-row gap-6 w-full max-w-7xl border-t border-border mx-auto pt-8 relative items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest uppercase">
          <span className="text-foreground/60">© 2026, Veliq AI.</span>
          <div className="w-1 h-1 bg-foreground/20" />
          <span className="text-muted-foreground">Engineered by Core Research.</span>
        </div>

        <a href="#" className="flex items-center gap-3 text-[10px] font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors group">
          Powered by Neural Engine
          <div className="w-6 h-6 border border-border flex items-center justify-center text-foreground/50 group-hover:border-primary/50 group-hover:text-primary transition-colors bg-secondary">
            <Cpu size={12} />
          </div>
        </a>
      </div>
    </div>
  </footer>
);

export default FooterSection;
