import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export interface IndexedSecurity {
  mintAddress: string;
  issuer: string;
  name: string;
  symbol: string;
  securityType: string;
  jurisdiction: string;
  maxSupply: number;
  currentSupply: number;
  transferRestrictions: string;
  status: string;
}

/**
 * Fetch all securities indexed by the backend (populated from Helius webhook
 * events). Cheaper than getProgramAccounts for list views; on-chain hooks
 * remain the source of truth for state-changing operations.
 */
export function useIndexedSecurities() {
  return useQuery({
    queryKey: ["indexedSecurities"],
    queryFn: async (): Promise<IndexedSecurity[]> => {
      const res = await trpc.securities.list.query({});
      return (res.items as IndexedSecurity[]) ?? [];
    },
    staleTime: 30_000,
  });
}

export function useIndexedSecurityByMint(mint: string | undefined) {
  return useQuery({
    queryKey: ["indexedSecurity", mint],
    queryFn: async (): Promise<IndexedSecurity | null> => {
      if (!mint) return null;
      try {
        const res = await trpc.securities.getByMint.query({ mint });
        return res as IndexedSecurity | null;
      } catch {
        return null;
      }
    },
    enabled: !!mint,
    staleTime: 30_000,
  });
}
