import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export interface HolderBalance {
  owner: string;
  amount: bigint;
}

/**
 * Scan every Token-2022 token account for a given mint and return
 * (owner, amount) pairs. The raw token-account layout is standardised:
 *
 *   [0..32)  mint
 *   [32..64) owner
 *   [64..72) amount (u64 LE)
 *
 * We rely on RPC-side filtering (`dataSize: 165` + a memcmp on the mint
 * at offset 0) so the response is small even for popular mints.
 */
export function useHolderBalances(mint: string | undefined) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["holderBalances", mint],
    queryFn: async (): Promise<HolderBalance[]> => {
      if (!mint) return [];
      const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
        commitment: "confirmed",
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint } },
        ],
      });
      const rows: HolderBalance[] = [];
      for (const { account } of accounts) {
        const data = account.data as Buffer;
        if (data.length < 72) continue;
        const owner = new PublicKey(data.subarray(32, 64)).toBase58();
        const amount = data.readBigUInt64LE(64);
        rows.push({ owner, amount });
      }
      return rows;
    },
    enabled: !!mint,
    staleTime: 60_000,
  });
}
