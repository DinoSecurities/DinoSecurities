/**
 * On-chain fallback for the indexed-series tables. When the Helius webhook
 * pipeline misses an event (or hasn't fired yet), the frontend would see an
 * empty marketplace despite the series existing on-chain. This module reads
 * SecuritySeries PDAs directly via getProgramAccounts + a discriminator
 * filter, decodes them with Anchor's BorshAccountsCoder, and shapes them
 * into the same row format the indexed_series table uses.
 *
 * Memoised for 30 seconds to avoid hammering the RPC.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { createRequire } from "node:module";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;

const accountsCoder = new BorshAccountsCoder(dinoCoreIdl);
const SERIES_DISCRIMINATOR = (() => {
  // Anchor 0.32 IDL exposes the 8-byte discriminator on each account entry.
  const acct = (dinoCoreIdl.accounts ?? []).find((a: any) => a.name === "SecuritySeries");
  return Buffer.from((acct as any)?.discriminator ?? []);
})();

// Use the configured RPC. Helius free tier blocks getProgramAccounts
// — paid plan + the public mainnet-beta RPC both allow it. If the
// configured RPC rejects, fall back to the public cluster RPC.
const RPC_URL =
  env.SOLANA_RPC_FALLBACK ||
  env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);
console.log(`[on-chain-fetcher] scanning program ${programId.toBase58()} via ${RPC_URL}`);

let cache: { ts: number; rows: OnChainSeriesRow[] } | null = null;
// Two-minute TTL to survive public-RPC rate limits. Once the Helius
// webhook pipeline is populating indexed_series, this fetcher rarely
// runs anyway (only when the DB query returns 0 rows).
const TTL_MS = 120_000;
const STALE_MAX_MS = 30 * 60_000; // serve stale up to 30 min on RPC failure

export interface OnChainSeriesRow {
  mintAddress: string;
  issuer: string;
  name: string;
  symbol: string;
  securityType: string;
  docHash: string;
  docUri: string;
  isin: string | null;
  maxSupply: number;
  currentSupply: number;
  transferRestrictions: string;
  jurisdiction: string;
  status: string;
  governance: string | null;
  createdAt: Date;
  indexedAt: Date;
  lastUpdated: Date;
}

export async function fetchSeriesOnChain(): Promise<OnChainSeriesRow[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.rows;
  if (SERIES_DISCRIMINATOR.length !== 8) return [];

  // Cap the RPC call so a slow/dead RPC doesn't make the route hang.
  const t0 = Date.now();
  let accounts;
  try {
    accounts = await Promise.race([
      connection.getProgramAccounts(programId, {
        commitment: "confirmed",
        filters: [{ memcmp: { offset: 0, bytes: bs58.encode(SERIES_DISCRIMINATOR) } }],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("RPC timeout after 15s")), 15000)),
    ]);
    console.log(`[on-chain-fetcher] got ${accounts.length} accounts in ${Date.now() - t0}ms`);
  } catch (err) {
    // On 503 / timeout / any transient RPC failure, serve a stale cache
    // (up to 30 min old) rather than propagating the error. Fresh events
    // aren't worth taking the route down over.
    if (cache && Date.now() - cache.ts < STALE_MAX_MS) {
      console.warn(`[on-chain-fetcher] serving stale cache (${Date.now() - cache.ts}ms old) after RPC failure:`, (err as Error).message);
      return cache.rows;
    }
    console.error(`[on-chain-fetcher] RPC failed after ${Date.now() - t0}ms:`, err);
    throw err;
  }

  const rows: OnChainSeriesRow[] = [];
  for (const { account } of accounts) {
    try {
      const d: any = accountsCoder.decode("SecuritySeries", account.data);
      // Anchor 0.32 IDL preserves Rust snake_case for account fields, but
      // some toolchains camelCase on decode — accept both.
      const pick = <T,>(snake: string, camel: string): T | undefined =>
        d[snake] !== undefined ? d[snake] : d[camel];
      const docHash = pick<number[] | Buffer>("doc_hash", "docHash");
      const docUri = pick<string>("doc_uri", "docUri");
      const maxSupply = pick<any>("max_supply", "maxSupply");
      const currentSupply = pick<any>("current_supply", "currentSupply");
      const securityType = pick<any>("security_type", "securityType");
      const transferRestriction = pick<any>("transfer_restriction", "transferRestriction");
      const governanceRealm = pick<any>("governance_realm", "governanceRealm");
      const createdAt = pick<any>("created_at", "createdAt");
      rows.push({
        mintAddress: (d.mint as PublicKey).toBase58(),
        issuer: (d.issuer as PublicKey).toBase58(),
        name: String(d.name ?? ""),
        symbol: String(d.symbol ?? ""),
        securityType: enumKey(securityType),
        docHash: docHash ? Buffer.from(docHash as any).toString("hex") : "",
        docUri: String(docUri ?? ""),
        isin: d.isin ? String(d.isin) : null,
        maxSupply: Number(maxSupply ?? 0),
        currentSupply: Number(currentSupply ?? 0),
        transferRestrictions: enumKey(transferRestriction),
        jurisdiction: "",
        status: d.paused ? "paused" : "active",
        governance:
          governanceRealm && (governanceRealm as PublicKey).toBase58?.() !== "11111111111111111111111111111111"
            ? (governanceRealm as PublicKey).toBase58?.() ?? null
            : null,
        createdAt: new Date(Number(createdAt ?? 0) * 1000),
        indexedAt: new Date(),
        lastUpdated: new Date(),
      });
    } catch (err) {
      console.warn("series decode failed:", err);
    }
  }
  console.log(`[on-chain-fetcher] decoded ${rows.length} series rows`);

  cache = { ts: Date.now(), rows };
  return rows;
}

export async function fetchSeriesByMint(mint: string): Promise<OnChainSeriesRow | null> {
  const all = await fetchSeriesOnChain();
  return all.find((s) => s.mintAddress === mint) ?? null;
}

function enumKey(v: any): string {
  if (!v || typeof v !== "object") return "Unknown";
  const k = Object.keys(v)[0] ?? "Unknown";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

