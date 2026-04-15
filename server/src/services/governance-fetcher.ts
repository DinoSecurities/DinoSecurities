/**
 * Read-side fallback for the governance tables. When the Helius webhook
 * hasn't indexed yet, the frontend still gets correct data by reading
 * directly from dino_governance PDAs.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { createRequire } from "node:module";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const govIdl = require("../idl/dino_governance.json") as Idl;

const coder = new BorshAccountsCoder(govIdl);
const REALM_DISC = Buffer.from(
  (govIdl.accounts ?? []).find((a: any) => a.name === "Realm")?.discriminator ?? [],
);
const PROPOSAL_DISC = Buffer.from(
  (govIdl.accounts ?? []).find((a: any) => a.name === "Proposal")?.discriminator ?? [],
);

const RPC = env.SOLANA_RPC_FALLBACK || env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");
const programId = new PublicKey(env.DINO_GOV_PROGRAM_ID ?? "54G8PfLKQdoBN8zRjMxZjVbQqpcD3uvVSgrmXyZzkz1p");

const REALM_SEED = Buffer.from("realm");
const PROPOSAL_SEED = Buffer.from("proposal");

function proposalTypeToString(v: any): string {
  if (!v || typeof v !== "object") return "Generic";
  return Object.keys(v)[0] ?? "Generic";
}
function statusToString(v: any): string {
  if (!v || typeof v !== "object") return "voting";
  const k = Object.keys(v)[0] ?? "voting";
  return k.toLowerCase();
}

export async function fetchRealmOnChain(mint: string) {
  const [realmPda] = PublicKey.findProgramAddressSync(
    [REALM_SEED, new PublicKey(mint).toBuffer()],
    programId,
  );
  const info = await connection.getAccountInfo(realmPda, "confirmed");
  if (!info) return null;
  const decoded = coder.decode("Realm", info.data) as any;
  return {
    securityMint: mint,
    realmPda: realmPda.toBase58(),
    authority: decoded.authority.toBase58(),
    voteThresholdBps: Number(decoded.voteThresholdBps ?? decoded.vote_threshold_bps),
    quorumBps: Number(decoded.quorumBps ?? decoded.quorum_bps),
    votingPeriodSec: Number(decoded.votingPeriod ?? decoded.voting_period),
    cooloffPeriodSec: Number(decoded.cooloffPeriod ?? decoded.cooloff_period),
    minProposalWeight: Number(decoded.minProposalWeight ?? decoded.min_proposal_weight ?? 0),
    proposalCount: Number(decoded.proposalCount ?? decoded.proposal_count ?? 0),
    createdAt: new Date(),
  };
}

export async function fetchProposalsOnChain(mint: string) {
  if (REALM_DISC.length !== 8 || PROPOSAL_DISC.length !== 8) return [];
  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(PROPOSAL_DISC) } },
      // security_mint starts at offset 8 + 32 (realm pubkey) = 40
      { memcmp: { offset: 8 + 32, bytes: mint } },
    ],
  });
  const rows = [];
  for (const { pubkey, account } of accounts) {
    try {
      const d = coder.decode("Proposal", account.data) as any;
      rows.push({
        proposalPda: pubkey.toBase58(),
        realmPda: d.realm.toBase58(),
        securityMint: d.securityMint.toBase58(),
        proposer: d.proposer.toBase58(),
        proposalType: proposalTypeToString(d.proposalType ?? d.proposal_type),
        title: String(d.title ?? ""),
        descriptionUri: String(d.descriptionUri ?? d.description_uri ?? ""),
        executionPayloadHex: Buffer.from(d.executionPayload ?? d.execution_payload ?? []).toString("hex"),
        proposalIndex: Number(d.index ?? 0),
        yesVotes: Number(d.yesVotes ?? d.yes_votes ?? 0),
        noVotes: Number(d.noVotes ?? d.no_votes ?? 0),
        abstainVotes: Number(d.abstainVotes ?? d.abstain_votes ?? 0),
        status: statusToString(d.status),
        votingEndsAt: new Date(Number(d.votingEndsAt ?? d.voting_ends_at) * 1000),
        executionEta: new Date(Number(d.executionEta ?? d.execution_eta) * 1000),
        createdAt: new Date(Number(d.createdAt ?? d.created_at) * 1000),
        lastUpdated: new Date(),
      });
    } catch {
      // skip malformed account
    }
  }
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows;
}
