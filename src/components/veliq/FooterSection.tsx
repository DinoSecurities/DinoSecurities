import { useState } from "react";
import { ArrowRight, Shield, Check, X } from "lucide-react";
import BeamLines from "./BeamLines";
import PaymentBadges from "@/components/PaymentBadges";

const footerLinks = {
  Platform: [
    { label: "Marketplace", href: "/app/marketplace" },
    { label: "Portfolio", href: "/app/portfolio" },
    { label: "Settlement", href: "/app/settlement" },
    { label: "Governance", href: "/app/governance" },
    { label: "KYC", href: "/app/settings" },
    { label: "Documentation", href: "https://github.com/DinoSecurities/DinoSecurities", external: true },
  ],
  Company: [
    { label: "About", href: "/#about" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Security Types", href: "/#securities" },
    { label: "Roadmap", href: "/#roadmap" },
    { label: "Pricing", href: "/#pricing" },
  ],
  Network: [
    { label: "X / Twitter", href: "https://x.com/SecuritiesDino", external: true },
    { label: "Telegram", href: "#", external: true },
    { label: "GitHub", href: "https://github.com/DinoSecurities/DinoSecurities", external: true },
  ],
};

const FooterSection = () => {
  const [email, setEmail] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setShowToast(true);
    setEmail("");
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
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
          className="text-[15vw] leading-[0.75] tracking-tighter font-light text-transparent bg-clip-text opacity-40"
          style={{ backgroundImage: "linear-gradient(to bottom, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0.01) 100%)" }}
        >
          DinoSecurities
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
              Updates / Subscribe
            </span>
          </div>

          <h2 className="text-3xl font-light text-foreground mb-8 tracking-tight">Stay Updated</h2>

          <div className="flex flex-col gap-3">
            <div>
              <div className={`flex items-center bg-background border p-1 ${error ? "border-red-500/60" : "border-border"}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                  placeholder="ENTER_EMAIL"
                  className="bg-transparent font-mono text-xs uppercase tracking-widest text-foreground px-4 py-3 w-full focus:outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              {error && <p className="text-xs text-red-400 mt-2 font-mono">{error}</p>}
            </div>
            <button
              onClick={handleSubscribe}
              className="bg-foreground hover:opacity-90 text-background transition-colors duration-300 text-xs font-mono uppercase tracking-widest px-6 py-3.5 whitespace-nowrap font-semibold flex items-center justify-center gap-2 w-full cursor-pointer"
            >
              Subscribe
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
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Accepted payments */}
      <div className="relative z-10 w-full max-w-7xl mx-auto border-t border-border pt-8 pb-6">
        <PaymentBadges />
      </div>

      {/* Bottom bar */}
      <div className="z-10 flex flex-col md:flex-row gap-6 w-full max-w-7xl border-t border-border mx-auto pt-8 relative items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest uppercase">
          <span className="text-foreground/60">© 2026, DinoSecurities.</span>
          <div className="w-1 h-1 bg-foreground/20" />
          <span className="text-muted-foreground">Built on Solana.</span>
        </div>

        <a href="#" className="flex items-center gap-3 text-[10px] font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors group">
          Powered by Solana
          <div className="w-6 h-6 border border-border flex items-center justify-center text-foreground/50 group-hover:border-primary/50 group-hover:text-primary transition-colors bg-secondary">
            <Shield size={12} />
          </div>
        </a>
      </div>
    </div>

    {/* Subscribe toast */}
    {showToast && (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-card border border-primary/30 shadow-2xl p-5 flex items-start gap-4 max-w-sm"
          style={{ boxShadow: "0 8px 32px rgba(139,92,246,0.2)" }}>
          <div className="w-10 h-10 bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
            <Check size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Thank you for subscribing!</div>
            <div className="text-xs text-muted-foreground mt-1">
              You'll be the first to know about new securities, governance updates, and platform launches.
            </div>
          </div>
          <button onClick={() => setShowToast(false)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )}
  </footer>
  );
};

export default FooterSection;
