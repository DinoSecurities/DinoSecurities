import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export interface TokenAccountInfo {
  mint: PublicKey;
  owner: PublicKey;
  balance: number;
  decimals: number;
}

/**
 * Fetch all Token-2022 token accounts for the connected wallet.
 * DinoSecurities tokens use Token-2022 (not the legacy Token program).
 */
export function useMyTokenBalances() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["tokenBalances", publicKey?.toBase58()],
    queryFn: async (): Promise<TokenAccountInfo[]> => {
      if (!publicKey) return [];

      const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      });

      return response.value.map((item) => {
        const parsed = item.account.data.parsed.info;
        return {
          mint: new PublicKey(parsed.mint),
          owner: new PublicKey(parsed.owner),
          balance: parsed.tokenAmount.uiAmount ?? 0,
          decimals: parsed.tokenAmount.decimals,
        };
      });
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch balance for a specific Token-2022 mint
 */
export function useTokenBalance(mint: PublicKey | null) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["tokenBalance", publicKey?.toBase58(), mint?.toBase58()],
    queryFn: async (): Promise<number> => {
      if (!publicKey || !mint) return 0;

      const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint,
        programId: TOKEN_2022_PROGRAM_ID,
      });

      if (response.value.length === 0) return 0;

      const parsed = response.value[0].account.data.parsed.info;
      return parsed.tokenAmount.uiAmount ?? 0;
    },
    enabled: !!publicKey && !!mint,
    staleTime: 15_000,
  });
}

/**
 * Fetch the SOL balance for the connected wallet
 */
export function useSolBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["solBalance", publicKey?.toBase58()],
    queryFn: async (): Promise<number> => {
      if (!publicKey) return 0;
      const balance = await connection.getBalance(publicKey);
      return balance / 1_000_000_000;
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
