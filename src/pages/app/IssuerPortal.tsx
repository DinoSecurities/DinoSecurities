import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Users,
  Pause,
  Play,
  FileText,
  ArrowUpRight,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import { truncateAddress, getExplorerUrl } from "@/lib/solana";
import { registerHolder, mintTokens, setSeriesPause } from "@/lib/issuerActions";

type ActionType = "holder" | "mint" | "pause";

const TYPE_COLORS: Record<string, string> = {
  Equity: "bg-primary/20 border-primary/40 text-primary",
  Debt: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  FundInterest: "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
  LlcMembership: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

const IssuerPortal = () => {
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const { connection } = useConnection();
  const qc = useQueryClient();
  const walletStr = publicKey?.toBase58() ?? "";
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state for the action modals
  const [holderWallet, setHolderWallet] = useState("");
  const [holderAccredited, setHolderAccredited] = useState(true);
  const [holderJurisdiction, setHolderJurisdiction] = useState("US");
  const [mintRecipient, setMintRecipient] = useState("");
  const [mintAmount, setMintAmount] = useState("");

  const { data: allSeries = [], isLoading: loading } = useIndexedSecurities();
  const issuerSeries = allSeries.filter((s) => s.issuer === walletStr);
  const selected = issuerSeries.find((s) => s.mintAddress === selectedSeries);

  const closeModal = () => {
    setActiveAction(null);
    setHolderWallet("");
    setMintRecipient("");
    setMintAmount("");
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["indexedSecurities"] });
    qc.invalidateQueries({ queryKey: ["indexedSecurity"] });
  };

  const handleRegisterHolder = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const sig = await registerHolder(connection, wallet, {
        mint: selected.mintAddress,
        holderWallet,
        isAccredited: holderAccredited,
        jurisdiction: holderJurisdiction,
      });
      toast.success(
        <span>Holder whitelisted — <a className="underline" href={getExplorerUrl(sig, "tx")} target="_blank" rel="noreferrer">view tx</a></span>,
      );
      closeModal();
    } catch (err: any) {
      toast.error("Register failed: " + (err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const handleMint = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const sig = await mintTokens(connection, wallet, {
        mint: selected.mintAddress,
        recipient: mintRecipient,
        amount: BigInt(mintAmount || "0"),
      });
      toast.success(
        <span>Minted {Number(mintAmount).toLocaleString()} {selected.symbol} — <a className="underline" href={getExplorerUrl(sig, "tx")} target="_blank" rel="noreferrer">view tx</a></span>,
      );
      refresh();
      closeModal();
    } catch (err: any) {
      toast.error("Mint failed: " + (err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const handlePauseToggle = async () => {
    if (!selected) return;
    const next = selected.status !== "paused";
    setBusy(true);
    try {
      const sig = await setSeriesPause(connection, wallet, {
        mint: selected.mintAddress,
        paused: next,
      });
      toast.success(
        <span>Series {next ? "paused" : "resumed"} — <a className="underline" href={getExplorerUrl(sig, "tx")} target="_blank" rel="noreferrer">view tx</a></span>,
      );
      refresh();
      closeModal();
    } catch (err: any) {
      toast.error((next ? "Pause" : "Resume") + " failed: " + (err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

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

      {selected && (
        <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Manage: {selected.symbol}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveAction("holder")}
              className="flex flex-col items-center gap-2 p-4 border border-border hover:bg-secondary/40 transition-colors"
            >
              <Users size={20} className="text-primary" />
              <span className="text-xs text-foreground font-medium">Whitelist Holder</span>
              <span className="text-[10px] text-muted-foreground">register_holder</span>
            </button>
            <button
              onClick={() => setActiveAction("mint")}
              className="flex flex-col items-center gap-2 p-4 border border-border hover:bg-secondary/40 transition-colors"
            >
              <ArrowUpRight size={20} className="text-emerald-400" />
              <span className="text-xs text-foreground font-medium">Mint Tokens</span>
              <span className="text-[10px] text-muted-foreground">To holder</span>
            </button>
            <button disabled className="flex flex-col items-center gap-2 p-4 border border-border opacity-50">
              <FileText size={20} className="text-blue-400" />
              <span className="text-xs text-foreground font-medium">Update Legal Doc</span>
              <span className="text-[10px] text-muted-foreground">v0.3 (needs new ix)</span>
            </button>
            <button
              onClick={() => setActiveAction("pause")}
              className={`flex flex-col items-center gap-2 p-4 border transition-colors ${
                selected.status === "paused" ? "border-emerald-500/40 hover:bg-emerald-500/10" : "border-red-500/40 hover:bg-red-500/10"
              }`}
            >
              {selected.status === "paused" ? (
                <Play size={20} className="text-emerald-400" />
              ) : (
                <Pause size={20} className="text-red-400" />
              )}
              <span className="text-xs text-foreground font-medium">
                {selected.status === "paused" ? "Resume Series" : "Emergency Pause"}
              </span>
              <span className="text-[10px] text-muted-foreground">Toggle transfers</span>
            </button>
          </div>
        </div>
      )}

      {activeAction && selected && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50" onClick={() => !busy && closeModal()} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border z-50 shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {activeAction === "holder" ? "Whitelist Holder" : activeAction === "mint" ? `Mint ${selected.symbol}` : "Toggle Series Pause"}
              </span>
              <button onClick={closeModal} disabled={busy} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {activeAction === "holder" && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Holder wallet</label>
                    <input
                      value={holderWallet}
                      onChange={(e) => setHolderWallet(e.target.value)}
                      placeholder="Solana pubkey"
                      className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Jurisdiction</label>
                    <input
                      value={holderJurisdiction}
                      onChange={(e) => setHolderJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      placeholder="US"
                      className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={holderAccredited}
                      onChange={(e) => setHolderAccredited(e.target.checked)}
                    />
                    Accredited investor (required for Reg D series)
                  </label>
                  <button
                    onClick={handleRegisterHolder}
                    disabled={busy || !holderWallet}
                    className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-30"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    Whitelist
                  </button>
                </>
              )}

              {activeAction === "mint" && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Recipient wallet</label>
                    <input
                      value={mintRecipient}
                      onChange={(e) => setMintRecipient(e.target.value)}
                      placeholder="Solana pubkey (must be whitelisted)"
                      className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</label>
                    <input
                      type="number"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      placeholder="0"
                      className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Cap: {selected.maxSupply.toLocaleString()} • Already minted: {selected.currentSupply.toLocaleString()}
                  </div>
                  <button
                    onClick={handleMint}
                    disabled={busy || !mintRecipient || !mintAmount}
                    className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-30"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    Mint
                  </button>
                </>
              )}

              {activeAction === "pause" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {selected.status === "paused"
                      ? `Resume transfers for ${selected.symbol}? Holders will be able to trade again immediately.`
                      : `Pause all transfers for ${selected.symbol}? Existing holders keep their balances but no transfers will succeed until you resume.`}
                  </p>
                  <button
                    onClick={handlePauseToggle}
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-30 ${
                      selected.status === "paused" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    {selected.status === "paused" ? "Resume Series" : "Pause Series"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IssuerPortal;
