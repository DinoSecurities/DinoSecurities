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

const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);

let cache: { ts: number; rows: OnChainSeriesRow[] } | null = null;
const TTL_MS = 30_000;

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

  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(SERIES_DISCRIMINATOR) } }],
  });

  const rows: OnChainSeriesRow[] = [];
  for (const { account } of accounts) {
    try {
      const decoded = accountsCoder.decode("SecuritySeries", account.data);
      rows.push({
        mintAddress: (decoded.mint as PublicKey).toBase58(),
        issuer: (decoded.issuer as PublicKey).toBase58(),
        name: String(decoded.name ?? ""),
        symbol: String(decoded.symbol ?? ""),
        securityType: enumKey(decoded.securityType),
        docHash: Buffer.from(decoded.docHash).toString("hex"),
        docUri: String(decoded.docUri ?? ""),
        isin: decoded.isin ? String(decoded.isin) : null,
        maxSupply: Number(decoded.maxSupply ?? 0),
        currentSupply: Number(decoded.currentSupply ?? 0),
        transferRestrictions: enumKey(decoded.transferRestriction),
        jurisdiction: "",
        status: decoded.paused ? "paused" : "active",
        governance:
          decoded.governanceRealm && (decoded.governanceRealm as PublicKey).toBase58() !== "11111111111111111111111111111111"
            ? (decoded.governanceRealm as PublicKey).toBase58()
            : null,
        createdAt: new Date(Number(decoded.createdAt ?? 0) * 1000),
        indexedAt: new Date(),
        lastUpdated: new Date(),
      });
    } catch (err) {
      console.warn("series decode failed:", err);
    }
  }

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

