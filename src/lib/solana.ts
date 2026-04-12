import { PublicKey } from "@solana/web3.js";

/**
 * Truncate a Solana address for display: "7xKp...mN4q"
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * PDA seed constants matching the Anchor programs
 */
export const PDA_SEEDS = {
  ISSUER: "issuer",
  SERIES: "series",
  HOLDER: "holder",
  ORDER: "order",
  GOVERNANCE: "governance",
} as const;

/**
 * Program IDs — lazy-initialized to avoid PublicKey construction before Buffer polyfill
 */
let _programIds: {
  DINO_CORE: PublicKey;
  DINO_HOOK: PublicKey;
  DINO_GOV: PublicKey;
  SPL_GOVERNANCE: PublicKey;
  TOKEN_2022: PublicKey;
  USDC_MINT: PublicKey;
} | null = null;

export function getProgramIds() {
  if (!_programIds) {
    _programIds = {
      DINO_CORE: new PublicKey(
        import.meta.env.VITE_DINO_CORE_PROGRAM_ID || "11111111111111111111111111111111",
      ),
      DINO_HOOK: new PublicKey(
        import.meta.env.VITE_DINO_HOOK_PROGRAM_ID || "11111111111111111111111111111111",
      ),
      DINO_GOV: new PublicKey(
        import.meta.env.VITE_DINO_GOV_PROGRAM_ID || "11111111111111111111111111111111",
      ),
      SPL_GOVERNANCE: new PublicKey("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"),
      TOKEN_2022: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
      USDC_MINT: new PublicKey(
        import.meta.env.VITE_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      ),
    };
  }
  return _programIds;
}

// Backward-compatible export — lazily evaluated on first property access
export const PROGRAM_IDS = new Proxy({} as ReturnType<typeof getProgramIds>, {
  get(_, prop: string) {
    return getProgramIds()[prop as keyof ReturnType<typeof getProgramIds>];
  },
});

/**
 * Derive a PDA for IssuerProfile
 */
export function deriveIssuerProfilePDA(
  issuer: PublicKey,
  programId: PublicKey = PROGRAM_IDS.DINO_CORE,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.ISSUER), issuer.toBuffer()],
    programId,
  );
}

/**
 * Derive a PDA for SecuritySeries
 */
export function deriveSecuritySeriesPDA(
  issuer: PublicKey,
  seriesId: string,
  programId: PublicKey = PROGRAM_IDS.DINO_CORE,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.SERIES),
      issuer.toBuffer(),
      Buffer.from(seriesId),
    ],
    programId,
  );
}

/**
 * Derive a PDA for HolderRecord
 */
export function deriveHolderRecordPDA(
  mint: PublicKey,
  holder: PublicKey,
  programId: PublicKey = PROGRAM_IDS.DINO_CORE,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.HOLDER), mint.toBuffer(), holder.toBuffer()],
    programId,
  );
}

/**
 * Derive a PDA for SettlementOrder
 */
export function deriveSettlementOrderPDA(
  orderId: string,
  programId: PublicKey = PROGRAM_IDS.DINO_CORE,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.ORDER), Buffer.from(orderId)],
    programId,
  );
}

/**
 * Derive a PDA for GovernanceConfig
 */
export function deriveGovernanceConfigPDA(
  seriesMint: PublicKey,
  programId: PublicKey = PROGRAM_IDS.DINO_CORE,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.GOVERNANCE), seriesMint.toBuffer()],
    programId,
  );
}

/**
 * Format lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/**
 * Format a number as USD
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Get Solana explorer URL for a transaction or account
 */
export function getExplorerUrl(
  addressOrTx: string,
  type: "address" | "tx" = "address",
): string {
  const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `https://explorer.solana.com/${type}/${addressOrTx}${cluster}`;
}
