import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_IDS } from "@/lib/solana";
import { SECURITY_TYPES, TRANSFER_RESTRICTIONS } from "@/lib/constants";
import type { SecuritySeries, SecurityType, TransferRestriction } from "@/types/security";
import { PublicKey, SystemProgram } from "@solana/web3.js";

// Until the real Anchor program is deployed, we use mock data as fallback
import { securities as mockSecurities } from "@/lib/mockData";

/**
 * Decode a raw SecuritySeries account buffer into our typed interface.
 * This is a placeholder — the real decoder will use Anchor's BorshAccountsCoder.
 */
function decodeSecuritySeries(_data: Buffer, _pubkey: PublicKey): SecuritySeries | null {
  // TODO: Implement real Borsh deserialization when program is deployed
  return null;
}

/**
 * Fetch all security series. Falls back to mock data if program isn't deployed.
 */
export function useAllSecuritySeriesData() {
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["securitySeriesData", programDeployed],
    queryFn: async (): Promise<SecuritySeries[]> => {
      if (!programDeployed) {
        // Fallback to mock data mapped to our real interface
        return mockSecurities.map((s) => ({
          mint: new PublicKey("11111111111111111111111111111111"),
          issuer: new PublicKey("11111111111111111111111111111111"),
          name: s.name,
          symbol: s.symbol,
          securityType: s.type as SecurityType,
          docHash: s.documentHash,
          docUri: "",
          isin: "",
          maxSupply: s.totalSupply,
          currentSupply: s.circulatingSupply,
          transferRestrictions: (s.regulation.replace(" ", "") as TransferRestriction) || "None",
          jurisdiction: s.jurisdiction,
          status: s.status,
          governance: null,
          createdAt: new Date(s.createdAt).getTime() / 1000,
        }));
      }

      // Fetch real on-chain data
      const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
        commitment: "confirmed",
        filters: [
          // Filter for SecuritySeries accounts by discriminator
          // The 8-byte discriminator will be set by Anchor
          { dataSize: 680 },
        ],
      });

      const series: SecuritySeries[] = [];
      for (const { pubkey, account } of accounts) {
        const decoded = decodeSecuritySeries(account.data as Buffer, pubkey);
        if (decoded) series.push(decoded);
      }

      return series;
    },
    staleTime: 30_000,
  });
}

/**
 * Fetch a single security series by ID (from mock data) or mint (from chain).
 */
export function useSecuritySeriesById(id: string | undefined) {
  return useQuery({
    queryKey: ["securitySeriesById", id],
    queryFn: async () => {
      if (!id) return null;

      // Fallback to mock while program isn't deployed
      const mock = mockSecurities.find(
        (s) => s.id === id || s.mintAddress === id || s.symbol === id,
      );
      return mock || null;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
