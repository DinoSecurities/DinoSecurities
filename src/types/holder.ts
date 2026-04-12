import { PublicKey } from "@solana/web3.js";

export type KYCStatus = "pending" | "verified" | "expired" | "revoked";

export interface HolderRecord {
  mint: PublicKey;
  holder: PublicKey;
  kycHash: string;
  kycExpiry: number;
  isAccredited: boolean;
  isFrozen: boolean;
  isRevoked: boolean;
}

export interface Holding {
  mint: PublicKey;
  name: string;
  symbol: string;
  securityType: string;
  balance: number;
  value: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  jurisdiction: string;
  transferRestrictions: string;
  docUri: string;
}
