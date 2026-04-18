import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  mint: string;
  variant?: "default" | "compact";
}

/**
 * "Supported by the $DINO community" badge on a series surface. Renders
 * when the issuer's wallet holds ≥ Bronze tier. If the issuer has also
 * claimed a community handle, it's surfaced as "Supported by @handle"
 * — the most personal form of the badge. Silent (renders nothing) for
 * non-supporter issuers.
 */
export default function SeriesSupportBadge({ mint, variant = "default" }: Props) {
  const q = useQuery({
    queryKey: ["dino.issuerTierForSeries", mint],
    queryFn: () => trpc.dino.issuerTierForSeries.query({ mint }),
    staleTime: 5 * 60_000,
  });

  if (!q.data?.supported) return null;
  const { tier, handleDisplay } = q.data;
  const label = handleDisplay
    ? `Supported by @${handleDisplay}`
    : `${tier.name}-tier supporter`;

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
        <Coins size={9} /> {label}
      </span>
    );
  }

  return (
    <div className="border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
      <Coins size={14} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">
          $DINO Community
        </div>
        <div className="text-xs text-foreground mt-0.5">
          {label}
          <span className="text-muted-foreground ml-2 text-[10px] font-mono">
            · {tier.name}
          </span>
        </div>
      </div>
    </div>
  );
}
