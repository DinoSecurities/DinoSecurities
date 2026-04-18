import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { dinoTierFor, type DinoTier } from "./dino-balance.js";

/**
 * API key issuance + lookup. Keys are random 32-byte values encoded
 * base64url and prefixed for easy identification at a glance:
 *
 *   dino_live_<43 chars of entropy>
 *
 * Only the SHA-256 hash of the full key is persisted. Lookup on an
 * incoming request hashes the presented key and compares. No key
 * derivation, no salt — a single hash is enough because the input
 * space (32 bytes = 256 bits) is already far beyond any rainbow
 * table's reach and the keys themselves are high-entropy random.
 */

const KEY_PREFIX = "dino_live_";

export interface ApiKeyRecord {
  id: number;
  ownerWallet: string;
  keyPrefix: string;
  label: string | null;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreateApiKeyResult {
  id: number;
  key: string; // returned exactly once
  keyPrefix: string;
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(
  ownerWallet: string,
  label: string | null,
): Promise<CreateApiKeyResult> {
  const randomPart = crypto.randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${randomPart}`;
  const keyHash = hashKey(key);
  const keyPrefix = key.slice(0, 14); // "dino_live_" + first 4 random chars

  const [row] = await db
    .insert(apiKeys)
    .values({
      ownerWallet,
      keyPrefix,
      keyHash,
      label,
      active: true,
    })
    .returning({ id: apiKeys.id });
  if (!row) throw new Error("failed to create api key");
  return { id: row.id, key, keyPrefix };
}

export async function listApiKeysFor(ownerWallet: string): Promise<ApiKeyRecord[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.ownerWallet, ownerWallet))
    .orderBy(apiKeys.createdAt);
  return rows.map((r) => ({
    id: r.id,
    ownerWallet: r.ownerWallet,
    keyPrefix: r.keyPrefix,
    label: r.label,
    active: r.active,
    createdAt: r.createdAt!,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
  }));
}

export async function revokeApiKey(
  id: number,
  ownerWallet: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.ownerWallet, ownerWallet)))
    .limit(1);
  if (!existing) return false;
  await db
    .update(apiKeys)
    .set({ active: false, revokedAt: new Date() })
    .where(eq(apiKeys.id, id));
  return true;
}

/**
 * In-process cache of (wallet → tier) lookups so the per-request
 * tier resolution doesn't hit the Solana RPC on every API call.
 * 5-minute TTL — a holder who just moved $DINO out might continue
 * to see the old tier briefly, which is an acceptable tradeoff to
 * keep the REST gateway's p99 latency stable.
 */
const tierCache = new Map<string, { tier: DinoTier; at: number }>();
const TIER_TTL_MS = 5 * 60 * 1000;

async function resolveTierCached(wallet: string): Promise<DinoTier> {
  const hit = tierCache.get(wallet);
  if (hit && Date.now() - hit.at < TIER_TTL_MS) return hit.tier;
  const { tier } = await dinoTierFor(wallet);
  tierCache.set(wallet, { tier, at: Date.now() });
  return tier;
}

export interface LookupResult {
  key: ApiKeyRecord;
  tier: DinoTier;
}

/**
 * Called by the REST rate-limit middleware on every request that
 * carries an Authorization header. Returns the key record + the
 * owner's current $DINO tier, or null if the key is missing /
 * invalid / revoked. Side-effect: updates `lastUsedAt`.
 */
export async function resolveApiKey(fullKey: string): Promise<LookupResult | null> {
  const keyHash = hashKey(fullKey);
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);
  if (!row) return null;

  // Best-effort last-used timestamp. Don't fail the request if this
  // update errors — tier resolution is the load-bearing path.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => undefined);

  const tier = await resolveTierCached(row.ownerWallet);
  return {
    key: {
      id: row.id,
      ownerWallet: row.ownerWallet,
      keyPrefix: row.keyPrefix,
      label: row.label,
      active: row.active,
      createdAt: row.createdAt!,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
    },
    tier,
  };
}
