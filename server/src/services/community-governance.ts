import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { communityProposals, communityVotes } from "../db/schema.js";
import { dinoTierFor, getDinoBalance } from "./dino-balance.js";

/**
 * Community-governance service for $DINO-holder advisory polls.
 *
 * DESIGN CONSTRAINTS — read before touching this file:
 *   1. This service does NOT execute anything. There is no on-chain
 *      action, no treasury movement, no signer, no CPI. Do not add
 *      one. "Execute" is an intentional gap in the API surface.
 *   2. All proposals are advisory. Vote tallies surface the
 *      community's preference; the platform team acts on them
 *      manually, off-platform.
 *   3. Nothing in this file joins against the securities-governance
 *      tables (gov_proposals, gov_realms, gov_votes) or references
 *      any security mint. If you need to cross that line, you're in
 *      the wrong file.
 *   4. Content-filter rejects proposal text that would imply authority
 *      over a security. This is belt-and-suspenders — the enumerated
 *      proposal types already exclude anything on-chain — but content
 *      passes through user input, so an additional lint is warranted.
 */

export const PROPOSAL_TYPES = [
  "marketing_budget",
  "feature_request",
  "community_grant",
  "community_event",
  "generic",
] as const;

export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const VOTE_CHOICES = ["yes", "no", "abstain"] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

/** Gold-tier required to create. Spam-resistance, not authority. */
export const MIN_TIER_TO_CREATE = 3;
/** Bronze-tier required to vote. Keeps casual-onlooker noise out. */
export const MIN_TIER_TO_VOTE = 1;

const SOLANA_ADDRESS_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const SECURITIES_KEYWORDS_REGEX =
  /\b(delist|halt trading|freeze account|revoke kyc|force transfer|mint override|clawback|burn authority|issuer removal)\b/i;

export interface ContentLintResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Structural rejection of proposal text that would smell like an
 * attempted on-chain-authority vote dressed as community governance.
 * Deliberately strict — false positives are the point.
 */
export function lintProposalContent(title: string, description: string): ContentLintResult {
  const reasons: string[] = [];
  const combined = `${title}\n${description}`;
  if (SOLANA_ADDRESS_REGEX.test(combined)) {
    reasons.push(
      "proposal text contains what looks like a Solana address — community proposals cannot target a specific on-chain account",
    );
  }
  if (SECURITIES_KEYWORDS_REGEX.test(combined)) {
    reasons.push(
      "proposal text uses securities-authority language (delist / halt / freeze / clawback / etc.) — these decisions live in on-chain securities governance, not community polls",
    );
  }
  return { ok: reasons.length === 0, reasons };
}

export interface CreateProposalInput {
  creator: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  votingDurationSec: number;
  disclosureAck: boolean;
}

export async function createProposal(input: CreateProposalInput) {
  if (!input.disclosureAck) {
    throw new Error("disclosureAck required: creator must acknowledge this is a non-binding advisory poll");
  }
  if (!PROPOSAL_TYPES.includes(input.proposalType)) {
    throw new Error(`invalid proposal type: ${input.proposalType}`);
  }
  if (input.title.trim().length < 8 || input.title.trim().length > 120) {
    throw new Error("title must be 8–120 characters");
  }
  if (input.description.trim().length < 40 || input.description.trim().length > 10_000) {
    throw new Error("description must be 40–10000 characters");
  }
  if (input.votingDurationSec < 24 * 3600 || input.votingDurationSec > 14 * 24 * 3600) {
    throw new Error("voting duration must be between 1 day and 14 days");
  }

  const lint = lintProposalContent(input.title, input.description);
  if (!lint.ok) {
    throw new Error(`content rejected: ${lint.reasons.join("; ")}`);
  }

  const { balance, tier } = await dinoTierFor(input.creator);
  if (tier.id < MIN_TIER_TO_CREATE) {
    throw new Error(
      `Gold tier required to create a community proposal — current balance ${balance.toLocaleString()} $DINO is below the 5,000,000 threshold`,
    );
  }

  const votingEndsAt = new Date(Date.now() + input.votingDurationSec * 1000);
  const [row] = await db
    .insert(communityProposals)
    .values({
      title: input.title.trim(),
      description: input.description.trim(),
      proposalType: input.proposalType,
      createdBy: input.creator,
      creatorBalanceAtCreation: Math.floor(balance),
      creatorTierAtCreation: tier.id,
      disclosureAck: true,
      status: "voting",
      votingEndsAt,
    })
    .returning({ id: communityProposals.id });
  if (!row) throw new Error("failed to create proposal");
  return { id: row.id };
}

