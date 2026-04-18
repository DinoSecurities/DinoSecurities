import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export interface DinoHandleLookup {
  displayHandle: string;
  handle: string;
}

/**
 * Resolve a single wallet to its $DINO community handle. Returns null
 * when the wallet hasn't claimed one. Cache is aggressive (5 min) —
 * handles churn slowly and claim events are rare.
 */
export function useHandleFor(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ["dinoHandles.resolve", wallet],
    queryFn: async () => {
      if (!wallet) return null;
      return trpc.dinoHandles.resolve.query({ wallet });
    },
    enabled: !!wallet,
    staleTime: 5 * 60_000,
  });
}

/**
 * Batched resolver. Call once per rendered list; downstream components
 * read from the returned map by address. Cheaper than one tRPC call
 * per row (which would thundering-herd the backend for a long holder
 * list).
 */
export function useHandlesFor(wallets: string[]) {
  const key = wallets.slice().sort().join(",");
  return useQuery({
    queryKey: ["dinoHandles.resolveMany", key],
    queryFn: async (): Promise<Record<string, DinoHandleLookup>> => {
      if (wallets.length === 0) return {};
      return trpc.dinoHandles.resolveMany.query({ wallets });
    },
    enabled: wallets.length > 0,
    staleTime: 5 * 60_000,
  });
}
