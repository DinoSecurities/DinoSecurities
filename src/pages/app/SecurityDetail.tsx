import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Copy, Check, FileText, Shield, Users, Loader2 } from "lucide-react";
import { useIndexedSecurityByMint } from "@/hooks/useIndexedSecurities";
import { useHoldersForMint } from "@/hooks/useHoldersForMint";
import { truncateAddress, getExplorerUrl } from "@/lib/solana";
import { toast } from "sonner";
import PaymentBadges from "@/components/PaymentBadges";
import DocVerificationBadge from "@/components/DocVerificationBadge";
import VerificationPanel from "@/components/VerificationPanel";
import HolderGeoMap from "@/components/HolderGeoMap";

const SecurityDetail = () => {
  const { mint } = useParams();
  const security = useIndexedSecurityByMint(mint);
  const [activeTab, setActiveTab] = useState<"overview" | "holders" | "legal">("overview");
  const [copied, setCopied] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (security.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading on-chain data…
      </div>
    );
  }

  if (!security.data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <FileText size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Security not found</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          No security with mint <span className="font-mono text-foreground">{mint && truncateAddress(mint)}</span> is indexed yet.
          If you just created it, wait a few seconds for the Helius webhook to fire and refresh.
        </p>
        <Link to="/app/marketplace" className="text-xs uppercase tracking-widest text-primary mt-6 hover:underline">
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  const s = security.data;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app/marketplace" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft size={16} /> Back to Marketplace
      </Link>

      <div className="flex flex-col md:flex-row gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 flex items-center justify-center text-lg font-bold border ${
            s.securityType === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
            s.securityType === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
            s.securityType === "FundInterest" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
            "bg-purple-500/20 border-purple-500/40 text-purple-400"
          }`}>{s.symbol[0] ?? "?"}</div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{s.name}</h2>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 font-semibold ${
                s.status === "active" ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"
              }`}>{s.status}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{s.symbol}</span>
              <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <span>{s.securityType}</span>
              <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <span>{s.transferRestrictions}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setOrderModalOpen(true)}
          className="bg-foreground text-background px-6 py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all self-start"
        >
          Place DvP Order
        </button>
      </div>

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

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">About</span>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                {s.name} is a {s.securityType.toLowerCase()} security token issued under {s.transferRestrictions} exemption.
                Compliance is enforced on-chain via the dino_transfer_hook program — every transfer validates KYC, accreditation,
                and freeze status before settling.
              </p>
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 flex flex-col gap-4">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Token Details</span>
              {[
                ["Issuer", truncateAddress(s.issuer)],
                ["Jurisdiction", s.jurisdiction || "—"],
                ["Restriction", s.transferRestrictions],
                ["Max Supply", s.maxSupply.toLocaleString()],
                ["Circulating", s.currentSupply.toLocaleString()],
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
                <button onClick={() => handleCopy(s.mintAddress)} className="flex items-center gap-1.5 text-xs text-primary font-mono">
                  {truncateAddress(s.mintAddress)}
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <a
                href={getExplorerUrl(s.mintAddress, "address")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
              >
                View on Solscan <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === "holders" && <HoldersTab mint={s.mintAddress} />}

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

            <VerificationPanel docUri={s.docUri} expectedHex={s.docHash} className="mb-4" />

            {s.docUri ? (
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Arweave URI</span>
                  <a
                    href={s.docUri.startsWith("ar://") ? `https://arweave.net/${s.docUri.slice(5)}` : s.docUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary font-mono hover:underline"
                  >
                    {s.docUri.length > 40 ? `${s.docUri.slice(0, 28)}…${s.docUri.slice(-8)}` : s.docUri}
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">On-chain SHA-256</span>
                  <span className="text-foreground font-mono text-[10px]">{truncateAddress(s.docHash)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-4">Document URI populated when issuer uploads via the Issuer Portal wizard.</p>
            )}
          </div>
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Compliance</span>
            </div>
            <div className="flex flex-col gap-3">
              {[
                ["Restriction", s.transferRestrictions],
                ["Jurisdiction", s.jurisdiction || "—"],
                ["Transfer Hook", "Active — validates KYC + accreditation + freeze on every transfer"],
                ["Permanent Delegate", "Enabled — regulatory clawback authority"],
                ["Freeze Authority", "Enabled — emergency pause via dino_core.emergency_pause"],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                  <span className="text-xs text-foreground text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {orderModalOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50" onClick={() => setOrderModalOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border z-50 shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Place Order — {s.symbol}</span>
              <button onClick={() => setOrderModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Token Amount</label>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0"
                  className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="pt-2 border-t border-border/50">
                <PaymentBadges size="sm" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                DvP order creation requires a price oracle for the security; integration with the matching engine ships in v0.2.
              </p>
              <button
                onClick={() => toast.info("Order matching engine wires up in v0.2")}
                disabled={!buyAmount}
                className="w-full bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function HoldersTab({ mint }: { mint: string }) {
  const holders = useHoldersForMint(mint);
  const rows = holders.data ?? [];
  if (holders.isLoading) {
    return (
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-12 text-center text-sm text-muted-foreground">
        <Loader2 size={20} className="animate-spin inline mr-2" /> Loading holders…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-12 flex flex-col items-center text-center gap-2">
        <Users size={32} className="text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">No holders yet</div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Holders appear here once the issuer whitelists them via the Issuer Portal and compliance data is recorded in a HolderRecord PDA.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <HolderGeoMap holders={rows} />
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Users size={16} className="text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {rows.length} holder{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30">
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Wallet</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Jurisdiction</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">KYC</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Accredited</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr key={h.pda ?? `${h.wallet}-${i}`} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                <td className="p-4 font-mono text-xs text-foreground">{truncateAddress(h.wallet)}</td>
                <td className="p-4 text-right text-xs text-muted-foreground hidden md:table-cell">{h.jurisdiction || "—"}</td>
                <td className="p-4 text-right">
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    h.isRevoked ? "text-red-400 bg-red-400/10" : "text-emerald-400 bg-emerald-400/10"
                  }`}>
                    {h.isRevoked ? "Revoked" : "Active"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    h.isAccredited ? "text-primary bg-primary/10" : "text-muted-foreground bg-secondary"
                  }`}>
                    {h.isAccredited ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    h.isFrozen ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground bg-secondary"
                  }`}>
                    {h.isFrozen ? "Frozen" : "OK"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default SecurityDetail;
