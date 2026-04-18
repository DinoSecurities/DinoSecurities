import { Link } from "react-router-dom";
import { ArrowLeft, Coins, ExternalLink, CheckCircle2, Loader2, Clock } from "lucide-react";
import { useDinoTier } from "@/hooks/useDinoBalance";
import {
  DINO_TIERS,
  DINO_MINT,
  DINO_PUMPFUN_URL,
  DINO_FEE_SURFACES,
  nextTier,
} from "@/lib/dinoToken";
import { truncateAddress } from "@/lib/solana";
import ApiKeysPanel from "@/components/ApiKeysPanel";
import HandleClaimPanel from "@/components/HandleClaimPanel";

/**
 * $DINO Tiers page — the canonical surface explaining the memecoin's
 * utility. Shows the holder's current tier live, a full schedule of
 * tiers + discounts, every fee surface the discount applies to (with
 * honest "live" vs "planned" status), and a clear regulatory note
 * that $DINO is not a security.
 */
const DinoTiers = () => {
  const { balance, tier, loading } = useDinoTier();
  const next = nextTier(balance);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Dashboard
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Coins size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Community / $DINO
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          $DINO Tiers
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          $DINO is the DinoSecurities community token. Holding it unlocks discounts
          on platform services — issuer deployment fees, document uploads, API
          overage. Tiers scale with balance; discount is applied at the point of
          payment. Non-custodial: the platform reads your balance via standard RPC
          and never takes custody.
        </p>
      </div>

      <div className="border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Your current tier
            </div>
            <div className="flex items-baseline gap-3">
              {loading ? (
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className={`text-3xl font-semibold ${tier.accentClass}`}>
                    {tier.name}
                  </span>
                  <span className="text-sm text-foreground">
                    {tier.discountPct}% off
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Holding <span className="font-mono text-foreground">{balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> $DINO
            </div>
            {next && (
              <div className="text-[11px] text-muted-foreground mt-2">
                Acquire{" "}
                <span className="font-mono text-foreground">
                  {Math.max(0, next.minBalance - balance).toLocaleString()}
                </span>{" "}
                more $DINO to reach {next.name} ({next.discountPct}% off).
              </div>
            )}
          </div>
          <a
            href={DINO_PUMPFUN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-widest bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 flex items-center gap-1.5"
          >
            Acquire on pump.fun <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Tier schedule
        </div>
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tier</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Minimum $DINO</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Discount</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {DINO_TIERS.map((t) => {
                const active = tier.id === t.id;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border/30 last:border-b-0 ${
                      active ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="p-3">
                      <span className={`text-sm font-semibold ${t.accentClass}`}>
                        {t.name}
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs font-mono">
                      {t.minBalance.toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-xs font-semibold">
                      {t.discountPct}%
                    </td>
                    <td className="p-3 text-right">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Where your tier applies
        </div>
        <div className="flex flex-col gap-2">
          {DINO_FEE_SURFACES.map((s) => (
            <div key={s.id} className="border border-border p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{s.label}</span>
                    {s.status === "live" ? (
                      <span className="text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5">
                        <Clock size={9} /> Planned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {tier.discountPct > 0 && (
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Your rate</div>
                    <div className="text-sm font-semibold text-primary">
                      −{tier.discountPct}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <HandleClaimPanel currentTierId={tier.id} />

      <ApiKeysPanel currentTierId={tier.id} />

      <div className="border border-border bg-secondary/20 p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Regulatory posture
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          $DINO is the DinoSecurities community token, <span className="text-foreground font-semibold">not a security</span>.
          Holding $DINO does not confer equity in the platform, a claim on
          platform revenue, a right to distributions, or governance over the
          regulated securities infrastructure. Utility is limited to discounts on
          platform service fees and access-based perks. The platform's regulated
          securities (SecuritySeries on-chain, compliance-gated by KYC / sanctions
          screening / transfer-hook validation) are entirely separate.
        </p>
        <div className="text-[10px] text-muted-foreground mt-3 font-mono">
          Mint · {truncateAddress(DINO_MINT.toBase58())}
        </div>
      </div>
    </div>
  );
};

export default DinoTiers;
