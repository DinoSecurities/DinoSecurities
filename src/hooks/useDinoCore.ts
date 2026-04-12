import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useDinoCoreProgram } from "@/lib/anchor";
import {
  PROGRAM_IDS,
  deriveIssuerProfilePDA,
  deriveSecuritySeriesPDA,
} from "@/lib/solana";
import { SECURITY_TYPE_TO_U8, TRANSFER_RESTRICTION_TO_U8 } from "@/lib/constants";
import type { SecurityType, TransferRestriction } from "@/types/security";

/**
 * Fetch a single IssuerProfile PDA
 */
export function useIssuerProfile(issuerPubkey: PublicKey | null) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["issuerProfile", issuerPubkey?.toBase58()],
    queryFn: async () => {
      if (!issuerPubkey) return null;
      const [pda] = deriveIssuerProfilePDA(issuerPubkey);
      const account = await connection.getAccountInfo(pda);
      if (!account || !account.owner.equals(PROGRAM_IDS.DINO_CORE)) return null;
      // When the real program is deployed, decode with Anchor:
      // return program.account.issuerProfile.fetch(pda);
      return { address: pda, exists: true, raw: account.data };
    },
    enabled: !!issuerPubkey,
    staleTime: 60_000,
  });
}

/**
 * Fetch all SecuritySeries PDAs from the program
 */
export function useAllSecuritySeries() {
  const program = useDinoCoreProgram();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["allSecuritySeries"],
    queryFn: async () => {
      if (!program) {
        // Fallback: fetch from getProgramAccounts when program is available
        const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
          commitment: "confirmed",
        });
        return accounts;
      }
      // When real program is deployed:
      // return program.account.securitySeries.all();
      return [];
    },
    enabled: !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId),
    staleTime: 30_000,
  });
}

/**
 * Fetch a single SecuritySeries by mint address
 */
export function useSecuritySeriesByMint(mint: PublicKey | null) {
  const program = useDinoCoreProgram();

  return useQuery({
    queryKey: ["securitySeries", mint?.toBase58()],
    queryFn: async () => {
      if (!program || !mint) return null;
      // When real program is deployed:
      // Find the PDA for this security series by scanning or using known issuer
      // return program.account.securitySeries.fetch(pda);
      return null;
    },
    enabled: !!mint && !!program,
    staleTime: 30_000,
  });
}

/**
 * Mutation: Register as an issuer
 */
export function useRegisterIssuer() {
  const program = useDinoCoreProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      legalName: string;
      jurisdiction: string;
      kycHash: string;
    }) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const [issuerPDA] = deriveIssuerProfilePDA(publicKey);

      const tx = await program.methods
        .registerIssuer(params.legalName, params.jurisdiction, params.kycHash)
        .accounts({
          authority: publicKey,
          issuerProfile: issuerPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issuerProfile"] });
    },
  });
}

/**
 * Mutation: Create a new security series
 */
export function useCreateSecuritySeries() {
  const program = useDinoCoreProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      symbol: string;
      securityType: SecurityType;
      docHash: string;
      docUri: string;
      isin: string;
      maxSupply: number;
      jurisdiction: string;
      transferRestrictions: TransferRestriction;
      mint: PublicKey;
      seriesId: string;
    }) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const [issuerPDA] = deriveIssuerProfilePDA(publicKey);
      const [seriesPDA] = deriveSecuritySeriesPDA(publicKey, params.seriesId);

      const tx = await program.methods
        .createSecuritySeries(
          params.name,
          params.symbol,
          SECURITY_TYPE_TO_U8[params.securityType],
          params.docHash,
          params.docUri,
          params.isin,
          params.maxSupply,
          params.jurisdiction,
          TRANSFER_RESTRICTION_TO_U8[params.transferRestrictions],
        )
        .accounts({
          issuer: publicKey,
          issuerProfile: issuerPDA,
          securitySeries: seriesPDA,
          mint: params.mint,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSecuritySeries"] });
      queryClient.invalidateQueries({ queryKey: ["issuerProfile"] });
    },
  });
}
