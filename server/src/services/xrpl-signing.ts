import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";

/**
 * Low-level XRPL signature + address-derivation primitives. Intentionally
 * free of any XRPL SDK dependency — the ledger's public-key / signature
 * format is small enough that vendoring the 60-ish lines below is cleaner
 * than dragging in a 200KB dep. Every identifier names its exact purpose
 * so a reader can match the spec:
 *
 *   - ed25519 keys are prefixed 0xED, 32 raw pubkey bytes follow.
 *   - secp256k1 keys are 33 compressed bytes (0x02 / 0x03 prefix).
 *   - Signing hash is SHA-512-half: first 32 bytes of SHA-512(message).
 *   - AccountID is RIPEMD160(SHA256(pubkey)).
 *   - Classic address is base58-check of 0x00 || AccountID, using the
 *     XRPL-custom base58 alphabet.
 */

const XRPL_BASE58_ALPHABET =
  "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";

function sha256(b: Uint8Array): Buffer {
  return createHash("sha256").update(b).digest();
}
function sha512Half(b: Uint8Array): Buffer {
  return createHash("sha512").update(b).digest().subarray(0, 32);
}
function ripemd160(b: Uint8Array): Buffer {
  return createHash("ripemd160").update(b).digest();
}

function base58EncodeXrpl(bytes: Uint8Array): string {
  let n = 0n;
  for (const byte of bytes) n = (n << 8n) | BigInt(byte);
  let out = "";
  while (n > 0n) {
    const rem = Number(n % 58n);
    n = n / 58n;
    out = XRPL_BASE58_ALPHABET[rem] + out;
  }
  for (const byte of bytes) {
    if (byte === 0) out = XRPL_BASE58_ALPHABET[0] + out;
    else break;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

export type XrplKeyType = "ed25519" | "secp256k1";

export function detectKeyType(publicKeyHex: string): XrplKeyType {
  return publicKeyHex.toUpperCase().startsWith("ED") ? "ed25519" : "secp256k1";
}

/**
 * Derive an XRPL classic address from a public key.
 * Input is hex as it appears on the wire in XRPL tx (ED-prefixed for ed25519,
 * compressed secp256k1 otherwise).
 */
export function deriveClassicAddress(publicKeyHex: string): string {
  const pubkey = hexToBytes(publicKeyHex);
  const accountId = ripemd160(sha256(pubkey));
  const payload = new Uint8Array(1 + accountId.length);
  payload[0] = 0x00;
  payload.set(accountId, 1);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  const full = new Uint8Array(payload.length + checksum.length);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return base58EncodeXrpl(full);
}

/**
 * Verify an XRPL signature over a raw message. Dispatches on key type
 * and applies SHA-512-half per XRPL's signing-hash convention.
 *
 * Arguments are all hex strings as they appear on the XRPL wire.
 */
export function verifyXrplSignature(
  messageUtf8: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  const keyType = detectKeyType(publicKeyHex);
  const sig = hexToBytes(signatureHex);
  const message = new TextEncoder().encode(messageUtf8);
  const hash = sha512Half(message);

  try {
    if (keyType === "ed25519") {
      // ED-prefixed keys — strip the 0xED marker before feeding to the curve.
      const pubkey = hexToBytes(publicKeyHex).subarray(1);
      return ed25519.verify(sig, hash, pubkey);
    }
    // secp256k1 signatures on XRPL are DER-encoded.
    const pubkey = hexToBytes(publicKeyHex);
    return secp256k1.verify(sig, hash, pubkey);
  } catch {
    return false;
  }
}
