import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { env } from "../env.js";

/**
 * Server-side $DINO balance + tier resolver. The frontend already
 * displays a cached read for UX; this is the authoritative version
 * that paid-fee flows consult to apply a discount — it must be read
 * server-side so a malicious client can't claim a tier they don't
 * hold. Same on-chain RPC source, different trust boundary.
 *
 * $DINO is classic SPL (pump.fun), not Token-2022.
 */

export const DINO_MINT = new PublicKey(
  "6BUv6SWDDtyvzbYaUisPubfGpYxibr5hdbqcpv3Ypump",
);

export interface DinoTier {
  id: 0 | 1 | 2 | 3;
  name: string;
  minBalance: number;
  discountPct: number;
}

export const DINO_TIERS: readonly DinoTier[] = [
  { id: 0, name: "Base", minBalance: 0, discountPct: 0 },
  { id: 1, name: "Bronze", minBalance: 100_000, discountPct: 10 },
  { id: 2, name: "Silver", minBalance: 1_000_000, discountPct: 20 },
  { id: 3, name: "Gold", minBalance: 5_000_000, discountPct: 30 },
] as const;

export function tierForBalance(balance: number): DinoTier {
  let match = DINO_TIERS[0];
  for (const t of DINO_TIERS) {
    if (balance >= t.minBalance) match = t;
  }
  return match;
}

const RPC_URL =
  env.SOLANA_RPC_URL ||
  env.SOLANA_RPC_FALLBACK ||
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

export async function getDinoBalance(walletBase58: string): Promise<number> {
  const wallet = new PublicKey(walletBase58);
  const response = await connection.getParsedTokenAccountsByOwner(
    wallet,
    { mint: DINO_MINT, programId: TOKEN_PROGRAM_ID },
    "confirmed",
  );
  if (response.value.length === 0) return 0;
  const parsed = (response.value[0].account.data as any).parsed?.info;
  return Number(parsed?.tokenAmount?.uiAmount ?? 0);
}

export async function dinoTierFor(walletBase58: string): Promise<{
  wallet: string;
  balance: number;
  tier: DinoTier;
  checkedAt: string;
}> {
  const balance = await getDinoBalance(walletBase58);
  return {
    wallet: walletBase58,
    balance,
    tier: tierForBalance(balance),
    checkedAt: new Date().toISOString(),
  };
}
