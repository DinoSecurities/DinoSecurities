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
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import { truncateAddress } from "@/lib/solana";

const TYPE_COLORS: Record<string, string> = {
  Equity: "bg-primary/20 border-primary/40 text-primary",
  Debt: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  FundInterest: "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
  LlcMembership: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

const IssuerPortal = () => {
  const { connected, publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? "";
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  const { data: allSeries = [], isLoading: loading } = useIndexedSecurities();
  const issuerSeries = allSeries.filter((s) => s.issuer === wallet);

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
      {issuerSeries.length === 0 ? (
        <div className="border border-border p-16 flex flex-col items-center text-center gap-2">
          <FileText size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No series issued yet</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Click <span className="text-primary">Create New Series</span> to launch your first security token. The wizard will guide you through legal docs, metadata, and transfer restrictions, then deploy a Token-2022 mint with full on-chain compliance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {issuerSeries.map((s) => (
            <div
              key={s.mintAddress}
              onClick={() => setSelectedSeries(s.mintAddress === selectedSeries ? null : s.mintAddress)}
              className={`border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                selectedSeries === s.mintAddress ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center text-xs font-bold border ${TYPE_COLORS[s.securityType] ?? "bg-secondary border-border text-muted-foreground"}`}>
                    {s.symbol[0] ?? "?"}
                  </div>
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

              <div className="mb-4">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Supply: {s.currentSupply.toLocaleString()} / {s.maxSupply.toLocaleString()}</span>
                  <span>{s.maxSupply > 0 ? ((s.currentSupply / s.maxSupply) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${s.maxSupply > 0 ? (s.currentSupply / s.maxSupply) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Mint</div>
                  <div className="text-xs font-mono text-foreground mt-0.5">{truncateAddress(s.mintAddress)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Restriction</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.transferRestrictions}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSeries && (
        <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Manage: {issuerSeries.find((s) => s.mintAddress === selectedSeries)?.symbol}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Holder management, minting, doc updates, and emergency pause are wired in dino_core. UI for these actions ships in v0.2.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button disabled className="flex flex-col items-center gap-2 p-4 border border-border opacity-50">
              <Users size={20} className="text-primary" />
              <span className="text-xs text-foreground font-medium">Manage Holders</span>
              <span className="text-[10px] text-muted-foreground">Register/revoke</span>
            </button>
            <button disabled className="flex flex-col items-center gap-2 p-4 border border-border opacity-50">
              <ArrowUpRight size={20} className="text-emerald-400" />
              <span className="text-xs text-foreground font-medium">Mint Tokens</span>
              <span className="text-[10px] text-muted-foreground">To whitelisted</span>
            </button>
            <button disabled className="flex flex-col items-center gap-2 p-4 border border-border opacity-50">
              <FileText size={20} className="text-blue-400" />
              <span className="text-xs text-foreground font-medium">Update Legal Doc</span>
              <span className="text-[10px] text-muted-foreground">Arweave upload</span>
            </button>
            <button disabled className="flex flex-col items-center gap-2 p-4 border border-red-500/30 opacity-50">
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
