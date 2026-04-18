import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Gauge, Loader2, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";

interface ReconRow {
  mint: string;
  symbol: string | null;
  onChainReported: string;
  sumOfAtas: string;
  distributedHolderFloat: string;
  mintAuthorityHolding: string;
  burned: string;
  delta: string;
  healthy: boolean;
  tokenAccountCount: number;
  checkedAt: string;
  error?: string;
}

/**
 * Admin Supply Reconciliation Dashboard. Lists every SecuritySeries on
 * chain and asserts per-series that the on-chain `current_supply`
 * matches the sum of live Token-2022 account balances. A non-zero delta
 * is the canary: indexer drift, token leak, program bug. Green check
 * or red warning per row; human looks when red.
 */
const SupplyReconciliation = () => {
  const q = useQuery({
    queryKey: ["admin.supplyReconciliationAll"],
    queryFn: () => trpc.admin.supplyReconciliationAll.query(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows = (q.data ?? []) as unknown as ReconRow[];
  const unhealthy = rows.filter((r) => !r.healthy).length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/issue"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Issuer Portal
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gauge size={16} className="text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Admin / Supply Reconciliation
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Supply Reconciliation
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            For every series on chain, this asserts that{" "}
            <span className="font-mono text-foreground">SecuritySeries.current_supply</span>{" "}
            equals the sum of every live Token-2022 account balance for that mint. A
            non-zero delta means drift — indexer lag, a missed burn, a program bug — and is
            surfaced here before anyone else notices.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-secondary flex items-center gap-1.5 disabled:opacity-40"
          >
            {q.isFetching ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <RefreshCw size={10} />
            )}
            Refresh
          </button>
          <span className="text-[10px] text-muted-foreground">Auto-refreshes every 60s</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile
          label="Series"
          value={q.isLoading ? "—" : String(rows.length)}
          tone="neutral"
        />
        <StatTile
          label="Healthy"
          value={q.isLoading ? "—" : String(rows.length - unhealthy)}
          tone={unhealthy === 0 ? "good" : "neutral"}
        />
        <StatTile
          label="Drifted"
          value={q.isLoading ? "—" : String(unhealthy)}
          tone={unhealthy === 0 ? "neutral" : "bad"}
        />
      </div>

      {q.isLoading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Scanning every series
          on chain…
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-border p-12 text-center flex flex-col items-center gap-2">
          <Gauge size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No series on chain yet</div>
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Series</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Reported</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Σ ATAs</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Issuer float</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Accounts</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Delta</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .sort((a, b) => Number(a.healthy) - Number(b.healthy)) // unhealthy first
                .map((r) => (
                  <tr
                    key={r.mint}
                    className={`border-b border-border/30 last:border-b-0 ${
                      r.healthy ? "" : "bg-red-400/5"
                    }`}
                  >
                    <td className="p-3 text-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {r.symbol ?? truncateAddress(r.mint)}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {truncateAddress(r.mint)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-xs font-mono">
                      {Number(r.onChainReported).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-xs font-mono">
                      {Number(r.sumOfAtas).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-xs font-mono text-muted-foreground">
                      {Number(r.mintAuthorityHolding).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      {r.tokenAccountCount}
                    </td>
                    <td
                      className={`p-3 text-right text-xs font-mono ${
                        r.healthy ? "text-muted-foreground" : "text-red-400 font-semibold"
                      }`}
                    >
                      {r.delta === "0" ? "0" : Number(r.delta).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {r.error ? (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5"
                          title={r.error}
                        >
                          <AlertTriangle size={10} /> Error
                        </span>
                      ) : r.healthy ? (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5">
                          <CheckCircle2 size={10} /> Healthy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5">
                          <AlertTriangle size={10} /> Drift
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-foreground";
  return (
    <div className="border border-border bg-background/40 p-4 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
      </span>
      <span className={`text-2xl font-semibold font-mono ${color}`}>{value}</span>
    </div>
  );
}

export default SupplyReconciliation;
