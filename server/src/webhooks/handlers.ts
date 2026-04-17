import { db } from "../db/index.js";
import {
  indexedSeries,
  indexedHolders,
  settlementOrders,
  govRealms,
  govProposals,
  govVotes,
} from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { decodeProgramEvents, type DinoEvent } from "./event-decoder.js";

interface WebhookEvent {
  type?: string;
  signature?: string;
  description?: string;
  meta?: { logMessages?: string[] };
  logMessages?: string[];
  [key: string]: unknown;
}

/**
 * Helius webhook handler. Decodes Anchor events from program logs and
 * dispatches each to its upsert handler. Idempotent: re-processing the same
 * tx_signature is safe because handlers use ON CONFLICT upserts and the
 * caller (helius.ts) writes a webhook_events row with tx_signature as PK.
 */
export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  const logs =
    event.logMessages ??
    event.meta?.logMessages ??
    [];
  if (logs.length === 0) return;

  const events = decodeProgramEvents(logs);
  for (const evt of events) {
    try {
      await dispatch(evt, event.signature, event);
    } catch (err) {
      console.error(`handler error for ${evt.name}:`, err);
    }
  }
}

async function dispatch(evt: DinoEvent, signature?: string, event?: WebhookEvent) {
  switch (evt.name) {
    case "SeriesCreated":
      return upsertSeries(evt.data);
    case "SecurityMinted":
      return bumpSupply(evt.data);
    case "HolderRegistered":
      return upsertHolder(evt.data);
    case "HolderRevoked":
      return revokeHolder(evt.data);
    case "SeriesPauseChanged":
      return setSeriesStatus(evt.data);
    case "OrderCreated":
      return insertOrder(evt.data, signature);
    case "SettlementExecuted":
      return markSettled(evt.data, signature, event);
    case "ProposalCreated":
    case "RealmCreated":
      return upsertRealm(evt.data);
    case "ProposalCreated":
      return insertProposal(evt.data, signature);
    case "VoteCast":
      return recordVote(evt.data, signature);
    case "ProposalFinalized":
      return setProposalStatus(evt.data);
    case "ProposalExecuted":
      return markProposalExecuted(evt.data);
    default:
      console.log(`unhandled event: ${evt.name}`);
  }
}

async function upsertSeries(d: any) {
  await db.insert(indexedSeries).values({
    mintAddress: d.mint,
    issuer: d.issuer,
    name: d.symbol, // SeriesCreated event only carries symbol; full row populated by getProgramAccounts on first read
    symbol: d.symbol,
    securityType: "Equity",
    docHash: "",
    docUri: "",
    isin: null,
    maxSupply: Number(d.maxSupply ?? 0),
    currentSupply: 0,
    transferRestrictions: "None",
    jurisdiction: "",
    status: "active",
  }).onConflictDoNothing({ target: indexedSeries.mintAddress });
}

async function bumpSupply(d: any) {
  await db
    .update(indexedSeries)
    .set({ currentSupply: Number(d.newSupply ?? 0), lastUpdated: new Date() })
    .where(eq(indexedSeries.mintAddress, d.mint));
}

async function upsertHolder(d: any) {
  await db
    .insert(indexedHolders)
    .values({
      mintAddress: d.mint,
      wallet: d.wallet,
      isAccredited: Boolean(d.isAccredited),
    })
    .onConflictDoUpdate({
      target: [indexedHolders.mintAddress, indexedHolders.wallet],
      set: { isAccredited: Boolean(d.isAccredited), isRevoked: false },
    });
}

async function revokeHolder(d: any) {
  await db
    .update(indexedHolders)
    .set({ isRevoked: true })
    .where(sql`${indexedHolders.mintAddress} = ${d.mint} AND ${indexedHolders.wallet} = ${d.wallet}`);
}

async function setSeriesStatus(d: any) {
  await db
    .update(indexedSeries)
    .set({ status: d.paused ? "paused" : "active", lastUpdated: new Date() })
    .where(eq(indexedSeries.mintAddress, d.mint));
}

async function insertOrder(d: any, signature?: string) {
  await db.insert(settlementOrders).values({
    orderId: d.order,
    buyer: d.side === "Buy" ? d.creator : null,
    seller: d.side === "Sell" ? d.creator : null,
    securityMint: d.securityMint,
    tokenAmount: Number(d.tokenAmount),
    usdcAmount: Number(d.paymentAmount),
    status: "open",
    txSignature: signature ?? null,
  }).onConflictDoNothing({ target: settlementOrders.orderId });
}

