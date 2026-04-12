import nacl from "tweetnacl";
import bs58 from "bs58";

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes replay window

/**
 * Verify a Solana wallet signature for API authentication.
 *
 * The frontend signs: "DinoSecurities Auth: <timestamp>"
 * The server verifies the signature matches the claimed wallet address.
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  timestamp: string,
): boolean {
  try {
    // Check timestamp freshness
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Date.now() - ts > MAX_AGE_MS) {
      return false;
    }

    const message = new TextEncoder().encode(`DinoSecurities Auth: ${timestamp}`);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);

    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
