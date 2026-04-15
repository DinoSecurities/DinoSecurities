import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useDinoGovernanceProgram } from "@/lib/anchor";
import {
  createRealm,
  createProposal,
  castVote,
  finalizeProposal,
  executeProposal,
  type CreateProposalInput,
  DEFAULT_REALM_PARAMS,
} from "@/lib/governanceActions";

export function useRealm(mint: string | null) {
  return useQuery({
    queryKey: ["governance", "realm", mint],
    queryFn: () => trpc.governance.getRealm.query({ mint: mint! }),
    enabled: !!mint,
    refetchInterval: 30_000,
  });
}

export function useProposals(mint: string | null) {
  return useQuery({
    queryKey: ["governance", "proposals", mint],
    queryFn: () => trpc.governance.listProposals.query({ mint: mint! }),
    enabled: !!mint,
    refetchInterval: 30_000,
  });
}

export function useProposal(pda: string | null) {
  return useQuery({
    queryKey: ["governance", "proposal", pda],
    queryFn: () => trpc.governance.getProposal.query({ pda: pda! }),
    enabled: !!pda,
    refetchInterval: 30_000,
  });
}

export function useVotesForProposal(pda: string | null) {
  return useQuery({
    queryKey: ["governance", "votes", pda],
    queryFn: () => trpc.governance.getVotesForProposal.query({ pda: pda! }),
    enabled: !!pda,
    refetchInterval: 30_000,
  });
}

export function useRealmStats(mint: string | null) {
  return useQuery({
    queryKey: ["governance", "stats", mint],
    queryFn: () => trpc.governance.realmStats.query({ mint: mint! }),
    enabled: !!mint,
    refetchInterval: 60_000,
  });
}

export function useCreateRealm() {
  const wallet = useWallet();
  const program = useDinoGovernanceProgram();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { mint: string }) => {
      if (!program) throw new Error("Connect your wallet first.");
      const sig = await createRealm(
        program,
        wallet,
        new PublicKey(params.mint),
        DEFAULT_REALM_PARAMS,
      );
      return sig;
    },
    onSuccess: (_sig, vars) => {
      toast.success("Governance realm created");
      qc.invalidateQueries({ queryKey: ["governance", "realm", vars.mint] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create realm"),
  });
}

export function useCreateProposal(mint: string | null) {
  const wallet = useWallet();
  const program = useDinoGovernanceProgram();
  const realm = useRealm(mint);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateProposalInput, "mint">) => {
      if (!program) throw new Error("Connect your wallet first.");
      if (!mint) throw new Error("Missing security mint.");
      if (!realm.data) throw new Error("Realm not initialized for this series yet.");
      const { signature, proposalPda } = await createProposal(
        program,
        wallet,
        { ...input, mint: new PublicKey(mint) },
        realm.data.proposalCount ?? 0,
      );
      return { signature, proposalPda: proposalPda.toBase58() };
    },
    onSuccess: () => {
      toast.success("Proposal submitted on-chain");
      qc.invalidateQueries({ queryKey: ["governance", "proposals", mint] });
      qc.invalidateQueries({ queryKey: ["governance", "realm", mint] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create proposal"),
  });
}

export function useCastVote() {
  const wallet = useWallet();
  const program = useDinoGovernanceProgram();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      proposalPda: string;
      mint: string;
      choice: "Yes" | "No" | "Abstain";
    }) => {
      if (!program) throw new Error("Connect your wallet first.");
      return castVote(
        program,
        wallet,
        new PublicKey(params.proposalPda),
        new PublicKey(params.mint),
        params.choice,
      );
    },
    onSuccess: (_sig, vars) => {
      toast.success(`Vote cast: ${vars.choice}`);
      qc.invalidateQueries({ queryKey: ["governance", "proposal", vars.proposalPda] });
      qc.invalidateQueries({ queryKey: ["governance", "votes", vars.proposalPda] });
      qc.invalidateQueries({ queryKey: ["governance", "proposals", vars.mint] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to cast vote"),
  });
}

export function useFinalizeProposal() {
  const program = useDinoGovernanceProgram();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { proposalPda: string; mint: string }) => {
      if (!program) throw new Error("Connect your wallet first.");
      return finalizeProposal(
        program,
        new PublicKey(params.proposalPda),
        new PublicKey(params.mint),
      );
    },
    onSuccess: (_sig, vars) => {
      toast.success("Proposal finalized");
      qc.invalidateQueries({ queryKey: ["governance", "proposal", vars.proposalPda] });
      qc.invalidateQueries({ queryKey: ["governance", "proposals", vars.mint] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to finalize"),
  });
}

export function useExecuteProposal() {
  const wallet = useWallet();
  const program = useDinoGovernanceProgram();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { proposalPda: string; mint: string }) => {
      if (!program) throw new Error("Connect your wallet first.");
      return executeProposal(program, wallet, new PublicKey(params.proposalPda));
    },
    onSuccess: (_sig, vars) => {
      toast.success("Proposal executed");
      qc.invalidateQueries({ queryKey: ["governance", "proposal", vars.proposalPda] });
      qc.invalidateQueries({ queryKey: ["governance", "proposals", vars.mint] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to execute"),
  });
}
