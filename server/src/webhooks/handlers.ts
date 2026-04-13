import { db } from "../db/index.js";
import { indexedSeries, indexedHolders, settlementOrders } from "../db/schema.js";
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
      await dispatch(evt, event.signature);
    } catch (err) {
      console.error(`handler error for ${evt.name}:`, err);
    }
  }
}

async function dispatch(evt: DinoEvent, signature?: string) {
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
      return markSettled(evt.data, signature);
    case "ProposalCreated":
    case "ProposalFinalized":
    case "ProposalExecuted":
    case "VoteCast":
    case "RealmCreated":
      // Governance state lives off-chain in the proposal/vote PDAs; the
      // governance router reads them on-demand via @coral-xyz/anchor. We
      // could mirror to a `governance_proposals` table for fast list views
      // but that's deferred until the UI proves the perf is needed.
      return;
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

async function markSettled(d: any, signature?: string) {
  await db
    .update(settlementOrders)
    .set({ status: "settled", settledAt: new Date(), txSignature: signature ?? null })
    .where(eq(settlementOrders.orderId, d.buyOrder));
  await db
    .update(settlementOrders)
    .set({ status: "settled", settledAt: new Date(), txSignature: signature ?? null })
    .where(eq(settlementOrders.orderId, d.sellOrder));
}
