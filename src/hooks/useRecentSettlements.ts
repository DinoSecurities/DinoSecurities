import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

/**
 * Recent successful mainnet settlements, used by the landing page to render
 * every perf claim (finality, fee, atomicity) as a live link to a real tx.
 *
 * Stale-while-revalidate for 60 s — the landing page is mostly static, we
 * don't need sub-minute freshness.
 */
export function useRecentSettlements(limit = 5) {
  return useQuery({
    queryKey: ["analytics.recentSettlements", limit],
    queryFn: () => trpc.analytics.recentSettlements.query({ limit }),
    staleTime: 60_000,
    retry: 1,
  });
}

export type RecentSettlementItem = {
  signature: string;
  settledAt: string | null;
  finalityMs: number | null;
  feeSol: number | null;
  slot: number | null;
  usdc: number;
  tokens: number;
  mint: string;
};

export type RecentSettlementsResponse = {
  items: RecentSettlementItem[];
  aggregates: {
    avgFinalityMs: number | null;
    avgFeeSol: number | null;
    totalSettlements: number;
    samplesWithFinality: number;
  };
};
