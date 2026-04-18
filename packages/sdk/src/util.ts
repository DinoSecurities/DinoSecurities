/**
 * Verify that a raw byte buffer hashes to the expected SHA-256 digest.
 * Used for: confirming a downloaded legal PDF matches the doc_hash
 * recorded on-chain for a given SecuritySeries. Consumers who render
 * the Ricardian document are the primary caller.
 */
export async function verifyDocHash(
  bytes: Uint8Array | ArrayBuffer,
  expectedHex: string,
): Promise<boolean> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const actual = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return actual.toLowerCase() === expectedHex.replace(/^0x/, "").toLowerCase();
}

/**
 * Compute SHA-256 of a byte buffer and return the lowercased hex digest.
 * Useful for: hashing a legal document client-side before upload so the
 * doc_hash recorded on-chain is verifiable by anyone who later retrieves
 * the same document from Arweave.
 */
export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
