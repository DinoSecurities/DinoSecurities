import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PROGRAM_IDS, deriveGovernanceConfigPDA } from "@/lib/solana";
import type { Proposal, GovernanceConfig, ProposalStatus } from "@/types/governance";

// Mock fallback until SPL Governance integration is complete
import { proposals as mockProposals } from "@/lib/mockData";

/**
 * Fetch governance config for a security series
 */
export function useGovernanceConfig(seriesMint: PublicKey | null) {
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["governanceConfig", seriesMint?.toBase58()],
    queryFn: async (): Promise<GovernanceConfig | null> => {
      if (!seriesMint || !programDeployed) return null;

      const [pda] = deriveGovernanceConfigPDA(seriesMint);
      const account = await connection.getAccountInfo(pda);

      if (!account) return null;

      // TODO: Decode with Anchor when program is deployed
      return null;
    },
    enabled: !!seriesMint && programDeployed,
    staleTime: 60_000,
  });
}

/**
 * Fetch all proposals — falls back to mock data
 */
export function useProposals(filterStatus?: ProposalStatus) {
  return useQuery({
    queryKey: ["proposals", filterStatus],
    queryFn: async () => {
      // TODO: Replace with real SPL Governance account fetching
      // For now return mock proposals mapped to our Proposal type
      let filtered = mockProposals;
      if (filterStatus) {
        filtered = mockProposals.filter((p) => p.status === filterStatus);
      }
      return filtered;
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation: Cast a vote on a proposal via SPL Governance
 */
export function useCastVote() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      proposalId: string;
      realm: PublicKey;
      vote: "for" | "against" | "abstain";
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      // TODO: Implement real SPL Governance vote casting
      // 1. Get governance token owner record
      // 2. Build castVote instruction
      // 3. Submit transaction
      console.log("Casting vote:", params);

      return params.proposalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

/**
 * Mutation: Create a new proposal
 */
export function useCreateProposal() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      realm: PublicKey;
      title: string;
      description: string;
      proposalType: string;
      executableInstructions?: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      // TODO: Implement real SPL Governance proposal creation
      // 1. Upload description to Arweave
      // 2. Create proposal via SPL Governance
      // 3. Add executable instructions if provided
      console.log("Creating proposal:", params);

      return "proposal_id_placeholder";
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}
