import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Clock,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { useMyKYCStatus } from "@/hooks/useHolderRecord";
import { useProposals } from "@/hooks/useGovernance";
import { useSettlementOrders } from "@/hooks/useSettlement";

// Still using mock data for holdings/chart until real Token-2022 integration
import {
  holdings,
  recentActivity,
  portfolioChartData,
} from "@/lib/mockData";

const Dashboard = () => {
  const [chartPeriod, setChartPeriod] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("1Y");
  const { connected } = useWallet();

  // Real hooks (with mock fallback internally)
  const { data: kycStatus } = useMyKYCStatus();
  const { data: allProposals } = useProposals();
  const { data: settlementData } = useSettlementOrders();

  const activeProposals = (allProposals ?? []).filter((p) => p.status === "active");
  const pendingSettlements = (settlementData ?? []).filter((o) => o.status !== "completed");

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);

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
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Portfolio Value"
          value={`$${totalValue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: "12.4%", positive: true }}
          subtitle="vs last month"
          variant="primary"
        />
        <StatCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString()}`}
          icon={TrendingUp}
          trend={{ value: `${((totalPnl / (totalValue - totalPnl)) * 100).toFixed(1)}%`, positive: totalPnl >= 0 }}
          subtitle="all time"
        />
        <StatCard
          label="Holdings"
          value={`${holdings.length} Securities`}
          icon={Briefcase}
          subtitle="across 4 types"
        />
        <StatCard
          label="Active Proposals"
          value={`${activeProposals.length}`}
          icon={Users}
          subtitle="requiring your vote"
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Portfolio Chart */}
        <div className="xl:col-span-8 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Portfolio Performance
              </span>
              <div className="text-2xl font-semibold text-foreground mt-1">
                ${totalValue.toLocaleString()}
              </div>
            </div>
            <div className="flex gap-1 bg-secondary/60 border border-border p-1">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                    chartPeriod === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioChartData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(270, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(270, 70%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0, 0%, 45%)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0, 0%, 45%)" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 3.9%)",
                    border: "1px solid hsl(0, 0%, 100%, 0.1)",
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(270, 70%, 55%)"
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="xl:col-span-4 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Recent Activity
            </span>
            <Activity size={14} className="text-muted-foreground/40" />
          </div>
          <div className="divide-y divide-border/50">
            {recentActivity.slice(0, 5).map((a) => (
              <div key={a.id} className="p-4 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.description}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={10} className="text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/60">{a.timestamp}</span>
                    </div>
                  </div>
                  {a.amount && (
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">{a.amount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/app/portfolio"
            className="block p-3 text-center text-xs text-primary font-semibold uppercase tracking-widest hover:bg-secondary/30 transition-colors border-t border-border"
          >
            View All Activity
          </Link>
        </div>
      </div>

      {/* Holdings + Proposals + Settlements */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Holdings */}
        <div className="xl:col-span-7 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Holdings
            </span>
            <Link to="/app/portfolio" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset</th>
                  <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Balance</th>
                  <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Value</th>
                  <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.security.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-3">
                      <Link to={`/app/marketplace/${h.security.mintAddress}`} className="flex items-center gap-3 group">
                        <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                          h.security.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                          h.security.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                          h.security.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                          "bg-purple-500/20 border-purple-500/40 text-purple-400"
                        }`}>
                          {h.security.type[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{h.security.symbol}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{h.security.name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-right text-foreground font-mono text-xs">{h.balance.toLocaleString()}</td>
                    <td className="p-3 text-right text-foreground font-mono text-xs hidden sm:table-cell">${h.value.toLocaleString()}</td>
                    <td className="p-3 text-right hidden md:table-cell">
                      <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {h.pnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Proposals + Settlements */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Active Proposals */}
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Active Proposals
              </span>
              <Link to="/app/governance" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">
                View All
              </Link>
            </div>
            {activeProposals.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">No active proposals</div>
            )}
            {activeProposals.map((p) => {
              const totalVotes = p.votesFor + p.votesAgainst;
              const forPercent = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
              return (
                <Link
                  key={p.id}
                  to="/app/governance"
                  className="block p-4 border-b border-border/30 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="text-sm font-medium text-foreground">{p.title}</div>
                    <span className="text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 font-semibold shrink-0">
                      {p.series}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-primary transition-all" style={{ width: `${forPercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>For: {forPercent.toFixed(0)}%</span>
                    <span>Ends {p.endDate}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pending Settlements */}
          <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Pending Settlements
              </span>
              <Link to="/app/settlement" className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">
                View All
              </Link>
            </div>
            {pendingSettlements.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">No pending settlements</div>
            )}
            {pendingSettlements.slice(0, 3).map((o) => (
              <div key={o.id} className="p-4 border-b border-border/30 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${o.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                      {o.type}
                    </span>
                    <span className="text-sm font-medium text-foreground">{o.security}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    o.status === "settling" ? "text-amber-400 bg-amber-400/10" :
                    o.status === "matched" ? "text-primary bg-primary/10" :
                    "text-muted-foreground bg-secondary"
                  }`}>
                    {o.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.amount.toLocaleString()} × ${o.price} = ${o.total.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KYC Status Banner */}
      <div className={`border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        kycStatus?.status === "verified"
          ? "border-primary/30 bg-primary/5"
          : kycStatus?.status === "pending"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-red-500/30 bg-red-500/5"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 border flex items-center justify-center shrink-0 ${
            kycStatus?.status === "verified"
              ? "border-primary/40 bg-primary/10"
              : kycStatus?.status === "pending"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-red-500/40 bg-red-500/10"
          }`}>
            <span className={`text-lg ${
              kycStatus?.status === "verified" ? "text-primary" :
              kycStatus?.status === "pending" ? "text-amber-500" : "text-red-500"
            }`}>
              {kycStatus?.status === "verified" ? "✓" : kycStatus?.status === "pending" ? "⏳" : "✗"}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {kycStatus?.status === "verified" ? "Identity Verified" :
               kycStatus?.status === "pending" ? "KYC Pending" : "KYC Required"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              KYC status: {kycStatus?.status ?? "unknown"}
              {kycStatus?.isAccredited && " • Accredited Investor"}
              {kycStatus?.expiresAt && ` • Expires ${new Date(kycStatus.expiresAt * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
            </div>
          </div>
        </div>
        <Link
          to="/app/settings"
          className="text-[10px] uppercase tracking-widest text-primary font-semibold flex items-center gap-1 hover:underline shrink-0"
        >
          Manage <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
