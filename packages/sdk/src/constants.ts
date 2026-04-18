import { PublicKey } from "@solana/web3.js";

/**
 * PDA seeds as they appear in dino_core / dino_transfer_hook / dino_governance.
 * Keep in sync with the `seeds` sections in the Anchor programs.
 */
export const PDA_SEEDS = {
  PLATFORM: "platform",
  ISSUER: "issuer",
  SERIES: "series",
  HOLDER: "holder",
  EXTRA_ACCOUNT_METAS: "extra-account-metas",
  ORDER: "order",
  REALM: "realm",
  PROPOSAL: "proposal",
  VOTE: "vote",
} as const;

/**
 * Devnet defaults. Deployed program IDs may differ per environment —
 * callers can pass their own when constructing the SDK, or override via
 * environment variables when they run their integration.
 */
export const DEFAULT_PROGRAM_IDS = {
  TOKEN_2022: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
  SPL_GOVERNANCE: new PublicKey("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"),
  ASSOCIATED_TOKEN_PROGRAM: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
} as const;

export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEFAULT_API_BASE = "https://api.dinosecurities.com";
