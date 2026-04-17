import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";

/**
 * Audit-log view of all sanctions overrides ever filed. Append-only,
 * immutable, readable by anyone — this is the transparency surface that
 * lets auditors verify the platform isn't silently whitelisting
 * sanctions matches. Each row shows who, what, when, and why.
 */
const SanctionsOverrides = () => {
  const overrides = useQuery({
    queryKey: ["sanctions.listOverrides"],
    queryFn: () => trpc.sanctions.listOverrides.query({ limit: 100 }),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/issue"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Issuer Portal
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Compliance / Sanctions
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Override Audit Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every sanctions-match override filed on this platform, in order. Rows are append-only
            and immutable; revoked overrides remain in history with a status change.
          </p>
        </div>
      </div>

      {overrides.isLoading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Loading overrides…
        </div>
      ) : !overrides.data || overrides.data.length === 0 ? (
        <div className="border border-border p-12 text-center flex flex-col items-center gap-2">
          <Shield size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No overrides on file</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Zero sanctions-match overrides have been filed. Every holder whitelisted on the
            platform either passed a clean screen, or had an override authorized by an admin and
            logged here.
          </p>
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">#</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Wallet</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Series</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Sources</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Justification</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Admin</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Filed</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {overrides.data.map((o) => (
                <tr key={o.id} className="border-b border-border/30 last:border-b-0 hover:bg-secondary/20 transition-colors">
                  <td className="p-4 text-xs font-mono text-muted-foreground">#{o.id}</td>
                  <td className="p-4 text-xs font-mono text-foreground">{truncateAddress(o.wallet)}</td>
                  <td className="p-4 text-xs font-mono text-muted-foreground">
                    {o.seriesMint ? truncateAddress(o.seriesMint) : "(all)"}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {o.matchedSources.map((s) => (
                        <span key={s} className="text-[9px] uppercase tracking-widest bg-red-400/10 border border-red-400/30 text-red-400 px-1.5 py-0.5 font-semibold">
                          {s.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground max-w-xs truncate" title={o.justification}>
                    {o.justification}
                  </td>
                  <td className="p-4 text-xs font-mono text-muted-foreground">{truncateAddress(o.adminWallet)}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-4 text-right">
                    {o.status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5">
                        <AlertTriangle size={10} /> Active
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        Revoked
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

export default SanctionsOverrides;
