import { PublicKey } from "@solana/web3.js";

export type ProposalType =
  | "UpdateLegalDoc"
  | "UpdateTransferRestrictions"
  | "MintAdditional"
  | "BurnTokens"
  | "FreezeHolder"
  | "EmergencyPause"
  | "TreasuryTransfer"
  | "UpgradeProgram";

export type ProposalStatus = "active" | "passed" | "rejected" | "pending" | "executed";

export interface Proposal {
  id: string;
  realm: PublicKey;
  title: string;
  description: string;
  proposalType: ProposalType;
  series: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  endDate: number;
  proposer: PublicKey;
  executableInstructions: string | null;
}

export interface GovernanceConfig {
  realm: PublicKey;
  seriesMint: PublicKey;
  voteThreshold: number;
  minProposalWeight: number;
  votingTime: number;
  cooloffTime: number;
}

export interface Vote {
  proposal: PublicKey;
  voter: PublicKey;
  weight: number;
  side: "for" | "against" | "abstain";
  timestamp: number;
}
