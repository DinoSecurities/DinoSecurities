import { AlertTriangle } from "lucide-react";

/**
 * Disclaimer banner rendered at the top of every community-governance
 * page. The legal line we're drawing depends on this language being
 * present and unambiguous wherever community votes are surfaced.
 *
 * Do not soften or remove without legal review.
 */
export default function NonSecurityBanner() {
  return (
    <div className="border border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
      <AlertTriangle size={14} className="text-amber-400 mt-1 shrink-0" />
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold mb-1">
          Community — Not Securities Governance
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Votes on this surface are <span className="text-foreground font-semibold">advisory only</span>.
          They do not execute on-chain, move any treasury, affect any regulated security on
          the platform, or confer any authority over an issuer, holder record, or token
          transfer. Outcomes are recorded and considered by the DinoSecurities team;
          implementation is manual and off-platform. $DINO voting weight here is distinct
          from on-chain securities governance, which lives at{" "}
          <span className="font-mono">/app/governance</span> and uses security-token balances.
        </p>
      </div>
    </div>
  );
}