async function markSettled(d: any, signature?: string, event?: WebhookEvent) {
  const settledAt = new Date();

  // Pull perf metrics from the webhook event if present. Helius enhanced
  // webhooks include meta.fee (lamports) and the transaction slot. We
  // approximate finality as settledAt - createdAt of the matched buy-side
  // order; Solana's own confirmed-finality is effectively 400ms but the
  // number we show users is the wall-clock time from "order open" to
  // "funds moved," which is the honest experience.
  const feeLamports =
    typeof (event?.meta as any)?.fee === "number" ? (event?.meta as any).fee : null;
  const slot = typeof (event as any)?.slot === "number" ? (event as any).slot : null;

  const base = {
    status: "settled" as const,
    settledAt,
    txSignature: signature ?? null,
    ...(feeLamports !== null ? { feeLamports } : {}),
    ...(slot !== null ? { settlementSlot: slot } : {}),
  };

  for (const orderId of [d.buyOrder, d.sellOrder]) {
    const [existing] = await db
      .select({ createdAt: settlementOrders.createdAt })
      .from(settlementOrders)
      .where(eq(settlementOrders.orderId, orderId))
      .limit(1);
    const finalityMs = existing?.createdAt
      ? Math.max(0, settledAt.getTime() - new Date(existing.createdAt).getTime())
      : null;
    await db
      .update(settlementOrders)
      .set({ ...base, ...(finalityMs !== null ? { finalityMs } : {}) })
      .where(eq(settlementOrders.orderId, orderId));
  }
}

// ==========================================================================
// Governance handlers. Events emitted by dino_governance.
// ==========================================================================

function proposalTypeToString(v: any): string {
  if (!v) return "Generic";
  if (typeof v === "string") return v;
  if (typeof v === "object") return Object.keys(v)[0] ?? "Generic";
  return "Generic";
}

function statusToString(v: any): string {
  const k = proposalTypeToString(v);
  return k.toLowerCase();
}

async function upsertRealm(d: any) {
  // RealmCreated emits just { mint, authority }. Full config is read from
  // the PDA during the on-chain fetcher fallback; the row here is the index
  // anchor so listRealms can be cheap.
  await db
    .insert(govRealms)
    .values({
      securityMint: d.mint,
      realmPda: d.realm ?? d.realmPda ?? d.mint, // best-effort
      authority: d.authority,
      voteThresholdBps: Number(d.voteThresholdBps ?? 5000),
      quorumBps: Number(d.quorumBps ?? 1000),
      votingPeriodSec: Number(d.votingPeriod ?? 259_200),
      cooloffPeriodSec: Number(d.cooloffPeriod ?? 172_800),
      minProposalWeight: Number(d.minProposalWeight ?? 1),
    })
    .onConflictDoNothing({ target: govRealms.securityMint });
}

async function insertProposal(d: any, signature?: string) {
  const votingEndsAt = new Date(Number(d.votingEndsAt ?? d.voting_ends_at ?? 0) * 1000);
  const executionEta = new Date(Number(d.executionEta ?? d.execution_eta ?? 0) * 1000);
  await db
    .insert(govProposals)
    .values({
      proposalPda: d.proposal,
      realmPda: d.realm,
      securityMint: d.mint ?? d.securityMint,
      proposer: d.proposer,
      proposalType: proposalTypeToString(d.proposalType ?? d.proposal_type),
      title: String(d.title ?? ""),
      descriptionUri: String(d.descriptionUri ?? d.description_uri ?? ""),
      executionPayloadHex: d.executionPayload
        ? Buffer.from(d.executionPayload).toString("hex")
        : null,
      proposalIndex: Number(d.index ?? 0),
      status: "voting",
      votingEndsAt: isNaN(votingEndsAt.getTime()) ? new Date() : votingEndsAt,
      executionEta: isNaN(executionEta.getTime()) ? new Date() : executionEta,
    })
    .onConflictDoNothing({ target: govProposals.proposalPda });
  void signature;
}

async function recordVote(d: any, signature?: string) {
  await db
    .insert(govVotes)
    .values({
      proposalPda: d.proposal,
      voter: d.voter,
      choice: proposalTypeToString(d.choice),
      weight: Number(d.weight ?? 0),
      txSignature: signature ?? null,
    })
    .onConflictDoNothing({ target: [govVotes.proposalPda, govVotes.voter] });

  // Bump the proposal's vote tallies.
  const choice = proposalTypeToString(d.choice).toLowerCase();
  const weight = Number(d.weight ?? 0);
  const col =
    choice === "yes" ? govProposals.yesVotes :
    choice === "no" ? govProposals.noVotes :
    govProposals.abstainVotes;
  await db
    .update(govProposals)
    .set({ [col.name]: sql`${col} + ${weight}`, lastUpdated: new Date() } as any)
    .where(eq(govProposals.proposalPda, d.proposal));
}

async function setProposalStatus(d: any) {
  await db
    .update(govProposals)
    .set({ status: statusToString(d.status), lastUpdated: new Date() })
    .where(eq(govProposals.proposalPda, d.proposal));
}

async function markProposalExecuted(d: any) {
  await db
    .update(govProposals)
    .set({ status: "executed", lastUpdated: new Date() })
    .where(eq(govProposals.proposalPda, d.proposal));
}
