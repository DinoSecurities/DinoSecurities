import { useMemo } from "react";
import { Loader2, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useHolderBalances } from "@/hooks/useHolderBalances";
import { computeConcentration } from "@/lib/concentration";

interface Props {
  mint: string;
}

/**
 * Concentration card for a single series. HHI, top-N shares, Gini.
 * Everything derives from live token-account balances so the card tracks
 * the cap table without an indexing lag.
 */
export default function ConcentrationCard({ mint }: Props) {
  const balances = useHolderBalances(mint);
  const stats = useMemo(
    () => (balances.data ? computeConcentration(balances.data) : null),
    [balances.data],
  );

  if (balances.isLoading) {
    return (
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Concentration
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin inline mr-1" /> Scanning token accounts…
        </div>
      </div>
    );
  }

  if (!stats || stats.holderCount === 0) {
    return (
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Concentration
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Users size={12} /> No token accounts with a balance yet.
        </div>
      </div>
    );
  }

  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const hhiColor =
    stats.hhiLabel === "competitive"
      ? "text-emerald-400"
      : stats.hhiLabel === "moderate"
      ? "text-amber-400"
      : "text-red-400";

  const chartRows = stats.rows.map((r) => ({
    label: r.label,
    share: Number((r.share * 100).toFixed(2)),
    owner: r.owner,
  }));

  return (
    <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Concentration
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          {stats.holderCount} holder{stats.holderCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className={`text-3xl font-semibold ${hhiColor}`}>
          {Math.round(stats.hhi).toLocaleString()}
        </span>
        <span className={`text-[10px] uppercase tracking-widest font-semibold ${hhiColor}`}>
          {stats.hhiLabel}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground ml-auto">
          HHI
        </span>
      </div>

      {stats.holderCount < 10 && (
        <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-400/5 border border-amber-400/30 p-2">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>
            Thin holder base ({stats.holderCount}) — HHI is mechanically inflated and less
            informative below 10 holders.
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Top 5", stats.top5Share],
          ["Top 10", stats.top10Share],
          ["Top 25", stats.top25Share],
        ].map(([label, v]) => (
          <div key={label as string} className="border border-border bg-background/40 p-2 flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
              {label as string}
            </span>
            <span className="text-sm font-mono text-foreground font-semibold">
              {formatPct(v as number)}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
          Distribution (top 25 + Others)
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "currentColor", opacity: 0.6 }}
              interval={Math.max(1, Math.floor(chartRows.length / 8))}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "currentColor", opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={32}
            />
            <Tooltip
              cursor={{ opacity: 0.1 }}
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                fontSize: 11,
              }}
              formatter={(v: number, _name, entry: { payload?: { owner?: string | null } }) => [
                `${v.toFixed(2)}%`,
                entry.payload?.owner ?? "aggregated",
              ]}
            />
            <Bar dataKey="share" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Gini
        </span>
        <span className="text-xs font-mono text-foreground">
          {stats.gini.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
