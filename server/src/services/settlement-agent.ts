import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { db } from "../db/index.js";
import { settlementOrders } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { env } from "../env.js";
import { connection } from "./solana-rpc.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Load the settlement agent keypair from environment.
 * In production this should reference an HSM.
 */
function loadAgentKeypair(): Keypair | null {
  if (!env.SETTLEMENT_AGENT_KEY) return null;

  try {
    // Expects a JSON array of bytes or a base58-encoded secret key
    const raw = JSON.parse(env.SETTLEMENT_AGENT_KEY);
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch {
    console.warn("Could not load settlement agent keypair");
    return null;
  }
}

/**
 * Match pending buy and sell orders for a given security.
 * Simple price-matching: exact match on usdcAmount/tokenAmount ratio.
 */
export async function matchOrders(securityMint: string): Promise<number> {
  const pending = await db
    .select()
    .from(settlementOrders)
    .where(
      and(
        eq(settlementOrders.securityMint, securityMint),
        eq(settlementOrders.status, "pending"),
      ),
    );

  const buys = pending.filter((o) => o.buyer && !o.seller);
  const sells = pending.filter((o) => o.seller && !o.buyer);

  let matched = 0;

  for (const buy of buys) {
    const buyPrice = buy.usdcAmount / buy.tokenAmount;

    const matchingSell = sells.find((s) => {
      const sellPrice = s.usdcAmount / s.tokenAmount;
      return (
        s.tokenAmount === buy.tokenAmount &&
        Math.abs(sellPrice - buyPrice) < 0.01
      );
    });

    if (matchingSell) {
      // Match the orders
      await db
        .update(settlementOrders)
        .set({
          seller: matchingSell.seller,
          status: "matched",
        })
        .where(eq(settlementOrders.orderId, buy.orderId));

      await db
        .update(settlementOrders)
        .set({
          buyer: buy.buyer,
          status: "matched",
        })
        .where(eq(settlementOrders.orderId, matchingSell.orderId));

      // Remove from available sells
      const idx = sells.indexOf(matchingSell);
      if (idx !== -1) sells.splice(idx, 1);

      matched++;
    }
  }

  return matched;
}

/**
 * Execute an atomic DvP settlement for a matched order.
 *
 * Flow:
 * 1. Verify both parties have delegated to the agent
 * 2. Build atomic transaction: Leg 1 (security transfer) + Leg 2 (USDC transfer)
 * 3. Simulate, then submit
 * 4. Update DB status
 */
export async function executeSettlement(orderId: string): Promise<string> {
  const agentKeypair = loadAgentKeypair();
  if (!agentKeypair) {
    throw new Error("Settlement agent keypair not configured");
  }

  const [order] = await db
    .select()
    .from(settlementOrders)
    .where(eq(settlementOrders.orderId, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found");
  if (order.status !== "matched" && order.status !== "delegated") {
    throw new Error(`Order not ready for settlement (status: ${order.status})`);
  }
  if (!order.buyer || !order.seller) {
    throw new Error("Order missing buyer or seller");
  }

  // Update status to executing
  await db
    .update(settlementOrders)
    .set({ status: "executing" })
    .where(eq(settlementOrders.orderId, orderId));

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // TODO: Build the actual atomic DvP transaction
      // 1. Create transfer instruction: security tokens (seller -> buyer)
      // 2. Create transfer instruction: USDC (buyer -> seller)
      // 3. Both use the agent as delegate (Token-2022 approve was done by both parties)
      // 4. Package into single transaction
      // 5. Simulate
      // 6. Sign with agent keypair and submit

      // Placeholder — will be implemented when Anchor programs are deployed
      const txSignature = `simulated-settlement-${orderId}-${Date.now()}`;

      // Update status to settled
      await db
        .update(settlementOrders)
        .set({
          status: "settled",
          txSignature,
          settledAt: new Date(),
        })
        .where(eq(settlementOrders.orderId, orderId));

      return txSignature;
    } catch (err) {
      lastError = err as Error;
      console.error(`Settlement attempt ${attempt}/${MAX_RETRIES} failed:`, err);

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  // All retries failed — revert to created for retry
  await db
    .update(settlementOrders)
    .set({ status: "failed" })
    .where(eq(settlementOrders.orderId, orderId));

  throw new Error(`Settlement failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}
