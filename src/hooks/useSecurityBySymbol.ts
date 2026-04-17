import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

/** Public symbol → series lookup. Used by the embeddable issuer widget. */
export function useSecurityBySymbol(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ["securities.getBySymbol", symbol],
    queryFn: () => trpc.securities.getBySymbol.query({ symbol: symbol! }),
    enabled: Boolean(symbol),
    staleTime: 60_000,
  });
}
