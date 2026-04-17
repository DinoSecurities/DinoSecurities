import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export interface MySettlementRow {
  orderId: string;
  role: "buyer" | "seller";
  mint: string;
  tokenAmount: number;
  usdcAmount: number;
  status: string;
  txSignature: string | null;
  settledAt: string | null;
  createdAt: string | null;
  finalityMs: number | null;
  receiptUrl: string | null;
}

/**
 * Settled orders where the connected wallet was buyer or seller,
 * decorated with a Rule 10b-10-style trade-confirmation PDF URL.
 */
export function useMySettlements(wallet: string | null | undefined, limit = 50) {
  return useQuery({
    queryKey: ["settlements.getMySettlements", wallet, limit],
    queryFn: () =>
      trpc.settlements.getMySettlements.query({
        wallet: wallet!,
        limit,
      }) as Promise<MySettlementRow[]>,
    enabled: Boolean(wallet),
    staleTime: 30_000,
  });
}
