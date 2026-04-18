import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import { dinoCoreIdl } from "./idl.js";
import { deriveHolderPda, derivePlatformPda } from "./pdas.js";

/**
 * Thin helpers that produce dino_core TransactionInstructions from
 * logical arguments — the consumer passes what they mean, not the
 * full PDA + account-resolution ceremony. Every helper accepts a
 * pre-built Anchor Program instance so the consumer controls the
 * Connection + Wallet wiring; the SDK does not instantiate providers.
 */

export interface BuildRegisterHolderIxArgs {
  /** The Anchor Program handle for dino_core. Use `new anchor.Program(dinoCoreIdl, provider)`. */
  program: anchor.Program;
  /** SecuritySeries mint. */
  mint: PublicKey;
  /** Wallet being whitelisted. */
  holder: PublicKey;
  /** KYC oracle account — required to appear as a signer on the resulting tx. */
  oracle: PublicKey;
  /** 32-byte SHA-256 commitment to the holder's KYC attestation. */
  kycHash: Uint8Array;
  /** Unix seconds at which the KYC record expires. Defaults to now + 365 days. */
  kycExpiryUnix?: number;
  /** Whether the holder is an accredited investor per Reg D standards. */
  isAccredited: boolean;
  /** ISO-3166 2-letter country code. Space-padded to 2 chars on-chain. */
  jurisdiction: string;
}

/**
 * Build a dino_core register_holder instruction. The caller handles
 * signing + submission — usually: (a) the issuer signs as fee payer,
 * (b) the backend co-signs as the oracle via cosignAndSubmit.
 */
export async function buildRegisterHolderIx(
  args: BuildRegisterHolderIxArgs,
): Promise<TransactionInstruction> {
  if (args.kycHash.length !== 32) {
    throw new Error("kycHash must be 32 bytes");
  }
  if (args.jurisdiction.length > 2) {
    throw new Error("jurisdiction must be a 2-letter ISO code");
  }
  const j = args.jurisdiction.padEnd(2, " ").slice(0, 2);
  const jurisdictionBytes = [j.charCodeAt(0), j.charCodeAt(1)];
  const expiry = new anchor.BN(
    args.kycExpiryUnix ?? Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
  );

  const [platformPda] = derivePlatformPda(args.program.programId);
  const [holderPda] = deriveHolderPda(
    args.mint,
    args.holder,
    args.program.programId,
  );

  return args.program.methods
    .registerHolder(
      args.holder,
      Array.from(args.kycHash),
      expiry,
      args.isAccredited,
      jurisdictionBytes,
    )
    .accountsStrict({
      platform: platformPda,
      holder: holderPda,
      mint: args.mint,
      signer: args.oracle,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Convenience helper that wires up an Anchor Program handle for
 * dino_core given a connection + wallet provider. Returned handle
 * works for *any* dino_core instruction — build, read, subscribe.
 */
export function makeDinoCoreProgram(
  provider: anchor.AnchorProvider,
  programId?: PublicKey,
): anchor.Program {
  // The IDL already has an address field; the override is for deployments
  // where the program was redeployed (e.g. local test validator).
  const idl = programId
    ? { ...dinoCoreIdl, address: programId.toBase58() }
    : dinoCoreIdl;
  return new anchor.Program(idl, provider);
}
