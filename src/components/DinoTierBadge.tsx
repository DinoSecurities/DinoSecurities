import { Link } from "react-router-dom";
import { Coins, Loader2 } from "lucide-react";
import { useDinoTier } from "@/hooks/useDinoBalance";
import { nextTier } from "@/lib/dinoToken";

/**
 * Compact $DINO tier badge. Surfaces the connected wallet's tier
 * alongside a discount summary and a "next tier at …" progress hint.
 * Designed to slot into the Dashboard or any portal sidebar — tight
 * width, no layout-shift on load.
 */
export default function DinoTierBadge({ className }: { className?: string }) {
  const { balance, tier, loading } = useDinoTier();
  const next = nextTier(balance);

  return (
    <Link
      to="/app/dino"
      className={`block border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-4 hover:border-primary/40 transition-colors ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Coins size={14} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            $DINO Tier
          </span>
        </div>
        {loading ? (
          <Loader2 size={10} className="animate-spin text-muted-foreground" />
        ) : (
          <span className={`text-[10px] uppercase tracking-widest font-semibold ${tier.accentClass}`}>
            {tier.name}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold font-mono text-foreground">
          {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-[10px] text-muted-foreground">$DINO</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">
        {tier.discountPct > 0
          ? `${tier.discountPct}% off platform fees`
          : "No discount active"}
      </div>
      {next && (
        <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
          {Math.max(0, next.minBalance - balance).toLocaleString()} more to {next.name} ·{" "}
          {next.discountPct}% off
        </div>
      )}
    </Link>
  );
}
