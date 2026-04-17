import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Zap, Lock, Globe } from "lucide-react";

const XRPLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-sm font-bold tracking-wide">DinoSecurities</a>
          <button
            onClick={() => navigate("/app")}
            className="rounded-full bg-foreground px-5 py-1.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-1.5 mb-8">
            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">Now accepting wXRP on Solana</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-tight mb-6">
            Buy tokenized securities
            <br />
            <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
              with XRP.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            DinoSecurities now accepts wXRP (Hex Trust + LayerZero) alongside USDC as payment
            for regulated security tokens on Solana. Atomic settlement, on-chain compliance,
            sub-second finality.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => navigate("/app/settlement")}
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 text-sm font-semibold rounded-full hover:opacity-90"
            >
              Trade with wXRP <ArrowRight size={16} />
            </button>
            <a
              href="https://github.com/DinoSecurities/DinoSecurities"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 text-sm text-muted-foreground rounded-full hover:text-foreground hover:border-foreground/30"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-16 tracking-tight">How wXRP payments work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Bridge XRP to Solana",
                desc: "Use Hex Trust's official wXRP bridge to wrap your native XRP into wXRP (SPL token) on Solana. 1:1 backed, regulated custody.",
              },
              {
                step: "02",
                title: "Place a DvP order",
                desc: "Select wXRP as your payment token in the Settlement tab. Set the security, amount, and price. Your order goes on-chain.",
              },
              {
                step: "03",
                title: "Atomic settlement",
                desc: "When a matching order is found, both legs (security + wXRP) settle in a single Solana transaction. No counterparty risk.",
              },
            ].map((item) => (
              <div key={item.step} className="border border-border p-6 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
                <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{item.step}</span>
                <h3 className="text-sm font-semibold text-foreground mt-3 mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why XRP holders */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-16 tracking-tight">Why XRP holders choose DinoSecurities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Zap,
                title: "Sub-second finality",
                desc: "Solana settles in ~400ms. No T+2. No waiting days for your trade to clear.",
              },
              {
                icon: Lock,
                title: "On-chain compliance",
                desc: "Every transfer is validated by a Token-2022 Transfer Hook. KYC, accreditation, and jurisdiction checks happen at the protocol level.",
              },
              {
                icon: Shield,
                title: "Regulated custody",
                desc: "wXRP is issued by Hex Trust, a licensed digital asset custodian. 1:1 backed, fully redeemable for native XRP.",
              },
              {
                icon: Globe,
                title: "Cross-chain from day one",
                desc: "Built on LayerZero's OFT standard. Your wXRP moves seamlessly between Solana and other supported chains.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-6 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
                <item.icon size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* wXRP details */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10 tracking-tight">wXRP token details</h2>
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] divide-y divide-border">
            {[
              ["Token", "wXRP (Wrapped XRP)"],
              ["Network", "Solana"],
              ["Standard", "SPL Token (LayerZero OFT)"],
              ["Decimals", "6"],
              ["Mint address", "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2"],
              ["Issuer", "Hex Trust (licensed digital asset custodian)"],
              ["Backing", "1:1 native XRP in segregated custody"],
              ["Bridge", "LayerZero Omnichain Fungible Token"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-6 py-4">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
                <span className="text-xs text-foreground font-mono text-right max-w-[60%] truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-4 tracking-tight">Ready to trade with wXRP?</h2>
          <p className="text-muted-foreground mb-8">Connect your Solana wallet and start trading tokenized securities with wXRP today.</p>
          <button
            onClick={() => navigate("/app")}
            className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-3.5 text-sm font-semibold rounded-full hover:opacity-90"
          >
            Launch App <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            DinoSecurities — Powered by Solana
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="https://www.dinosecurities.com" className="hover:text-foreground">Home</a>
            <a href="https://x.com/SecuritiesDino" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Twitter</a>
            <a href="https://github.com/DinoSecurities/DinoSecurities" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default XRPLanding;
