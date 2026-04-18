import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, Coins, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDinoTier } from "@/hooks/useDinoBalance";
import { truncateAddress } from "@/lib/solana";

/**
 * Gold-tier preview surface for the marketplace. Lists every series
 * whose `publicListingAt` is still in the future. Non-Gold callers
 * get an empty response from the tRPC endpoint and see the locked
 * state below; a determined non-Gold caller cannot browse the mint
 * addresses from here.
 */
const MarketplaceUpcoming = () => {
  const { tier, loading } = useDinoTier();

  const listings = useQuery({
    queryKey: ["issuerAccess.upcomingListings"],
    queryFn: () => trpc.issuerAccess.upcomingListings.query(),
    enabled: tier.id >= 3,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/marketplace"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Marketplace
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Gold-only / Upcoming
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Upcoming Series
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Series the issuer has scheduled for public listing. Gold-tier holders see the
          roster 48+ hours early. The series are already on chain — the gate is discovery,
          not access.
        </p>
      </div>

      {loading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Checking your tier…
        </div>
      ) : tier.id < 3 ? (
        <div className="border border-amber-400/30 bg-amber-400/5 p-6 flex items-start gap-3">
          <Lock size={16} className="text-amber-400 mt-1 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground mb-1">Gold tier required</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Early access to upcoming listings is a Gold-tier perk (5,000,000 $DINO). Your
              current tier is <span className="font-semibold text-foreground">{tier.name}</span>.
            </p>
            <Link
              to="/app/dino"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary hover:underline"
            >
              <Coins size={11} /> View $DINO tiers →
            </Link>
          </div>
        </div>
      ) : listings.isLoading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Loading schedule…
        </div>
      ) : !listings.data || listings.data.length === 0 ? (
        <div className="border border-border p-12 text-center flex flex-col items-center gap-2">
          <Clock size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No upcoming series</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            No issuer has scheduled a preview listing. This page refills when someone does.
          </p>
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Mint</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Public listing at</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Preview</th>
              </tr>
            </thead>
            <tbody>
              {listings.data.map((l) => (
                <tr key={l.mint} className="border-b border-border/30 last:border-b-0">
                  <td className="p-3 text-xs font-mono">{truncateAddress(l.mint)}</td>
                  <td className="p-3 text-xs">
                    {new Date(l.publicListingAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/app/marketplace/${l.mint}`}
                      className="text-[10px] uppercase tracking-widest text-primary hover:underline"
                    >
                      View →
                    </Link>
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

export default MarketplaceUpcoming;
