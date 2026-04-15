/**
 * Client-side helpers for the dino_governance program.
 *
 * The on-chain Rust exposes five instructions:
 *   create_realm, create_proposal, cast_vote, finalize_proposal, execute_proposal
 *
 * This module wraps each in a typed helper the frontend calls with a wallet
 * context. Realm/proposal PDAs are derived from the security mint + index.
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { PROGRAM_IDS } from "./solana";

const REALM_SEED = Buffer.from("realm");
const PROPOSAL_SEED = Buffer.from("proposal");
const VOTE_SEED = Buffer.from("vote");

export const PROPOSAL_TYPES = [
  "UpdateLegalDoc",
  "MintAdditional",
  "EmergencyPause",
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const DEFAULT_REALM_PARAMS = {
  voteThresholdBps: 5000, // 50 % yes-of-voting needed to pass
  quorumBps: 1000, //         10 % of supply must participate
  votingPeriodSec: 3 * 24 * 3600, // 3 days to vote
  cooloffPeriodSec: 2 * 24 * 3600, // 48 h timelock before execute
  minProposalWeight: 1, // must hold at least 1 token to propose
};

// EmergencyPause gets a shorter 6 h cooloff so issuers can react fast.
export function cooloffForType(type: ProposalType): number {
  if (type === "EmergencyPause") return 6 * 3600;
  return DEFAULT_REALM_PARAMS.cooloffPeriodSec;
}

export function deriveRealm(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [REALM_SEED, mint.toBuffer()],
    PROGRAM_IDS.DINO_GOV,
  )[0];
}

export function deriveProposal(realm: PublicKey, index: number | bigint) {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync(
    [PROPOSAL_SEED, realm.toBuffer(), indexBuf],
    PROGRAM_IDS.DINO_GOV,
  )[0];
}

export function deriveVoteRecord(proposal: PublicKey, voter: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, proposal.toBuffer(), voter.toBuffer()],
    PROGRAM_IDS.DINO_GOV,
  )[0];
}

function anchorize<T extends string>(variant: T): Record<T, Record<string, never>> {
  return { [variant]: {} } as Record<T, Record<string, never>>;
}

export async function createRealm(
  program: Program,
  wallet: WalletContextState,
  mint: PublicKey,
  params = DEFAULT_REALM_PARAMS,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const realm = deriveRealm(mint);

  return program.methods
    .createRealm({
      voteThresholdBps: params.voteThresholdBps,
      quorumBps: params.quorumBps,
      votingPeriod: new anchor.BN(params.votingPeriodSec),
      cooloffPeriod: new anchor.BN(params.cooloffPeriodSec),
      minProposalWeight: new anchor.BN(params.minProposalWeight),
    })
    .accountsStrict({
      realm,
      securityMint: mint,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export interface CreateProposalInput {
  mint: PublicKey;
  type: ProposalType;
  title: string;
  descriptionUri?: string;
  executionPayload?: Uint8Array;
}

export async function createProposal(
  program: Program,
  wallet: WalletContextState,
  input: CreateProposalInput,
  currentProposalCount: number | bigint,
): Promise<{ signature: string; proposalPda: PublicKey }> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const realm = deriveRealm(input.mint);
  const proposalPda = deriveProposal(realm, currentProposalCount);
  const proposerAta = getAssociatedTokenAddressSync(
    input.mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const signature = await program.methods
    .createProposal({
      title: input.title.slice(0, 128),
      descriptionUri: (input.descriptionUri ?? "").slice(0, 200),
      proposalType: anchorize(input.type),
      executionPayload: Array.from(input.executionPayload ?? []),
    })
    .accountsStrict({
      realm,
      proposal: proposalPda,
      proposerTokenAccount: proposerAta,
      proposer: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature, proposalPda };
}

export async function castVote(
  program: Program,
  wallet: WalletContextState,
  proposalPda: PublicKey,
  mint: PublicKey,
  choice: "Yes" | "No" | "Abstain",
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const voteRecord = deriveVoteRecord(proposalPda, wallet.publicKey);
  const voterAta = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return program.methods
    .castVote(anchorize(choice))
    .accountsStrict({
      proposal: proposalPda,
      voteRecord,
      voterTokenAccount: voterAta,
      voter: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function finalizeProposal(
  program: Program,
  proposalPda: PublicKey,
  mint: PublicKey,
): Promise<string> {
  const realm = deriveRealm(mint);
  return program.methods
    .finalizeProposal()
    .accountsStrict({
      realm,
      proposal: proposalPda,
      securityMint: mint,
    })
    .rpc();
}

export async function executeProposal(
  program: Program,
  wallet: WalletContextState,
  proposalPda: PublicKey,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  return program.methods
    .executeProposal()
    .accountsStrict({
      proposal: proposalPda,
      executor: wallet.publicKey,
    })
    .rpc();
}
