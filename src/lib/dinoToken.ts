import { PublicKey } from "@solana/web3.js";

/**
 * $DINO — the DinoSecurities community token. Launched on pump.fun,
 * lives on Solana mainnet, classic SPL token (not Token-2022). The
 * platform uses $DINO balance as the signal for a fee-discount tier
 * applied to paid-for platform services (issuer fees, API overage,
 * paid uploads). Holding is non-custodial — the platform reads balance
 * via standard RPC and never takes custody.
 *
 * $DINO is NOT a security. Holding it does not confer equity, profit
 * share, revenue distribution, or governance over the regulated
 * securities infrastructure. Utility is limited to access perks and
 * fee discounts on platform services.
 */

export const DINO_MINT = new PublicKey(
  "6BUv6SWDDtyvzbYaUisPubfGpYxibr5hdbqcpv3Ypump",
);

/** pump.fun tokens default to 6 decimals. */
export const DINO_DECIMALS = 6;

export const DINO_TOTAL_SUPPLY = 1_000_000_000; // 1B, standard pump.fun launch
export const DINO_PUMPFUN_URL =
  "https://pump.fun/coin/6BUv6SWDDtyvzbYaUisPubfGpYxibr5hdbqcpv3Ypump";

/**
 * Fee-discount tiers. Thresholds are UI-decimal $DINO (not raw).
 * The tier assigned is the highest threshold whose minimum the
 * holder's balance clears. Tier 0 is "no holdings" — all fees at
 * standard rate, no perk access.
 */
export interface DinoTier {
  id: 0 | 1 | 2 | 3;
  name: string;
  minBalance: number;
  discountPct: number; // 0–100; applied as (1 - pct/100) * fee
  label: string;
  accentClass: string;
}

export const DINO_TIERS: readonly DinoTier[] = [
  {
    id: 0,
    name: "Base",
    minBalance: 0,
    discountPct: 0,
    label: "Standard rates",
    accentClass: "text-muted-foreground",
  },
  {
    id: 1,
    name: "Bronze",
    minBalance: 100_000,
    discountPct: 10,
    label: "10% off platform fees",
    accentClass: "text-amber-600",
  },
  {
    id: 2,
    name: "Silver",
    minBalance: 1_000_000,
    discountPct: 20,
    label: "20% off platform fees",
    accentClass: "text-zinc-300",
  },
  {
    id: 3,
    name: "Gold",
    minBalance: 5_000_000,
    discountPct: 30,
    label: "30% off platform fees",
    accentClass: "text-primary",
  },
] as const;

export function tierForBalance(balance: number): DinoTier {
  let match = DINO_TIERS[0];
  for (const t of DINO_TIERS) {
    if (balance >= t.minBalance) match = t;
  }
  return match;
}

export function nextTier(balance: number): DinoTier | null {
  for (const t of DINO_TIERS) {
    if (balance < t.minBalance) return t;
  }
  return null;
}

/**
 * Helper the rest of the codebase calls to price a $DINO-paid flow.
 * Pass in the USDC price (fee in standard currency); returns the
 * discount adjusted amount the holder pays. Discount is a pure
 * multiplier; no reductions from currency conversion or routing.
 */
export function applyDinoDiscount(baseFeeUsdc: number, balance: number): {
  tier: DinoTier;
  fee: number;
  saved: number;
} {
  const tier = tierForBalance(balance);
  const fee = baseFeeUsdc * (1 - tier.discountPct / 100);
  return { tier, fee, saved: baseFeeUsdc - fee };
}

/**
 * Fee schedule that $DINO tier discounts apply to. Not all of these
 * are live as paid surfaces today — listing them up-front so holders
 * can see where their tier will pay off as billing ships.
 */
export const DINO_FEE_SURFACES: Array<{
  id: string;
  label: string;
  description: string;
  status: "live" | "planned";
}> = [
  {
    id: "issuer-deploy",
    label: "Series deployment fee",
    description:
      "Paid by issuers when deploying a new security series. Currently network-cost only (rent + priority fee). Platform fee ships with the mainnet cutover.",
    status: "planned",
  },
  {
    id: "document-upload",
    label: "Legal document upload",
    description:
      "Irys-backed Arweave upload for Ricardian legal documents. Issuers pay the data-cost; $DINO discount applies to the platform markup once paid-tier billing ships.",
    status: "planned",
  },
  {
    id: "rest-overage",
    label: "REST API rate-limit tier",
    description:
      "Public /api/v1 endpoints default to 60 req/min/IP. Generate an API key from this page and attach it as Authorization: Bearer — your limit lifts to your $DINO tier's rate: Bronze 300, Silver 1200, Gold 3000 req/min. Tier is resolved live from your balance at request time.",
    status: "live",
  },
  {
    id: "bulk-whitelist",
    label: "Bulk holder onboarding",
    description:
      "CSV bulk whitelist is free today. When per-holder processing fees ship (for sanctions screening + KYC oracle co-sign), $DINO holders pay the discounted rate.",
    status: "planned",
  },
  {
    id: "community-governance",
    label: "Community governance (advisory)",
    description:
      "Bronze-tier holders vote on $DINO-weighted advisory proposals at /app/community/governance; Gold-tier holders can create them. Outcomes are non-binding polls on marketing, community grants, and feature priorities — they never execute on-chain and never touch regulated securities governance.",
    status: "live",
  },
];
