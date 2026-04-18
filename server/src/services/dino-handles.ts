import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { dinoHandles } from "../db/schema.js";
import { dinoTierFor } from "./dino-balance.js";

/**
 * $DINO community handles. Tier-gated: Bronze or higher ($DINO balance
 * ≥ 100,000) is required to claim. The server does the tier check at
 * claim time by hitting the Solana RPC directly — a malicious client
 * cannot fake a handle claim for a wallet they don't hold $DINO in.
 *
 * Handles are case-preserved for display but lowercased for lookup
 * and uniqueness: "Sorrowz" and "sorrowz" are the same handle.
 */

export const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,24}$/;
export const MIN_TIER_TO_CLAIM = 1; // Bronze

export interface HandleRecord {
  id: number;
  ownerWallet: string;
  handle: string;
  displayHandle: string;
  minTierAtClaim: number;
  balanceAtClaim: number;
  releasedAt: Date | null;
  createdAt: Date;
}

function toRecord(row: any): HandleRecord {
  return {
    id: row.id,
    ownerWallet: row.ownerWallet,
    handle: row.handle,
    displayHandle: row.displayHandle,
    minTierAtClaim: row.minTierAtClaim,
    balanceAtClaim: row.balanceAtClaim,
    releasedAt: row.releasedAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const lower = handle.toLowerCase();
  const [row] = await db
    .select()
    .from(dinoHandles)
    .where(and(eq(dinoHandles.handle, lower), isNull(dinoHandles.releasedAt)))
    .limit(1);
  return !row;
}

export async function getMyHandle(ownerWallet: string): Promise<HandleRecord | null> {
  const [row] = await db
    .select()
    .from(dinoHandles)
    .where(and(eq(dinoHandles.ownerWallet, ownerWallet), isNull(dinoHandles.releasedAt)))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function claimHandle(
  ownerWallet: string,
  requestedHandle: string,
): Promise<HandleRecord> {
  if (!HANDLE_REGEX.test(requestedHandle)) {
    throw new Error(
      "handle must be 3–24 characters, letters / numbers / underscore only",
    );
  }

  const existing = await getMyHandle(ownerWallet);
  if (existing) {
    throw new Error(
      `wallet already claims @${existing.displayHandle} — release it before claiming another`,
    );
  }

  const lower = requestedHandle.toLowerCase();
  if (!(await isHandleAvailable(lower))) {
    throw new Error(`handle @${requestedHandle} is already claimed`);
  }

  const { balance, tier } = await dinoTierFor(ownerWallet);
  if (tier.id < MIN_TIER_TO_CLAIM) {
    throw new Error(
      `Bronze tier required to claim a handle — current balance ${balance.toLocaleString()} $DINO is below the 100,000 threshold`,
    );
  }

  const [row] = await db
    .insert(dinoHandles)
    .values({
      ownerWallet,
      handle: lower,
      displayHandle: requestedHandle,
      minTierAtClaim: tier.id,
      balanceAtClaim: Math.floor(balance),
    })
    .returning();
  if (!row) throw new Error("failed to create handle");
  return toRecord(row);
}

export async function releaseHandle(ownerWallet: string): Promise<void> {
  await db
    .update(dinoHandles)
    .set({ releasedAt: new Date() })
    .where(
      and(eq(dinoHandles.ownerWallet, ownerWallet), isNull(dinoHandles.releasedAt)),
    );
}

export async function resolveHandle(wallet: string): Promise<HandleRecord | null> {
  const [row] = await db
    .select()
    .from(dinoHandles)
    .where(and(eq(dinoHandles.ownerWallet, wallet), isNull(dinoHandles.releasedAt)))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function resolveHandles(
  wallets: string[],
): Promise<Record<string, HandleRecord>> {
  if (wallets.length === 0) return {};
  const rows = await db
    .select()
    .from(dinoHandles)
    .where(
      and(
        inArray(dinoHandles.ownerWallet, wallets),
        isNull(dinoHandles.releasedAt),
      ),
    );
  const out: Record<string, HandleRecord> = {};
  for (const row of rows) out[row.ownerWallet] = toRecord(row);
  return out;
}
