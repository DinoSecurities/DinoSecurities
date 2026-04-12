import { PublicKey } from "@solana/web3.js";

export type SecurityType = "Equity" | "Debt" | "Fund" | "LLC";

export type TransferRestriction = "RegD" | "RegS" | "RegCF" | "RegA+" | "Ricardian" | "None";

export type SecurityStatus = "active" | "paused" | "pending";

export interface SecuritySeries {
  mint: PublicKey;
  issuer: PublicKey;
  name: string;
  symbol: string;
  securityType: SecurityType;
  docHash: string;
  docUri: string;
  isin: string;
  maxSupply: number;
  currentSupply: number;
  transferRestrictions: TransferRestriction;
  jurisdiction: string;
  status: SecurityStatus;
  governance: PublicKey | null;
  createdAt: number;
}

export interface SecuritySeriesDisplay extends SecuritySeries {
  holders: number;
  price: number;
  change24h: number;
}
