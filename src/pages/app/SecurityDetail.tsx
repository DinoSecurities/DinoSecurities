import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, Copy, Check, FileText, Shield, Users } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { securities } from "@/lib/mockData";

const priceHistory = [
  { date: "W1", price: 10.20 }, { date: "W2", price: 10.80 }, { date: "W3", price: 11.10 },
  { date: "W4", price: 10.90 }, { date: "W5", price: 11.50 }, { date: "W6", price: 11.80 },
  { date: "W7", price: 12.10 }, { date: "W8", price: 11.90 }, { date: "W9", price: 12.30 },
  { date: "W10", price: 12.00 }, { date: "W11", price: 12.20 }, { date: "W12", price: 12.45 },
];

const SecurityDetail = () => {
  const { mint } = useParams();
  const security = securities.find((s) => s.mintAddress === mint) || securities[0];
  const [activeTab, setActiveTab] = useState<"overview" | "holders" | "legal">("overview");
  const [copied, setCopied] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlaceOrder = () => {
    if (!buyAmount || isNaN(Number(buyAmount))) return;
    setOrderPlaced(true);
    setTimeout(() => {
      setOrderPlaced(false);
      setOrderModalOpen(false);
      setBuyAmount("");
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link to="/app/marketplace" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft size={16} /> Back to Marketplace
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 flex items-center justify-center text-lg font-bold border ${
            security.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
            security.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
            security.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
            "bg-purple-500/20 border-purple-500/40 text-purple-400"
          }`}>{security.type[0]}</div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{security.name}</h2>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 font-semibold">{security.status}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{security.symbol}</span>
              <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <span>{security.type}</span>
              <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <span>{security.regulation}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-semibold text-foreground tracking-tight">${security.price.toFixed(2)}</div>
            <div className={`flex items-center gap-1 justify-end text-sm font-semibold ${security.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {security.change24h >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {security.change24h >= 0 ? "+" : ""}{security.change24h}% (24h)
            </div>
          </div>
          <button
            onClick={() => setOrderModalOpen(true)}
            className="bg-foreground text-background px-6 py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all"
          >
            Trade
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["overview", "holders", "legal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-[10px] uppercase tracking-widest font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Price Chart */}
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Price History</span>
              <div className="h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceHistory}>
                    <defs>
                      <linearGradient id="secGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(270,70%,55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(270,70%,55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(0,0%,45%)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(0,0%,45%)" }} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,3.9%)", border: "1px solid hsl(0,0%,100%,0.1)", borderRadius: 0, fontSize: 12 }} />
                    <Area type="monotone" dataKey="price" stroke="hsl(270,70%,55%)" strokeWidth={2} fill="url(#secGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* About */}
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">About</span>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                {security.name} is a {security.type.toLowerCase()} security token issued by {security.issuer} under {security.regulation} exemption.
                This token represents a legally enforceable claim linked to its governing document via SHA-256 hash.
                Compliance is enforced on-chain via Token-2022 transfer hooks, ensuring only KYC-verified holders in permitted jurisdictions can transact.
              </p>
            </div>
          </div>

          {/* Sidebar info */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 flex flex-col gap-4">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Token Details</span>
              {[
                ["Issuer", security.issuer],
                ["Jurisdiction", security.jurisdiction],
                ["Regulation", security.regulation],
                ["Total Supply", security.totalSupply.toLocaleString()],
                ["Circulating", security.circulatingSupply.toLocaleString()],
                ["Holders", security.holders.toLocaleString()],
                ["Created", security.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 flex flex-col gap-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">On-Chain</span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mint</span>
                <button onClick={() => handleCopy(security.mintAddress)} className="flex items-center gap-1.5 text-xs text-primary font-mono">
                  {security.mintAddress}
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Doc Hash</span>
                <span className="text-xs text-foreground font-mono">{security.documentHash}</span>
              </div>
              <a href="#" className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                View on Solscan <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Holders Tab */}
      {activeTab === "holders" && (
        <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {security.holders} Verified Holders
            </span>
          </div>
          {[
            { addr: "7xKp...mN4q", balance: "15,000", pct: "0.43%", kyc: "Verified" },
            { addr: "9aLm...kT7x", balance: "42,500", pct: "1.21%", kyc: "Verified" },
            { addr: "3bNp...xR2m", balance: "8,200", pct: "0.23%", kyc: "Verified" },
            { addr: "5dQr...wM9n", balance: "125,000", pct: "3.57%", kyc: "Accredited" },
            { addr: "2cRx...yJ8p", balance: "67,800", pct: "1.94%", kyc: "Verified" },
          ].map((h) => (
            <div key={h.addr} className="p-4 border-b border-border/30 flex items-center justify-between hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-secondary border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground">{h.addr.slice(0, 2)}</div>
                <span className="text-sm font-mono text-foreground">{h.addr}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xs text-foreground font-mono">{h.balance}</span>
                <span className="text-xs text-muted-foreground">{h.pct}</span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 font-semibold">{h.kyc}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legal Tab */}
      {activeTab === "legal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Governing Document</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The legal agreement governing this security token is permanently stored on Arweave and cryptographically linked to this token via SHA-256 hash.
            </p>
            <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border mb-4">
              <span className="text-xs text-muted-foreground">Hash:</span>
              <span className="text-xs font-mono text-foreground">{security.documentHash}</span>
            </div>
            <a href="#" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              View on Arweave <ExternalLink size={10} />
            </a>
          </div>
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Compliance</span>
            </div>
            <div className="flex flex-col gap-3">
              {[
                ["Regulation", security.regulation],
                ["Jurisdiction", security.jurisdiction],
                ["Transfer Hook", "Active — validates KYC status on every transfer"],
                ["Permanent Delegate", "Enabled — regulatory clawback authority"],
                ["Freeze Authority", "Enabled — emergency pause capability"],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground text-right max-w-[60%]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderModalOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50" onClick={() => { setOrderModalOpen(false); setOrderPlaced(false); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border z-50 shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Place Order — {security.symbol}</span>
              <button onClick={() => { setOrderModalOpen(false); setOrderPlaced(false); }} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {orderPlaced ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-primary" />
                </div>
                <div className="text-lg font-semibold text-foreground mb-2">Order Submitted</div>
                <div className="text-sm text-muted-foreground">Your DvP settlement order has been placed and is pending matching.</div>
              </div>
            ) : (
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Price per token</span>
                  <span className="text-foreground font-mono">${security.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span>Estimated Total</span>
                  <span className="text-foreground font-semibold">${(Number(buyAmount || 0) * security.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={!buyAmount || isNaN(Number(buyAmount)) || Number(buyAmount) <= 0}
                  className="w-full bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirm DvP Order
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SecurityDetail;
