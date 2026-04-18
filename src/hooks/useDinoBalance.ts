import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DINO_MINT, tierForBalance, type DinoTier } from "@/lib/dinoToken";

/**
 * $DINO balance for the connected wallet. Classic SPL — pump.fun
 * tokens live on the legacy Token program, not Token-2022, so the
 * existing useTokenBalance hook (which defaults to Token-2022) does
 * not cover this. Refreshes every 30s while the wallet is connected.
 */
export function useDinoBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["dinoBalance", publicKey?.toBase58()],
    queryFn: async (): Promise<number> => {
      if (!publicKey) return 0;
      const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: DINO_MINT,
        programId: TOKEN_PROGRAM_ID,
      });
      if (response.value.length === 0) return 0;
      const parsed = response.value[0].account.data.parsed.info;
      return Number(parsed.tokenAmount.uiAmount ?? 0);
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export interface DinoTierState {
  balance: number;
  tier: DinoTier;
  loading: boolean;
}

/**
 * Convenience: returns the resolved tier for the connected wallet.
 * Components wanting just "what discount does this user get" should
 * use this directly rather than calling useDinoBalance + tierForBalance
 * themselves.
 */
export function useDinoTier(): DinoTierState {
  const { data, isLoading } = useDinoBalance();
  const balance = data ?? 0;
  return {
    balance,
    tier: tierForBalance(balance),
    loading: isLoading,
  };
}
