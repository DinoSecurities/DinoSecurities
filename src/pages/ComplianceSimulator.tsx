import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, ShieldCheck, ArrowLeft, Loader2, Minus, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useComplianceSimulation, type CheckStatus } from "@/hooks/useComplianceSimulation";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import { truncateAddress, getExplorerUrl } from "@/lib/solana";

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function StatusIcon({ status }: { status: CheckStatus }) {
  const base = "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5";
  if (status === "pass")
    return (
      <div className={`${base} bg-emerald-500/15 border-emerald-500/40`}>
        <Check size={12} className="text-emerald-400" strokeWidth={3} />
      </div>
    );
  if (status === "fail")
    return (
      <div className={`${base} bg-red-500/15 border-red-500/50`}>
        <X size={12} className="text-red-400" strokeWidth={3} />
      </div>
    );
  return (
    <div className={`${base} bg-muted/30 border-border`}>
      <Minus size={12} className="text-muted-foreground" />
    </div>
  );
}

const ComplianceSimulator = () => {
  const [wallet, setWallet] = useState("");
  const [mint, setMint] = useState("");
  const [submitted, setSubmitted] = useState<{ wallet: string; mint: string } | null>(null);

  const securities = useIndexedSecurities();
  const sim = useComplianceSimulation(submitted?.wallet ?? "", submitted?.mint ?? "");

  const canSubmit = PUBKEY_RE.test(wallet) && PUBKEY_RE.test(mint);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Wallet and mint must be valid Solana addresses");
      return;
    }
    setSubmitted({ wallet: wallet.trim(), mint: mint.trim() });
  };

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const data = sim.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft size={12} /> Back to home
        </Link>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              DinoSecurities / Compliance
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[0.95] mb-4">
            Pre-Trade <span className="text-muted-foreground">Compliance Simulator.</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Paste any Solana wallet and pick a security series. We run the same
            validation sequence the on-chain Transfer Hook would run if that
            wallet attempted to receive the token — without sending a
            transaction. Every check is read-only and reproducible from public
            on-chain state.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border border-border p-6 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] flex flex-col gap-4 mb-8">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Destination wallet
            </label>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="e.g. 4e4Xf6ZtLuPqV8z5Ewp7e6GUCqbgUq3YVwigGPJYNyTM"
              className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm font-mono focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Security mint
            </label>
            <div className="flex gap-2 mt-2">
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Paste a mint address or pick one →"
                className="flex-1 bg-secondary border border-border px-4 py-3 text-foreground text-sm font-mono focus:outline-none focus:border-primary/50"
              />
              <select
                onChange={(e) => e.target.value && setMint(e.target.value)}
                value=""
                className="bg-secondary border border-border px-3 py-3 text-sm text-foreground focus:outline-none"
                aria-label="Pick a series"
              >
                <option value="">Pick a series…</option>
                {(securities.data ?? []).map((s) => (
                  <option key={s.mintAddress} value={s.mintAddress}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="self-start mt-2 px-6 py-3 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Simulate transfer
          </button>
        </form>

        {submitted && (
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Target
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{truncateAddress(submitted.wallet)}</span>
                  <button onClick={() => copy(submitted.wallet)} className="text-muted-foreground hover:text-foreground">
                    <Copy size={12} />
                  </button>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono">{truncateAddress(submitted.mint)}</span>
                  <a
                    href={getExplorerUrl(submitted.mint, "address")}
                    target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              {sim.isFetching ? (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Loader2 size={14} className="animate-spin" /> Checking on-chain state…
                </div>
              ) : data ? (
                <div
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold ${
                    data.pass
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                      : "bg-red-500/15 text-red-400 border border-red-500/50"
                  }`}
                >
                  {data.pass ? "Transfer would succeed" : "Transfer would revert"}
                </div>
              ) : null}
            </div>

            {sim.isError && (
              <div className="p-6 text-sm text-red-400">
                Failed to run simulation: {(sim.error as Error)?.message ?? "unknown error"}
              </div>
            )}

            {data && (
              <>
                <div className="flex flex-col">
                  {data.checks.map((c) => (
                    <div key={c.id} className="flex items-start gap-4 px-6 py-4 border-b border-border/50 last:border-b-0">
                      <StatusIcon status={c.status} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{c.name}</div>
                        {c.detail && <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>}
                      </div>
                      <span className={`text-[9px] uppercase tracking-widest font-semibold shrink-0 ${
                        c.status === "pass" ? "text-emerald-400"
                          : c.status === "fail" ? "text-red-400"
                          : "text-muted-foreground"
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>

                {(data.series || data.holder) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-border">
                    {data.series && (
                      <div className="p-6 border-b md:border-b-0 md:border-r border-border">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                          Series
                        </div>
                        <div className="flex flex-col gap-2 text-xs">
                          <Row label="Restriction" value={data.series.restriction} />
                          <Row label="Paused" value={data.series.paused ? "Yes" : "No"} />
                        </div>
                      </div>
                    )}
                    {data.holder && (
                      <div className="p-6">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                          HolderRecord
                        </div>
                        <div className="flex flex-col gap-2 text-xs">
                          <Row label="Accredited" value={data.holder.isAccredited ? "Yes" : "No"} />
                          <Row label="Jurisdiction" value={data.holder.jurisdiction} />
                          <Row
                            label="KYC expires"
                            value={data.holder.kycExpiry
                              ? new Date(data.holder.kycExpiry * 1000).toLocaleDateString()
                              : "—"}
                          />
                          <Row label="Revoked" value={data.holder.isRevoked ? "Yes" : "No"} />
                          <Row label="Frozen" value={data.holder.isFrozen ? "Yes" : "No"} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-10 text-[11px] text-muted-foreground/80 leading-relaxed max-w-2xl">
          This simulator reads on-chain state via the same RPC the Transfer
          Hook reads during execution. A "transfer would succeed" result means
          every check passes at the instant of the request; state can change
          after (issuer freezes a holder, KYC expires, series gets paused) so
          this is a point-in-time read, not a guarantee.
        </div>
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export default ComplianceSimulator;
