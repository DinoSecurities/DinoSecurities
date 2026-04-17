import { useQuery } from "@tanstack/react-query";

/**
 * Verifies the governing-document for a Ricardian-linked security mint.
 *
 * The on-chain SecuritySeries PDA stores `doc_hash: [u8; 32]` — a SHA-256
 * commitment to the canonical legal document uploaded to Arweave at mint
 * creation. This hook fetches the actual bytes from Arweave, hashes them
 * in the browser via SubtleCrypto, and compares the hex digest to the
 * on-chain value.
 *
 * Nothing about this verification relies on our server. A visitor could
 * paste the same URI + expected hash into DevTools and reproduce the
 * result — that's the whole point. If Arweave ever served different
 * bytes than what the issuer committed to, the badge would flip to
 * mismatch and anyone watching would know.
 */

export type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "matches"; actualHex: string; bytes: number }
  | { status: "mismatch"; actualHex: string; expectedHex: string; bytes: number }
  | { status: "unverifiable"; reason: string };

function normalizeArweaveUri(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("ar://")) {
    return `https://arweave.net/${trimmed.slice(5)}`;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  // Bare tx id (43-char base64url) → assume Arweave.
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) {
    return `https://arweave.net/${trimmed}`;
  }
  return null;
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verify(docUri: string, expectedHex: string): Promise<VerificationState> {
  const url = normalizeArweaveUri(docUri);
  if (!url) {
    return { status: "unverifiable", reason: "Document URI is empty or malformed" };
  }
  if (!expectedHex || expectedHex.length !== 64) {
    return { status: "unverifiable", reason: "On-chain hash is missing or not 32 bytes" };
  }

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      return { status: "unverifiable", reason: `Arweave returned ${res.status} ${res.statusText}` };
    }
    const buf = await res.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const actualHex = bytesToHex(hash);
    if (actualHex.toLowerCase() === expectedHex.toLowerCase()) {
      return { status: "matches", actualHex, bytes: buf.byteLength };
    }
    return { status: "mismatch", actualHex, expectedHex, bytes: buf.byteLength };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network or CORS error";
    return { status: "unverifiable", reason };
  }
}

export function useDocVerification(docUri: string | null | undefined, expectedHex: string | null | undefined) {
  return useQuery({
    queryKey: ["doc-verification", docUri ?? "", expectedHex ?? ""],
    queryFn: () => verify(docUri ?? "", expectedHex ?? ""),
    // A governing document shouldn't change. Cache per (uri, hash) for the
    // entire session — the hash would change too if the bytes were swapped.
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    enabled: Boolean(docUri && expectedHex && expectedHex.length === 64),
  });
}
