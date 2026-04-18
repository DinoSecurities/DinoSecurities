import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { createRequire } from "node:module";
import bs58 from "bs58";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;
const accountsCoder = new BorshAccountsCoder(dinoCoreIdl);

const RPC_URL =
  env.SOLANA_RPC_FALLBACK || env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);

/**
 * Supply reconciliation for a single series. The invariant being asserted:
 *
 *   SecuritySeries.current_supply  ==  Σ(all Token-2022 account balances for this mint)
 *
 * The right-hand side is broken out by bucket — (a) the seriesPda's own
 * ATA (the "not-yet-distributed" issuer float) and (b) everything else
 * (the "distributed" holder float) — so a reader can see *where* the
 * supply lives. If LHS != RHS we have a token leak, a program bug, or
 * stale indexer state; the dashboard flips red and a human looks.
 */

export interface SupplyReconciliationResult {
  mint: string;
  symbol: string | null;
  onChainReported: bigint;
  sumOfAtas: bigint;
  distributedHolderFloat: bigint;
  mintAuthorityHolding: bigint;
  burned: bigint;
  delta: bigint;
  healthy: boolean;
  tokenAccountCount: number;
  checkedAt: string;
}

async function fetchSeriesAccount(mint: PublicKey): Promise<{
  currentSupply: bigint;
  symbol: string | null;
  seriesPda: PublicKey;
}> {
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), mint.toBuffer()],
    programId,
  );
  const info = await connection.getAccountInfo(seriesPda, "confirmed");
  if (!info) throw new Error(`series PDA ${seriesPda.toBase58()} not found on chain`);
  const decoded: any = accountsCoder.decode("SecuritySeries", info.data);
  const currentSupply = BigInt(
    decoded.current_supply?.toString?.() ??
      decoded.currentSupply?.toString?.() ??
      "0",
  );
  const symbol = decoded.symbol ? String(decoded.symbol) : null;
  return { currentSupply, symbol, seriesPda };
}

async function sumAllTokenAccounts(mint: PublicKey): Promise<{
  total: bigint;
  perOwner: Map<string, bigint>;
  count: number;
}> {
  const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mint.toBase58() } },
    ],
  });
  let total = 0n;
  const perOwner = new Map<string, bigint>();
  for (const { account } of accounts) {
    const data = account.data as Buffer;
    if (data.length < 72) continue;
    const owner = new PublicKey(data.subarray(32, 64)).toBase58();
    const amount = data.readBigUInt64LE(64);
    total += amount;
    perOwner.set(owner, (perOwner.get(owner) ?? 0n) + amount);
  }
  return { total, perOwner, count: accounts.length };
}

function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

export async function reconcileSupply(
  mintBase58: string,
): Promise<SupplyReconciliationResult> {
  const mint = new PublicKey(mintBase58);
  const [series, tokens] = await Promise.all([
    fetchSeriesAccount(mint),
    sumAllTokenAccounts(mint),
  ]);

  // Issuer float = the seriesPda's ATA (if it exists). The seriesPda
  // is the mint authority; undistributed tokens live here after a mint
  // instruction that hasn't yet been routed to a holder.
  const seriesAta = associatedTokenAddress(series.seriesPda, mint);
  const mintAuthorityHolding =
    tokens.perOwner.get(series.seriesPda.toBase58()) ??
    tokens.perOwner.get(seriesAta.toBase58()) ??
    0n;

  const distributedHolderFloat = tokens.total - mintAuthorityHolding;
  const burned = 0n; // TODO: read once dino_core emits a Burned event.

  const delta = series.currentSupply - (tokens.total + burned);

  return {
    mint: mintBase58,
    symbol: series.symbol,
    onChainReported: series.currentSupply,
    sumOfAtas: tokens.total,
    distributedHolderFloat,
    mintAuthorityHolding,
    burned,
    delta,
    healthy: delta === 0n,
    tokenAccountCount: tokens.count,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Discover every active series by scanning the SecuritySeries program
 * accounts (same discriminator-memcmp the on-chain-fetcher uses), then
 * reconcile each. Intended for an admin bulk-health view or a nightly
 * cron — wait for the full list before returning so the caller gets a
 * single coherent snapshot.
 */
export async function reconcileAllSeries(): Promise<SupplyReconciliationResult[]> {
  const SERIES_DISCRIMINATOR = (() => {
    const acct = (dinoCoreIdl.accounts ?? []).find(
      (a: any) => a.name === "SecuritySeries",
    );
    return Buffer.from((acct as any)?.discriminator ?? []);
  })();

  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(SERIES_DISCRIMINATOR) } }],
  });
  const mints: string[] = [];
  for (const { account } of accounts) {
    try {
      const d: any = accountsCoder.decode("SecuritySeries", account.data);
      mints.push((d.mint as PublicKey).toBase58());
    } catch {
      /* skip */
    }
  }
  return Promise.all(mints.map((m) => reconcileSupply(m).catch((err) => ({
    mint: m,
    symbol: null,
    onChainReported: 0n,
    sumOfAtas: 0n,
    distributedHolderFloat: 0n,
    mintAuthorityHolding: 0n,
    burned: 0n,
    delta: 0n,
    healthy: false,
    tokenAccountCount: 0,
    checkedAt: new Date().toISOString(),
    error: err instanceof Error ? err.message : String(err),
  } as SupplyReconciliationResult))));
}
