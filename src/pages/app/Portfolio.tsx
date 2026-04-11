import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Download, Filter } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { holdings, portfolioChartData, allocationData, recentActivity } from "@/lib/mockData";

const Portfolio = () => {
  const [activeTab, setActiveTab] = useState<"holdings" | "activity">("holdings");
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border bg-gradient-to-b from-primary to-primary/90 p-6"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 20px rgba(139,92,246,0.12)" }}>
          <span className="text-[10px] uppercase tracking-widest text-primary-foreground/60 font-semibold">Total Value</span>
          <div className="text-4xl font-semibold text-primary-foreground tracking-tight mt-2">${totalValue.toLocaleString()}</div>
        </div>
        <div className="border border-border bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total P&L</span>
          <div className={`text-4xl font-semibold tracking-tight mt-2 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground">{((totalPnl / totalCost) * 100).toFixed(1)}% all time</span>
        </div>
        <div className="border border-border bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Cost Basis</span>
          <div className="text-4xl font-semibold text-foreground tracking-tight mt-2">${totalCost.toLocaleString()}</div>
          <span className="text-xs text-muted-foreground">{holdings.length} positions</span>
        </div>
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Performance</span>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioChartData}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(270, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(270, 70%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(0,0%,45%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(0,0%,45%)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,3.9%)", border: "1px solid hsl(0,0%,100%,0.1)", borderRadius: 0, fontSize: 12 }} formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]} />
                <Area type="monotone" dataKey="value" stroke="hsl(270,70%,55%)" strokeWidth={2} fill="url(#perfGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-4 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-4 self-start">Allocation</span>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} strokeWidth={0}>
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,3.9%)", border: "1px solid hsl(0,0%,100%,0.1)", borderRadius: 0, fontSize: 12 }} formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} />
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
      </div>

      {/* Tabs: Holdings / Activity */}
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
          <button className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors">
            <Download size={16} />
          </button>
          <button className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors">
            <Filter size={16} />
          </button>
        </div>

        {activeTab === "holdings" && (
          <div className="border border-t-0 border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Balance</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Price</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Value</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Cost Basis</th>
                  <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.security.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-4">
                      <Link to={`/app/marketplace/${h.security.mintAddress}`} className="flex items-center gap-3 group">
                        <div className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                          h.security.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                          h.security.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                          h.security.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                          "bg-purple-500/20 border-purple-500/40 text-purple-400"
                        }`}>{h.security.type[0]}</div>
                        <div>
                          <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{h.security.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">{h.security.name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 text-right"><span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">{h.security.type}</span></td>
                    <td className="p-4 text-right font-mono text-xs text-foreground">{h.balance.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-xs text-foreground hidden md:table-cell">${h.security.price.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono text-xs text-foreground font-semibold">${h.value.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">${h.costBasis.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {h.pnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        ${Math.abs(h.pnl).toLocaleString()} ({h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent.toFixed(1)}%)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="border border-t-0 border-border divide-y divide-border/30">
            {recentActivity.map((a) => (
              <div key={a.id} className="p-4 hover:bg-secondary/20 transition-colors flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-8 h-8 flex items-center justify-center text-xs font-bold border shrink-0 ${
                    a.type === "settlement" ? "bg-primary/20 border-primary/40 text-primary" :
                    a.type === "vote" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" :
                    a.type === "transfer" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                    a.type === "mint" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                    "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  }`}>{a.type[0].toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.description}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {a.amount && <div className="text-sm font-semibold text-foreground">{a.amount}</div>}
                  <div className="text-[10px] text-muted-foreground/60">{a.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
