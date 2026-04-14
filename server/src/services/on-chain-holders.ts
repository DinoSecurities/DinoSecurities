/**
 * On-chain HolderRecord scanner. Like on-chain-fetcher.ts but for holders.
 * Cached 2 min and serves stale results for up to 30 min if the RPC is
 * degraded, same pattern as the series fetcher.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { createRequire } from "node:module";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;

const accountsCoder = new BorshAccountsCoder(dinoCoreIdl);
const HOLDER_DISCRIMINATOR: Buffer = (() => {
  const acct = (dinoCoreIdl as any).accounts?.find((a: any) => a.name === "HolderRecord");
  return Buffer.from(acct?.discriminator ?? []);
})();

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);

export interface HolderRow {
  pda: string;
  wallet: string;
  mint: string;
  kycHash: string;
  kycExpiry: number;
  isAccredited: boolean;
  isFrozen: boolean;
  isRevoked: boolean;
  jurisdiction: string;
}

let cache: { ts: number; rows: HolderRow[] } | null = null;
const TTL_MS = 120_000;
const STALE_MAX_MS = 30 * 60_000;

export async function fetchHoldersForMint(mint: string): Promise<HolderRow[]> {
  const all = await fetchAllHolders();
  return all.filter((h) => h.mint === mint);
}

export async function fetchHolderByMintAndWallet(
  mint: string,
  wallet: string,
): Promise<HolderRow | null> {
  const all = await fetchAllHolders();
  return all.find((h) => h.mint === mint && h.wallet === wallet) ?? null;
}

async function fetchAllHolders(): Promise<HolderRow[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.rows;
  if (HOLDER_DISCRIMINATOR.length !== 8) return [];

  const t0 = Date.now();
  let accounts;
  try {
    accounts = await Promise.race([
      connection.getProgramAccounts(programId, {
        commitment: "confirmed",
        filters: [{ memcmp: { offset: 0, bytes: bs58.encode(HOLDER_DISCRIMINATOR) } }],
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("RPC timeout after 15s")), 15000),
      ),
    ]);
    console.log(`[on-chain-holders] got ${accounts.length} holders in ${Date.now() - t0}ms`);
  } catch (err) {
    if (cache && Date.now() - cache.ts < STALE_MAX_MS) {
      console.warn(`[on-chain-holders] serving stale (${Date.now() - cache.ts}ms) after`, (err as Error).message);
      return cache.rows;
    }
    console.error(`[on-chain-holders] RPC failed after ${Date.now() - t0}ms:`, err);
    throw err;
  }

  const rows: HolderRow[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      const d: any = accountsCoder.decode("HolderRecord", account.data);
      const jurisdictionBytes = d.jurisdiction as number[] | undefined;
      const jurisdiction = jurisdictionBytes
        ? String.fromCharCode(...jurisdictionBytes).replace(/\0/g, "").trim()
        : "";
      const kycHash = d.kyc_hash ?? d.kycHash;
      rows.push({
        pda: pubkey.toBase58(),
        wallet: (d.wallet as PublicKey).toBase58(),
        mint: (d.mint as PublicKey).toBase58(),
        kycHash: kycHash ? Buffer.from(kycHash as any).toString("hex") : "",
        kycExpiry: Number(d.kyc_expiry ?? d.kycExpiry ?? 0),
        isAccredited: Boolean(d.is_accredited ?? d.isAccredited),
        isFrozen: Boolean(d.is_frozen ?? d.isFrozen),
        isRevoked: Boolean(d.is_revoked ?? d.isRevoked),
        jurisdiction,
      });
    } catch (err) {
      console.warn("[on-chain-holders] decode failed:", err);
    }
  }

  cache = { ts: Date.now(), rows };
  return rows;
}
