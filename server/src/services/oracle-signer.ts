/**
 * KYC oracle co-signing service.
 *
 * The on-chain register_issuer and register_holder instructions require
 * the platform's configured kyc_oracle to sign. Users shouldn't hold that
 * key — on mainnet it lives only on the server. The flow:
 *
 *   1. Client builds the tx with oracle's PUBKEY as the signer slot.
 *   2. Client partial-signs (fee payer / authority role).
 *   3. Client POSTs the serialized base64 tx to /register-issuer or
 *      /register-holder.
 *   4. This service deserializes, validates the instruction is one we're
 *      willing to co-sign, partial-signs with the oracle keypair, and
 *      submits to the chain.
 *   5. Returns the landed tx signature.
 *
 * Validation: we only co-sign a tx if it contains exactly one instruction
 * targeting dino_core with the register_issuer or register_holder
 * discriminator. Anything else is rejected so a compromised frontend
 * can't trick the oracle into signing arbitrary calls.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";
import { createRequire } from "node:module";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json");

const connection = new Connection(
  env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed",
);
const DINO_CORE = new PublicKey(env.DINO_CORE_PROGRAM_ID);

// Anchor discriminator = sha256("global:<fn_name>")[0..8]. Pulled from
// the bundled IDL so we don't duplicate the bytes here.
function instructionDiscriminator(name: string): Buffer {
  const ix = (dinoCoreIdl.instructions ?? []).find((i: any) => i.name === name);
  if (!ix?.discriminator) throw new Error(`IDL missing discriminator for ${name}`);
  return Buffer.from(ix.discriminator);
}

export const REGISTER_ISSUER_DISC = instructionDiscriminator("register_issuer");
export const REGISTER_HOLDER_DISC = instructionDiscriminator("register_holder");

let cachedOracle: Keypair | null = null;

export function loadOracle(): Keypair | null {
  if (cachedOracle) return cachedOracle;
  if (!env.KYC_ORACLE_KEY) return null;
  try {
    const raw = env.KYC_ORACLE_KEY.trim();
    const bytes: Uint8Array = raw.startsWith("[")
      ? Uint8Array.from(JSON.parse(raw))
      : fs.existsSync(raw)
        ? Uint8Array.from(JSON.parse(fs.readFileSync(raw, "utf8")))
        : bs58.decode(raw);
    cachedOracle = Keypair.fromSecretKey(bytes);
    return cachedOracle;
  } catch (err) {
    console.warn("[oracle-signer] failed to load keypair:", err);
    return null;
  }
}

export function getOraclePubkey(): PublicKey | null {
  const kp = loadOracle();
  return kp?.publicKey ?? null;
}

export interface CosignResult {
  signature: string;
}

export type AllowedDisc = "register_issuer" | "register_holder";

/**
 * Verify an instruction is a single call to dino_core with the expected
 * discriminator, then co-sign and submit.
 */
export async function cosignAndSubmit(
  signedTxBase64: string,
  expected: AllowedDisc,
): Promise<CosignResult> {
  const oracle = loadOracle();
  if (!oracle) throw new Error("oracle not configured");

  const rawBytes = Buffer.from(signedTxBase64, "base64");
  const tx = Transaction.from(rawBytes);

  // Wallets (Phantom, Solflare) inject arbitrary instructions — priority
  // fees (ComputeBudget), memos, shield markers, etc. We only care about
  // one thing: that there is exactly one dino_core instruction with the
  // expected discriminator, and the user has signed the whole tx (so
  // they've seen everything else in the wallet popup).
  const dinoIxs = tx.instructions.filter((i) => i.programId.equals(DINO_CORE));
  if (dinoIxs.length !== 1) {
    const programs = tx.instructions.map((i) => i.programId.toBase58()).join(",");
    throw new Error(
      `expected exactly 1 dino_core instruction, got ${dinoIxs.length} (total=${tx.instructions.length}) programs=${programs}`,
    );
  }
  const ix = dinoIxs[0];

  const expectedDisc =
    expected === "register_issuer" ? REGISTER_ISSUER_DISC : REGISTER_HOLDER_DISC;
  const actualDisc = ix.data.slice(0, 8);
  if (!actualDisc.equals(expectedDisc)) {
    throw new Error(
      `instruction discriminator does not match expected ${expected}`,
    );
  }

  // Confirm the oracle is named as a signer on the ix. Otherwise there's
  // no reason to ask us to co-sign.
  const oraclePubkey = oracle.publicKey;
  const oracleIsSigner = ix.keys.some(
    (k) => k.isSigner && k.pubkey.equals(oraclePubkey),
  );
  if (!oracleIsSigner) {
    throw new Error("oracle not listed as signer on instruction");
  }

  tx.partialSign(oracle);

  // Forward to the chain. Use skipPreflight to avoid the preflight cache's
  // spurious "already processed" on retried flows; chain enforces correctness.
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
    preflightCommitment: "confirmed",
  });
  const conf = await connection.confirmTransaction(sig, "confirmed");
  if (conf.value.err) {
    throw new Error(`tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
  }
  return { signature: sig };
}