export async function castVote(input: {
  proposalId: number;
  voter: string;
  choice: VoteChoice;
}) {
  if (!VOTE_CHOICES.includes(input.choice)) {
    throw new Error("invalid vote choice");
  }

  const [proposal] = await db
    .select()
    .from(communityProposals)
    .where(eq(communityProposals.id, input.proposalId))
    .limit(1);
  if (!proposal) throw new Error("proposal not found");
  if (proposal.status !== "voting") {
    throw new Error(`proposal is ${proposal.status}, not open for voting`);
  }
  if (proposal.votingEndsAt <= new Date()) {
    throw new Error("voting window has closed");
  }

  const { balance, tier } = await dinoTierFor(input.voter);
  if (tier.id < MIN_TIER_TO_VOTE) {
    throw new Error(
      `Bronze tier required to vote — current balance ${balance.toLocaleString()} $DINO is below the 100,000 threshold`,
    );
  }

  // Upsert so a voter can change their mind while the window is open —
  // the recorded weight rolls forward to their current balance at the
  // most recent vote. Tally-time sums across the active choice per
  // voter.
  await db
    .insert(communityVotes)
    .values({
      proposalId: input.proposalId,
      voterWallet: input.voter,
      choice: input.choice,
      weightAtVote: Math.floor(balance),
    })
    .onConflictDoUpdate({
      target: [communityVotes.proposalId, communityVotes.voterWallet],
      set: {
        choice: input.choice,
        weightAtVote: Math.floor(balance),
        castAt: new Date(),
      },
    });

  return { ok: true };
}

export interface ProposalTally {
  yes: number;
  no: number;
  abstain: number;
  voterCount: number;
}

async function computeTally(proposalId: number): Promise<ProposalTally> {
  const rows = await db
    .select({
      choice: communityVotes.choice,
      total: sql<number>`sum(${communityVotes.weightAtVote})::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(communityVotes)
    .where(eq(communityVotes.proposalId, proposalId))
    .groupBy(communityVotes.choice);

  const tally: ProposalTally = { yes: 0, no: 0, abstain: 0, voterCount: 0 };
  for (const r of rows) {
    const w = Number(r.total ?? 0);
    if (r.choice === "yes") tally.yes = w;
    else if (r.choice === "no") tally.no = w;
    else if (r.choice === "abstain") tally.abstain = w;
    tally.voterCount += Number(r.count ?? 0);
  }
  return tally;
}

export async function listProposals(limit = 50) {
  const rows = await db
    .select()
    .from(communityProposals)
    .orderBy(desc(communityProposals.createdAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      proposalType: r.proposalType,
      createdBy: r.createdBy,
      status: r.status,
      votingEndsAt: r.votingEndsAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      tally: await computeTally(r.id),
    })),
  );
}

export async function getProposal(id: number, viewerWallet?: string) {
  const [proposal] = await db
    .select()
    .from(communityProposals)
    .where(eq(communityProposals.id, id))
    .limit(1);
  if (!proposal) return null;

  const tally = await computeTally(id);

  let viewerVote: VoteChoice | null = null;
  let viewerBalance: number | null = null;
  if (viewerWallet) {
    const [row] = await db
      .select({ choice: communityVotes.choice })
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.proposalId, id),
          eq(communityVotes.voterWallet, viewerWallet),
        ),
      )
      .limit(1);
    if (row) viewerVote = row.choice as VoteChoice;
    try {
      viewerBalance = await getDinoBalance(viewerWallet);
    } catch {
      viewerBalance = null;
    }
  }

  return {
    id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    proposalType: proposal.proposalType,
    createdBy: proposal.createdBy,
    status: proposal.status,
    votingEndsAt: proposal.votingEndsAt.toISOString(),
    createdAt: proposal.createdAt.toISOString(),
    tally,
    viewerVote,
    viewerBalance,
  };
}

/**
 * Close expired proposals. Idempotent — callable from a cron, the
 * detail page load, or the list query. Never auto-executes anything;
 * only flips the status flag so the UI renders "voting closed".
 */
export async function closeExpired() {
  await db
    .update(communityProposals)
    .set({ status: "closed" })
    .where(
      and(
        eq(communityProposals.status, "voting"),
        sql`${communityProposals.votingEndsAt} <= now()`,
      ),
    );
}

/** Utility: "is the voting window still open right now?" */
export async function isOpen(proposalId: number): Promise<boolean> {
  const [row] = await db
    .select()
    .from(communityProposals)
    .where(
      and(
        eq(communityProposals.id, proposalId),
        eq(communityProposals.status, "voting"),
        gt(communityProposals.votingEndsAt, new Date()),
      ),
    )
    .limit(1);
  return !!row;
}
