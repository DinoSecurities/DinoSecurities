import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { createRequire } from "node:module";
import { env } from "../env.js";
import { dinoTierFor, type DinoTier } from "./dino-balance.js";
import { resolveHandle } from "./dino-handles.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;
const accountsCoder = new BorshAccountsCoder(dinoCoreIdl);

const RPC_URL =
  env.SOLANA_RPC_FALLBACK ||
  env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);

/**
 * Resolve a SecuritySeries mint to the wallet that controls the issuer
 * behind it, then resolve that wallet to its $DINO tier and (if any)
 * community handle. This is the load-bearing helper for every tier-
 * gated issuer feature — embed widget themes, sponsorship badges,
 * early-access scheduling, vanity prefixes, portal branding.
 *
 * The chain lookup is two-step:
 *   1. SecuritySeries.issuer       → IssuerProfile PDA
 *   2. IssuerProfile.authority     → the wallet we care about
 *
 * Results are cached in-process for 10 minutes — issuer authorities
 * change on the order of never, and the RPC round-trip adds latency
 * to every SecurityDetail render.
 */

interface CachedEntry {
  authority: string;
  tier: DinoTier;
  handleDisplay: string | null;
  at: number;
}

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CachedEntry>();

async function fetchSeriesAccount(
  mint: PublicKey,
): Promise<{ issuerPda: PublicKey }> {
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), mint.toBuffer()],
    programId,
  );
  const info = await connection.getAccountInfo(seriesPda, "confirmed");
  if (!info) throw new Error(`series PDA not found for mint ${mint.toBase58()}`);
  const decoded: any = accountsCoder.decode("SecuritySeries", info.data);
  const issuerPda = (decoded.issuer as PublicKey) ?? null;
  if (!issuerPda) throw new Error("SecuritySeries.issuer missing");
  return { issuerPda };
}

async function fetchIssuerAuthority(
  issuerPda: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(issuerPda, "confirmed");
  if (!info) throw new Error(`issuer profile not found at ${issuerPda.toBase58()}`);
  const decoded: any = accountsCoder.decode("IssuerProfile", info.data);
  return decoded.authority as PublicKey;
}

export interface IssuerTierResolution {
  mint: string;
  issuerWallet: string | null;
  tier: DinoTier;
  supported: boolean; // tier >= Bronze
  handleDisplay: string | null;
  checkedAt: string;
}

export async function issuerTierForSeries(
  mintBase58: string,
): Promise<IssuerTierResolution> {
  const cached = cache.get(mintBase58);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return {
      mint: mintBase58,
      issuerWallet: cached.authority,
      tier: cached.tier,
      supported: cached.tier.id >= 1,
      handleDisplay: cached.handleDisplay,
      checkedAt: new Date(cached.at).toISOString(),
    };
  }

  try {
    const mint = new PublicKey(mintBase58);
    const { issuerPda } = await fetchSeriesAccount(mint);
    const authority = await fetchIssuerAuthority(issuerPda);
    const authorityBase58 = authority.toBase58();
    const { tier } = await dinoTierFor(authorityBase58);
    const handle = await resolveHandle(authorityBase58);
    const handleDisplay = handle?.displayHandle ?? null;

    cache.set(mintBase58, {
      authority: authorityBase58,
      tier,
      handleDisplay,
      at: Date.now(),
    });

    return {
      mint: mintBase58,
      issuerWallet: authorityBase58,
      tier,
      supported: tier.id >= 1,
      handleDisplay,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    // Series not on chain yet, or RPC hiccup — return a base-tier
    // resolution so callers render the standard non-supported surface
    // rather than a loading spinner forever.
    const baseTier = (await import("./dino-balance.js")).DINO_TIERS[0];
    return {
      mint: mintBase58,
      issuerWallet: null,
      tier: baseTier,
      supported: false,
      handleDisplay: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function invalidateIssuerTierCache(mintBase58: string): void {
  cache.delete(mintBase58);
}
