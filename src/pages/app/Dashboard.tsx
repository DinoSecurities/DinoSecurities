import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Briefcase,
  Users,
  TrendingUp,
  Activity,
  ExternalLink,
  Inbox,
  Wallet,
  Coins,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { NETWORK } from "@/providers/SolanaProvider";
import { useMyTokenBalances } from "@/hooks/useTokenBalance";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";

const Dashboard = () => {
  const { connected } = useWallet();
  const balances = useMyTokenBalances();
  const securities = useIndexedSecurities();

  const holdings = useMemo(() => {
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
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null);
  }, [balances.data, securities.data]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 border border-border bg-secondary/60 flex items-center justify-center">
          <Wallet size={28} className="text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Connect a Solana wallet to view your portfolio, trade securities, vote on proposals, and manage settlements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Holdings"
          value={`${holdings.length}`}
          icon={Briefcase}
          subtitle={holdings.length === 1 ? "security held" : "securities held"}
          variant="primary"
        />
        <StatCard
          label="Available Securities"
          value={`${securities.data?.length ?? 0}`}
          icon={Coins}
          subtitle={`indexed on ${NETWORK === "mainnet-beta" ? "mainnet" : NETWORK}`}
        />
        <StatCard
          label="Network"
          value={NETWORK === "mainnet-beta" ? "Mainnet" : NETWORK === "devnet" ? "Devnet" : NETWORK}
          icon={Activity}
          subtitle="Solana"
        />
        <StatCard
          label="Active Proposals"
          value="0"
          icon={Users}
          subtitle="awaiting your vote"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Holdings</span>
            <Link to="/app/portfolio" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">View All</Link>
          </div>
          {holdings.length === 0 ? (
            <div className="p-12 flex flex-col items-center text-center gap-2">
              <Inbox size={32} className="text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">No holdings yet</div>
              <p className="text-xs text-muted-foreground max-w-sm">Securities you acquire will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset</th>
                    <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Balance</th>
                    <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.mint} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <Link to={`/app/marketplace/${h.mint}`} className="flex items-center gap-3 group">
                          <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                            h.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                            h.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                            h.type === "FundInterest" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                            "bg-purple-500/20 border-purple-500/40 text-purple-400"
                          }`}>{h.symbol[0] ?? "?"}</div>
                          <div>
                            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{h.symbol}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{h.name}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="p-3 text-right text-foreground font-mono text-xs">{h.balance.toLocaleString()}</td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">{h.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Active Proposals</span>
              <Link to="/app/governance" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">View All</Link>
            </div>
            <div className="p-8 text-center text-xs text-muted-foreground">No active proposals</div>
          </div>

          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pending Settlements</span>
              <Link to="/app/settlement" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">View All</Link>
            </div>
            <div className="p-8 text-center text-xs text-muted-foreground">No pending settlements</div>
          </div>
        </div>
      </div>

      <div className="border border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <TrendingUp size={28} className="text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">{NETWORK === "mainnet-beta" ? "Mainnet — live" : `${NETWORK === "devnet" ? "Devnet" : NETWORK} — testing live programs`}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              All data is real on-chain state. Issue your first security via the Issuer Portal to see the marketplace and your dashboard populate.
            </div>
          </div>
        </div>
        <Link
          to="/app/issue/create"
          className="text-[10px] uppercase tracking-widest text-primary font-semibold flex items-center gap-1 hover:underline shrink-0"
        >
          Create Series <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
