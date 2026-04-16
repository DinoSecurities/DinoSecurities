import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight, ArrowDownRight, Clock, Check, AlertCircle, Loader2, Plus, X, Wallet, Inbox, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PROGRAM_IDS, truncateAddress, getExplorerUrl } from "@/lib/solana";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import { useOnChainOrders, useMyOrders, type OnChainOrder } from "@/hooks/useOnChainOrders";
import { createSettlementOrderOnChain, cancelSettlementOrderOnChain } from "@/lib/settlementActions";
import PaymentBadges from "@/components/PaymentBadges";

type Tab = "book" | "mine";

const Settlement = () => {
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const { connection } = useConnection();
  const qc = useQueryClient();
  const myKey = publicKey?.toBase58() ?? "";

  const [tab, setTab] = useState<Tab>("mine");
  const [selectedMint, setSelectedMint] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [tokenAmount, setTokenAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [expiryHours, setExpiryHours] = useState("24");

  const securities = useIndexedSecurities();
  const seriesByMint = useMemo(
    () => new Map((securities.data ?? []).map((s) => [s.mintAddress, s])),
    [securities.data],
  );
  const mintFilter = selectedMint || undefined;
  const orderBook = useOnChainOrders({ mint: mintFilter });
  const myOrders = useMyOrders();

  const refresh = () => qc.invalidateQueries({ queryKey: ["onChainOrders"] });

  const closeCreate = () => {
    setCreateOpen(false);
    setTokenAmount("");
    setPaymentAmount("");
  };

  const handleCreate = async () => {
    if (!selectedMint) return toast.error("Pick a security first");
    setBusy(true);
    try {
      const res = await createSettlementOrderOnChain(connection, wallet, {
        securityMint: selectedMint,
        paymentMint: PROGRAM_IDS.USDC_MINT.toBase58(),
        side,
        tokenAmount: BigInt(tokenAmount || "0"),
        // USDC has 6 decimals on Solana; convert dollars to micro-USDC.
        paymentAmount: Math.round(Number(paymentAmount || "0") * 1_000_000),
        expiresInSeconds: Number(expiryHours) * 3600,
      });
      toast.success(
        <span>Order live — <a className="underline" href={getExplorerUrl(res.signature, "tx")} target="_blank" rel="noreferrer">view tx</a></span>,
      );
      refresh();
      closeCreate();
    } catch (err: any) {
      toast.error("Create failed: " + (err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (order: OnChainOrder) => {
    setBusy(true);
    try {
      const sig = await cancelSettlementOrderOnChain(connection, wallet, order.pda);
      toast.success(
        <span>Cancelled — <a className="underline" href={getExplorerUrl(sig, "tx")} target="_blank" rel="noreferrer">view tx</a></span>,
      );
      refresh();
    } catch (err: any) {
      toast.error("Cancel failed: " + (err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Wallet size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Connect a wallet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Settlement orders are tied to your Solana address. Connect Phantom to create and manage DvP orders.
        </p>
      </div>
    );
  }

  const visibleOrders: OnChainOrder[] = (tab === "mine" ? myOrders.data : orderBook.data) ?? [];
  const isLoading = tab === "mine" ? myOrders.isLoading : orderBook.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Settlement</h2>
          <p className="text-sm text-muted-foreground mt-1">Atomic DvP orders against the Token-2022 securities</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors self-start"
        >
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex border border-border">
          {(["mine", "book"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "mine" ? "My Orders" : "Order Book"}
            </button>
          ))}
        </div>
        {tab === "book" && (
          <select
            value={selectedMint}
            onChange={(e) => setSelectedMint(e.target.value)}
            className="bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none"
          >
            <option value="">All securities</option>
            {(securities.data ?? []).map((s) => (
              <option key={s.mintAddress} value={s.mintAddress}>{s.symbol} — {s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 size={20} className="animate-spin inline mr-2" /> Loading orders…
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center gap-2">
            <Inbox size={32} className="text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">
              {tab === "mine" ? "No orders yet" : "Order book is empty"}
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              {tab === "mine"
                ? "Create your first DvP order and it'll show up here once the chain confirms."
                : "Open orders from any wallet appear here. The settlement agent matches and atomically settles them."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Side</th>
                  <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Price (USDC)</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Total</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Expires</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-right p-4"></th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => {
                  const series = seriesByMint.get(o.securityMint);
                  const totalUsdc = o.paymentAmount / 1_000_000;
                  const pricePerToken = o.tokenAmount > 0 ? totalUsdc / o.tokenAmount : 0;
                  const isMine = o.creator === myKey;
                  const expiresIn = o.expiresAt - Math.floor(Date.now() / 1000);
                  return (
                    <tr key={o.pda} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="p-4">
                        <span className={`text-[10px] uppercase tracking-widest font-bold ${o.side === "Buy" ? "text-emerald-400" : "text-red-400"}`}>
                          {o.side === "Buy" ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {o.side}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-foreground">{series?.symbol ?? truncateAddress(o.securityMint)}</div>
                        {series?.name && <div className="text-[10px] text-muted-foreground">{series.name}</div>}
                      </td>
                      <td className="p-4 text-right font-mono text-xs text-foreground">{o.tokenAmount.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-xs text-foreground">${pricePerToken.toFixed(4)}</td>
                      <td className="p-4 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">${totalUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {expiresIn > 0 ? `${Math.floor(expiresIn / 3600)}h ${Math.floor((expiresIn % 3600) / 60)}m` : "expired"}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                          o.status === "Open" ? "text-primary bg-primary/10" :
                          o.status === "Settled" ? "text-emerald-400 bg-emerald-400/10" :
                          o.status === "Cancelled" ? "text-muted-foreground bg-secondary" :
                          "text-amber-400 bg-amber-400/10"
                        }`}>
                          {o.status === "Open" && <Clock size={10} className="inline mr-1" />}
                          {o.status === "Settled" && <Check size={10} className="inline mr-1" />}
                          {o.status === "Expired" && <AlertCircle size={10} className="inline mr-1" />}
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={getExplorerUrl(o.pda, "address")}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink size={12} />
                          </a>
                          {isMine && o.status === "Open" && (
                            <button
                              onClick={() => handleCancel(o)}
                              disabled={busy}
                              className="text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300 disabled:opacity-30"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Atomic DvP execution is performed server-side once a matching counterparty exists. You only sign the order creation / cancellation legs.
      </p>

      {createOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50" onClick={() => !busy && closeCreate()} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border z-50 shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">New DvP Order</span>
              <button onClick={closeCreate} disabled={busy} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</label>
                <select
                  value={selectedMint}
                  onChange={(e) => setSelectedMint(e.target.value)}
                  className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none"
                >
                  <option value="">— pick one —</option>
                  {(securities.data ?? []).map((s) => (
                    <option key={s.mintAddress} value={s.mintAddress}>{s.symbol} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Side</label>
                <div className="mt-2 flex gap-2">
                  {(["Buy", "Sell"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-semibold border transition-colors ${
                        side === s
                          ? s === "Buy" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-red-500/20 border-red-500/50 text-red-400"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Token amount</label>
                  <input
                    type="number"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    placeholder="100"
                    className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total USDC</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="10000"
                    className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Expires in</label>
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(e.target.value)}
                  className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
              {tokenAmount && paymentAmount && Number(tokenAmount) > 0 && (
                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                  Implied price: <span className="text-foreground font-mono">${(Number(paymentAmount) / Number(tokenAmount)).toFixed(4)} / token</span>
                </div>
              )}
              <div className="pt-3 border-t border-border/50">
                <PaymentBadges size="sm" />
              </div>
              <button
                onClick={handleCreate}
                disabled={busy || !selectedMint || !tokenAmount || !paymentAmount}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-30"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Submit Order
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settlement;
