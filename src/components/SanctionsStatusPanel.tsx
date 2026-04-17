import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Sanctions-screening status card for the Issuer Portal. Shows:
 *
 *   - Health of the three upstream lists (entry counts + last refresh).
 *   - Count of active overrides across the platform.
 *   - A link to the full override audit log.
 *
 * Rendering is always green-path on the happy case (three source counts
 * visible, zero active overrides). Any non-zero override count surfaces
 * an amber "review overrides" affordance so the issuer admin is always
 * aware of any authorized-despite-match holders.
 */
export default function SanctionsStatusPanel() {
  const stats = useQuery({
    queryKey: ["sanctions.stats"],
    queryFn: () => trpc.sanctions.stats.query(),
    staleTime: 60_000,
  });

  const entryMap = new Map(
    (stats.data?.entriesBySource ?? []).map((r) => [r.source, r.count]),
  );
  const total = (stats.data?.entriesBySource ?? []).reduce((a, r) => a + r.count, 0);
  const activeOverrides = stats.data?.activeOverrides ?? 0;

  return (
    <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-foreground font-semibold">
            Sanctions Screening
          </span>
        </div>
        {stats.isLoading ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5">
            <CheckCircle2 size={10} /> Active
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Every <span className="font-mono text-foreground">register_holder</span> call is screened
        against OFAC SDN, EU Consolidated, and UK HMT lists before the
        oracle co-signs. Matches block the co-sign unless an issuer admin
        files an override with justification.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { key: "ofac_sdn", label: "OFAC SDN" },
          { key: "eu_consolidated", label: "EU" },
          { key: "uk_hmt", label: "UK HMT" },
        ].map(({ key, label }) => (
          <div key={key} className="p-3 border border-border bg-background/40 flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
              {label}
            </span>
            <span className="text-sm font-mono text-foreground font-semibold">
              {entryMap.get(key)?.toLocaleString() ?? "—"}
            </span>
            <span className="text-[9px] text-muted-foreground">entries</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Cached
        </span>
        <span className="text-xs font-mono text-foreground">
          {total.toLocaleString()} wallet{total === 1 ? "" : "s"} total
        </span>
      </div>

      {activeOverrides > 0 ? (
        <Link
          to="/app/issue/overrides"
          className="mt-4 flex items-center justify-between gap-2 px-3 py-2.5 border border-amber-400/40 bg-amber-400/10 text-amber-400 text-[10px] uppercase tracking-widest font-semibold hover:bg-amber-400/15 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={12} /> {activeOverrides} active override{activeOverrides === 1 ? "" : "s"}
          </span>
          <span>Review →</span>
        </Link>
      ) : (
        <div className="mt-4 text-[11px] text-muted-foreground text-center">
          No active overrides
        </div>
      )}

      <Link
        to="/app/issue/xrpl-credentials"
        className="mt-2 block text-center text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        Trust layer: XRPL credential issuers →
      </Link>
    </div>
  );
}
