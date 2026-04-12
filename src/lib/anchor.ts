import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { PROGRAM_IDS } from "./solana";

// Placeholder IDLs — these will be replaced with real IDLs once Sorrow deploys the programs
// For now they define the account/instruction structure we expect

export const DINO_CORE_IDL: Idl = {
  version: "0.1.0",
  name: "dino_core",
  instructions: [
    {
      name: "initializePlatform",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "platform", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "registerIssuer",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "issuerProfile", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "legalName", type: "string" },
        { name: "jurisdiction", type: "string" },
        { name: "kycHash", type: "string" },
      ],
    },
    {
      name: "createSecuritySeries",
      accounts: [
        { name: "issuer", isMut: true, isSigner: true },
        { name: "issuerProfile", isMut: true, isSigner: false },
        { name: "securitySeries", isMut: true, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "securityType", type: "u8" },
        { name: "docHash", type: "string" },
        { name: "docUri", type: "string" },
        { name: "isin", type: "string" },
        { name: "maxSupply", type: "u64" },
        { name: "jurisdiction", type: "string" },
        { name: "transferRestrictions", type: "u8" },
      ],
    },
    {
      name: "registerHolder",
      accounts: [
        { name: "oracle", isMut: true, isSigner: true },
        { name: "holderRecord", isMut: true, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "holder", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "kycHash", type: "string" },
        { name: "kycExpiry", type: "i64" },
        { name: "isAccredited", type: "bool" },
      ],
    },
    {
      name: "createSettlementOrder",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "order", isMut: true, isSigner: false },
        { name: "securityMint", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "orderId", type: "string" },
        { name: "tokenAmount", type: "u64" },
        { name: "usdcAmount", type: "u64" },
        { name: "side", type: "u8" },
      ],
    },
    {
      name: "cancelSettlementOrder",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "order", isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: "emergencyPause",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "securitySeries", isMut: true, isSigner: false },
      ],
      args: [{ name: "reason", type: "string" }],
    },
  ],
  accounts: [
    {
      name: "IssuerProfile",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "legalName", type: "string" },
          { name: "jurisdiction", type: "string" },
          { name: "kycHash", type: "string" },
          { name: "kycExpiry", type: "i64" },
          { name: "isActive", type: "bool" },
          { name: "seriesCount", type: "u32" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "SecuritySeries",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "publicKey" },
          { name: "issuer", type: "publicKey" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "securityType", type: "u8" },
          { name: "docHash", type: "string" },
          { name: "docUri", type: "string" },
          { name: "isin", type: "string" },
          { name: "maxSupply", type: "u64" },
          { name: "currentSupply", type: "u64" },
          { name: "transferRestrictions", type: "u8" },
          { name: "jurisdiction", type: "string" },
          { name: "governance", type: { option: "publicKey" } },
          { name: "isPaused", type: "bool" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "HolderRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "publicKey" },
          { name: "holder", type: "publicKey" },
          { name: "kycHash", type: "string" },
          { name: "kycExpiry", type: "i64" },
          { name: "isAccredited", type: "bool" },
          { name: "isFrozen", type: "bool" },
          { name: "isRevoked", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "SettlementOrder",
      type: {
        kind: "struct",
        fields: [
          { name: "orderId", type: "string" },
          { name: "buyer", type: "publicKey" },
          { name: "seller", type: { option: "publicKey" } },
          { name: "securityMint", type: "publicKey" },
          { name: "tokenAmount", type: "u64" },
          { name: "usdcAmount", type: "u64" },
          { name: "status", type: "u8" },
          { name: "createdAt", type: "i64" },
          { name: "settledAt", type: { option: "i64" } },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "Unauthorized", msg: "Not authorized" },
    { code: 6001, name: "SeriesPaused", msg: "Security series is paused" },
    { code: 6002, name: "MaxSupplyExceeded", msg: "Max supply exceeded" },
    { code: 6003, name: "KYCExpired", msg: "KYC has expired" },
    { code: 6004, name: "HolderRevoked", msg: "Holder has been revoked" },
    { code: 6005, name: "OrderNotCancellable", msg: "Order cannot be cancelled" },
  ],
};

/**
 * Hook to get the Anchor provider from the connected wallet
 */
export function useAnchorProvider(): AnchorProvider | null {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  return useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
  }, [wallet, connection]);
}

/**
 * Hook to get the dino_core program client
 */
export function useDinoCoreProgram(): Program | null {
  const provider = useAnchorProvider();

  return useMemo(() => {
    if (!provider) return null;
    return new Program(DINO_CORE_IDL, PROGRAM_IDS.DINO_CORE, provider);
  }, [provider]);
}
