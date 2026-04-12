import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { deriveHolderRecordPDA, PROGRAM_IDS } from "@/lib/solana";
import type { HolderRecord, KYCStatus } from "@/types/holder";

/**
 * Fetch the HolderRecord PDA for a specific mint + holder combination
 */
export function useHolderRecord(mint: PublicKey | null, holder: PublicKey | null) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["holderRecord", mint?.toBase58(), holder?.toBase58()],
    queryFn: async (): Promise<HolderRecord | null> => {
      if (!mint || !holder) return null;

      const [pda] = deriveHolderRecordPDA(mint, holder);
      const account = await connection.getAccountInfo(pda);

      if (!account || !account.owner.equals(PROGRAM_IDS.DINO_CORE)) {
        return null;
      }

      // TODO: Decode with Anchor BorshAccountsCoder when program is deployed
      // For now return a placeholder structure
      return null;
    },
    enabled: !!mint && !!holder && !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId),
    staleTime: 60_000,
  });
}

/**
 * Fetch the current user's KYC status across all their holder records
 */
export function useMyKYCStatus() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["myKYCStatus", publicKey?.toBase58()],
    queryFn: async (): Promise<{
      status: KYCStatus;
      isAccredited: boolean;
      expiresAt: number | null;
    }> => {
      if (!publicKey || !programDeployed) {
        // Fallback mock KYC status
        return {
          status: "verified",
          isAccredited: true,
          expiresAt: Date.now() / 1000 + 365 * 24 * 60 * 60, // 1 year from now
        };
      }

      // Fetch all HolderRecord PDAs for this wallet by scanning
      const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
        commitment: "confirmed",
        filters: [
          { dataSize: 116 }, // HolderRecord size
          {
            memcmp: {
              offset: 40, // After discriminator (8) + mint (32)
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      if (accounts.length === 0) {
        return { status: "pending", isAccredited: false, expiresAt: null };
      }

      // TODO: Decode the first record and return real data
      return { status: "verified", isAccredited: false, expiresAt: null };
    },
    enabled: !!publicKey,
    staleTime: 60_000,
  });
}

/**
 * Fetch all holders for a specific security series mint
 */
export function useHoldersForSeries(mint: PublicKey | null) {
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["holdersForSeries", mint?.toBase58()],
    queryFn: async (): Promise<HolderRecord[]> => {
      if (!mint || !programDeployed) return [];

      const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
        commitment: "confirmed",
        filters: [
          { dataSize: 116 },
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: mint.toBase58(),
            },
          },
        ],
      });

      // TODO: Decode each account
      return [];
    },
    enabled: !!mint && programDeployed,
    staleTime: 30_000,
  });
}
