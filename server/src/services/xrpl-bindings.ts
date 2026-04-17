import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  xrplBindingChallenges,
  walletXrplBindings,
} from "../db/schema.js";
import {
  deriveClassicAddress,
  detectKeyType,
  verifyXrplSignature,
} from "./xrpl-signing.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Build a human-readable message that will be signed with the holder's
 * XRPL wallet. Embedding the Solana wallet and network binds the signature
 * to a specific (solanaWallet, xrplAddress, network) triple — replay-proof
 * across contexts.
 */
export function challengeMessage(
  solanaWallet: string,
  xrplAddress: string,
  network: string,
  nonce: string,
): string {
  return [
    "DinoSecurities XRPL wallet binding",
    `solanaWallet: ${solanaWallet}`,
    `xrplAddress: ${xrplAddress}`,
    `network: ${network}`,
    `nonce: ${nonce}`,
  ].join("\n");
}

export async function issueChallenge(
  solanaWallet: string,
  xrplAddress: string,
  network: "mainnet" | "testnet" | "devnet",
): Promise<{ id: number; nonce: string; message: string; expiresAt: Date }> {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const [row] = await db
    .insert(xrplBindingChallenges)
    .values({
      solanaWallet,
      xrplAddress,
      network,
      nonce,
      expiresAt,
    })
    .returning();
  if (!row) throw new Error("failed to issue challenge");
  return {
    id: row.id,
    nonce,
    message: challengeMessage(solanaWallet, xrplAddress, network, nonce),
    expiresAt,
  };
}

export interface CompleteBindingInput {
  challengeId: number;
  signatureHex: string;
  publicKeyHex: string;
}

export interface CompleteBindingResult {
  ok: true;
  bindingId: number;
  solanaWallet: string;
  xrplAddress: string;
  network: string;
  keyType: "ed25519" | "secp256k1";
}

export async function completeBinding(
  input: CompleteBindingInput,
): Promise<CompleteBindingResult> {
  const [challenge] = await db
    .select()
    .from(xrplBindingChallenges)
    .where(
      and(
        eq(xrplBindingChallenges.id, input.challengeId),
        gt(xrplBindingChallenges.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!challenge) throw new Error("challenge not found or expired");
  if (challenge.consumedAt) throw new Error("challenge already consumed");

  // Recompute the derived address from the submitted public key and
  // confirm it matches the claimed address on the challenge. This is
  // the critical check: without it, anyone could claim any XRPL
  // address by pairing a valid signature with a mismatched address.
  const derived = deriveClassicAddress(input.publicKeyHex);
  if (derived !== challenge.xrplAddress) {
    throw new Error(
      `public key derives to ${derived}, not the claimed ${challenge.xrplAddress}`,
    );
  }

  const message = challengeMessage(
    challenge.solanaWallet,
    challenge.xrplAddress,
    challenge.network,
    challenge.nonce,
  );
  const valid = verifyXrplSignature(message, input.signatureHex, input.publicKeyHex);
  if (!valid) throw new Error("signature does not verify");

  const keyType = detectKeyType(input.publicKeyHex);

  // Mark the challenge consumed before inserting so a race on double-submit
  // fails on the expiration window for the second call.
  await db
    .update(xrplBindingChallenges)
    .set({ consumedAt: new Date() })
    .where(eq(xrplBindingChallenges.id, challenge.id));

  const [binding] = await db
    .insert(walletXrplBindings)
    .values({
      solanaWallet: challenge.solanaWallet,
      xrplAddress: challenge.xrplAddress,
      xrplPublicKey: input.publicKeyHex,
      keyType,
      network: challenge.network,
      signature: input.signatureHex,
      nonce: challenge.nonce,
    })
    .onConflictDoUpdate({
      target: [walletXrplBindings.solanaWallet, walletXrplBindings.xrplAddress],
      set: {
        xrplPublicKey: input.publicKeyHex,
        keyType,
        network: challenge.network,
        signature: input.signatureHex,
        nonce: challenge.nonce,
        provedAt: new Date(),
      },
    })
    .returning({ id: walletXrplBindings.id });
  if (!binding) throw new Error("failed to record binding");

  return {
    ok: true,
    bindingId: binding.id,
    solanaWallet: challenge.solanaWallet,
    xrplAddress: challenge.xrplAddress,
    network: challenge.network,
    keyType,
  };
}

export async function hasBinding(
  solanaWallet: string,
  xrplAddress: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: walletXrplBindings.id })
    .from(walletXrplBindings)
    .where(
      and(
        eq(walletXrplBindings.solanaWallet, solanaWallet),
        eq(walletXrplBindings.xrplAddress, xrplAddress),
      ),
    )
    .limit(1);
  return !!row;
}
