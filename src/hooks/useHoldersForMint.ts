import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export interface HolderRow {
  pda?: string;
  wallet: string;
  mintAddress?: string;
  mint?: string;
  kycHash: string | null;
  kycExpiry?: string | number | Date | null;
  isAccredited: boolean;
  isFrozen: boolean;
  isRevoked: boolean;
  jurisdiction?: string;
}

/**
 * Holders for a given security mint. Hits the backend's indexed_holders
 * table with a direct on-chain scan as fallback.
 */
export function useHoldersForMint(mint: string | undefined) {
  return useQuery({
    queryKey: ["holdersForMint", mint],
    queryFn: async (): Promise<HolderRow[]> => {
      if (!mint) return [];
      const rows = await trpc.holders.getForSeries.query({ mint });
      return (rows as HolderRow[]) ?? [];
    },
    enabled: !!mint,
    staleTime: 30_000,
  });
}
