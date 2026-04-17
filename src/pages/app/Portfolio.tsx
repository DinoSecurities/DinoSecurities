import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Download, Filter, Wallet, Inbox, FileText, ExternalLink } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMyTokenBalances } from "@/hooks/useTokenBalance";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import { useMySettlements } from "@/hooks/useMySettlements";
import { truncateAddress, getExplorerUrl } from "@/lib/solana";

interface Holding {
  mint: string;
  symbol: string;
  name: string;
  type: string;
  balance: number;
  decimals: number;
}

const TYPE_COLORS: Record<string, string> = {
  Equity: "hsl(270, 70%, 55%)",
  Debt: "hsl(217, 91%, 60%)",
  FundInterest: "hsl(189, 94%, 55%)",
  LlcMembership: "hsl(280, 70%, 60%)",
};

const Portfolio = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<"holdings" | "activity">("holdings");
  const balances = useMyTokenBalances();
  const securities = useIndexedSecurities();
  const mySettlements = useMySettlements(publicKey?.toBase58() ?? null);
  const seriesByMint = useMemo(
    () => new Map((securities.data ?? []).map((s) => [s.mintAddress, s])),
    [securities.data],
  );

  const holdings: Holding[] = useMemo(() => {
    if (!balances.data || !securities.data) return [];
    const seriesByMint = new Map(securities.data.map((s) => [s.mintAddress, s]));
    return balances.data
      .map((b) => {
        const series = seriesByMint.get(b.mint.toBase58());
        if (!series) return null;
        return {
          mint: b.mint.toBase58(),
          symbol: series.symbol,
          name: series.name,
          type: series.securityType,
          balance: b.balance,
          decimals: b.decimals,
        };
      })
      .filter((h): h is Holding => h !== null);
  }, [balances.data, securities.data]);

  const totalUnits = holdings.reduce((s, h) => s + h.balance, 0);
  const allocationData = useMemo(() => {
    const byType = new Map<string, number>();
    for (const h of holdings) {
      byType.set(h.type, (byType.get(h.type) ?? 0) + h.balance);
    }
    return Array.from(byType.entries()).map(([name, value]) => ({
      name,
      value,
      fill: TYPE_COLORS[name] ?? "hsl(0,0%,50%)",
    }));
  }, [holdings]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Wallet size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Connect a wallet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your portfolio shows your DinoSecurities holdings. Connect a Solana wallet (Phantom or Solflare) to continue.
        </p>
      </div>
    );
  }

  const isLoading = balances.isLoading || securities.isLoading;

  return (
    <div className="flex flex-col gap-8">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="border border-border bg-gradient-to-b from-primary to-primary/90 p-6"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 20px rgba(139,92,246,0.12)" }}
        >
          <span className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">Holdings</span>
          <div className="text-4xl font-semibold text-white tracking-tight mt-2">
            {holdings.length}
          </div>
          <span className="text-xs text-white/80">{holdings.length === 1 ? "security" : "securities"}</span>
        </div>
        <div className="border border-border bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Units</span>
          <div className="text-4xl font-semibold tracking-tight mt-2 text-foreground">
            {totalUnits.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground">across all positions</span>
        </div>
        <div className="border border-border bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</span>
          <div className="text-4xl font-semibold text-foreground tracking-tight mt-2">
            {isLoading ? "—" : "Live"}
          </div>
          <span className="text-xs text-muted-foreground">on Solana {import.meta.env.VITE_SOLANA_NETWORK === "mainnet-beta" ? "mainnet" : import.meta.env.VITE_SOLANA_NETWORK === "devnet" ? "devnet" : import.meta.env.VITE_SOLANA_NETWORK}</span>
        </div>
      </div>

      {/* Allocation pie — only meaningful when holdings exist */}
      {holdings.length > 0 && (
        <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Allocation by Type</span>
          <div className="w-full h-[280px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} strokeWidth={0}>
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0,0%,8%)", border: "1px solid hsl(0,0%,100%,0.15)", borderRadius: 0, fontSize: 12, color: "hsl(0,0%,95%)" }}
                  itemStyle={{ color: "hsl(0,0%,95%)" }}
                  labelStyle={{ color: "hsl(0,0%,95%)" }}
                  formatter={(value: number) => [value.toLocaleString(), "units"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {allocationData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2" style={{ backgroundColor: d.fill }} />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div>
        <div className="flex border-b border-border">
          {(["holdings", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-[10px] uppercase tracking-widest font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          <button className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors" disabled>
            <Download size={16} />
          </button>
          <button className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors" disabled>
            <Filter size={16} />
          </button>
        </div>

        {activeTab === "holdings" && (
          <div className="border border-t-0 border-border overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading on-chain balances…</div>
            ) : holdings.length === 0 ? (
              <div className="p-12 flex flex-col items-center text-center gap-2">
                <Inbox size={32} className="text-muted-foreground" />
                <div className="text-sm font-medium text-foreground">No DinoSecurities holdings yet</div>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Securities you acquire will appear here. Visit the marketplace to browse available offerings.
                </p>
                <Link to="/app/marketplace" className="text-xs uppercase tracking-widest text-primary mt-2 hover:underline">
                  Browse marketplace →
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset</th>
                    <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</th>
                    <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Balance</th>
                    <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Mint</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.mint} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="p-4">
                        <Link to={`/app/marketplace/${h.mint}`} className="flex items-center gap-3 group">
                          <div
                            className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                              h.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                              h.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                              h.type === "FundInterest" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                              "bg-purple-500/20 border-purple-500/40 text-purple-400"
                            }`}
                          >{h.symbol[0] ?? "?"}</div>
                          <div>
                            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{h.symbol}</div>
                            <div className="text-[10px] text-muted-foreground">{h.name}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">{h.type}</span>
                      </td>
                      <td className="p-4 text-right font-mono text-xs text-foreground font-semibold">{h.balance.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">{truncateAddress(h.mint)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="border border-t-0 border-border">
            {mySettlements.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading activity…</div>
            ) : !mySettlements.data || mySettlements.data.length === 0 ? (
              <div className="p-12 flex flex-col items-center text-center gap-2">
                <Inbox size={32} className="text-muted-foreground" />
                <div className="text-sm font-medium text-foreground">No settled activity yet</div>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Once an order settles, it'll show here with a downloadable trade-confirmation PDF.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30">
                      <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Role</th>
                      <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</th>
                      <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                      <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">USDC</th>
                      <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Settled</th>
                      <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySettlements.data.map((s) => {
                      const sec = seriesByMint.get(s.mint);
                      return (
                        <tr key={s.orderId} className="border-b border-border/30 last:border-b-0 hover:bg-secondary/20 transition-colors">
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold ${
                              s.role === "buyer" ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {s.role === "buyer" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                              {s.role === "buyer" ? "Bought" : "Sold"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-foreground">{sec?.symbol ?? truncateAddress(s.mint)}</div>
                            {sec?.name && <div className="text-xs text-muted-foreground mt-0.5">{sec.name}</div>}
                          </td>
                          <td className="p-4 text-right text-sm font-mono text-foreground">{s.tokenAmount.toLocaleString()}</td>
                          <td className="p-4 text-right text-sm font-mono text-foreground">${(s.usdcAmount / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-4 text-xs text-muted-foreground">
                            {s.settledAt ? new Date(s.settledAt).toLocaleString() : "—"}
                            {s.txSignature && (
                              <a
                                href={getExplorerUrl(s.txSignature, "tx")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-primary hover:underline inline-flex items-center gap-0.5"
                                title="View on Solana Explorer"
                              >
                                tx <ExternalLink size={9} />
                              </a>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {s.receiptUrl ? (
                              <a
                                href={s.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-primary hover:underline"
                                title="Download trade-confirmation PDF"
                              >
                                <FileText size={12} />
                                Receipt
                              </a>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
