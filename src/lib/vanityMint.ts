import { Keypair } from "@solana/web3.js";

/**
 * Grind a new Solana keypair whose public key (base58) starts with a
 * given prefix. Case-sensitive match against the base58 alphabet
 * (no 0, O, I, l); consumers are responsible for validating the input
 * upstream.
 *
 * Difficulty scales roughly as 58^N. Two characters average ~1500
 * attempts (sub-second), three average ~200K (seconds), four average
 * ~12M (minutes). The grind runs synchronously but yields to the
 * event loop every `yieldEvery` attempts so the UI stays responsive.
 */
export interface VanityGrindOptions {
  prefix: string;
  maxAttempts?: number;
  onProgress?: (attempts: number) => void;
  yieldEvery?: number;
  signal?: AbortSignal;
}

export async function grindMintKeypair({
  prefix,
  maxAttempts = 10_000_000,
  onProgress,
  yieldEvery = 5000,
  signal,
}: VanityGrindOptions): Promise<{ keypair: Keypair; attempts: number }> {
  if (!prefix) throw new Error("prefix required");
  if (prefix.length > 6) {
    throw new Error("prefix longer than 6 characters is impractical to grind client-side");
  }
  // Base58 alphabet sanity — pubkeys never contain 0, O, I, or l.
  if (/[0OIl]/.test(prefix)) {
    throw new Error(
      "base58 pubkeys don't contain 0, O, I, or l — pick a prefix without those characters",
    );
  }

  let attempts = 0;
  while (attempts < maxAttempts) {
    const kp = Keypair.generate();
    attempts += 1;
    if (kp.publicKey.toBase58().startsWith(prefix)) {
      return { keypair: kp, attempts };
    }
    if (attempts % yieldEvery === 0) {
      if (signal?.aborted) throw new Error("grind aborted");
      onProgress?.(attempts);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  throw new Error(`exhausted ${maxAttempts} attempts without finding a match`);
}

/** Rough expected-attempts lookup for UI messaging. */
export function expectedAttempts(prefixLength: number): number {
  return Math.round(Math.pow(58, prefixLength) / 2);
}
