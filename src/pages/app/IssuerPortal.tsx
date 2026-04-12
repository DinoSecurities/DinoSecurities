import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Plus,
  Shield,
  Users,
  Pause,
  FileText,
  ArrowUpRight,
  Loader2,
  Lock,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { securities } from "@/lib/mockData";

const IssuerPortal = () => {
  const { connected } = useWallet();
  const { role, isIssuer, loading } = useUserRole();
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  // Mock issuer's series — will be replaced with useIssuerProfile + filtered securities
  const issuerSeries = securities.slice(0, 3);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Lock size={28} className="text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Issuer Portal</h2>
          <p className="text-sm text-muted-foreground">Connect your wallet to access the issuer portal.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isIssuer && role !== "unverified") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Shield size={28} className="text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Issuer Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            You need an IssuerProfile to access this portal. Complete KYC and register as an issuer to get started.
          </p>
        </div>
        <Link
          to="/app/settings"
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors"
        >
          Register as Issuer
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Issuer Portal</h2>
          <p className="text-sm text-muted-foreground mt-1">{issuerSeries.length} security series managed</p>
        </div>
        <Link
          to="/app/issue/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors self-start"
        >
          <Plus size={16} />
          Create New Series
        </Link>
      </div>

      {/* Series Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {issuerSeries.map((s) => (
          <div
            key={s.id}
            onClick={() => setSelectedSeries(s.id === selectedSeries ? null : s.id)}
            className={`border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
              selectedSeries === s.id ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center text-xs font-bold border ${
                  s.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                  s.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                  s.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                  "bg-purple-500/20 border-purple-500/40 text-purple-400"
                }`}>{s.type[0]}</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.symbol}</div>
                  <div className="text-[10px] text-muted-foreground">{s.name}</div>
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                s.status === "active" ? "text-emerald-400 bg-emerald-400/10" :
                s.status === "paused" ? "text-amber-400 bg-amber-400/10" :
                "text-muted-foreground bg-secondary"
              }`}>
                {s.status}
              </span>
            </div>

            {/* Supply bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Supply: {(s.circulatingSupply / 1_000_000).toFixed(1)}M / {(s.totalSupply / 1_000_000).toFixed(1)}M</span>
                <span>{((s.circulatingSupply / s.totalSupply) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(s.circulatingSupply / s.totalSupply) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Holders</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{s.holders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Price</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">${s.price.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Regulation</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{s.regulation}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Series Actions */}
      {selectedSeries && (
        <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Manage: {issuerSeries.find((s) => s.id === selectedSeries)?.symbol}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="flex flex-col items-center gap-2 p-4 border border-border hover:bg-secondary/50 transition-colors">
              <Users size={20} className="text-primary" />
              <span className="text-xs text-foreground font-medium">Manage Holders</span>
              <span className="text-[10px] text-muted-foreground">Register/revoke</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-border hover:bg-secondary/50 transition-colors">
              <ArrowUpRight size={20} className="text-emerald-400" />
              <span className="text-xs text-foreground font-medium">Mint Tokens</span>
              <span className="text-[10px] text-muted-foreground">To whitelisted</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-border hover:bg-secondary/50 transition-colors">
              <FileText size={20} className="text-blue-400" />
              <span className="text-xs text-foreground font-medium">Update Legal Doc</span>
              <span className="text-[10px] text-muted-foreground">Arweave upload</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-red-500/30 hover:bg-red-500/10 transition-colors">
              <Pause size={20} className="text-red-400" />
              <span className="text-xs text-foreground font-medium">Emergency Pause</span>
              <span className="text-[10px] text-muted-foreground">Halt transfers</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuerPortal;
