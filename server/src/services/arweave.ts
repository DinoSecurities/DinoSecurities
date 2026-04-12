import crypto from "node:crypto";
import { env } from "../env.js";

interface UploadResult {
  uri: string;
  hash: string;
}

interface IrysTags {
  contentType: string;
  securityType?: string;
  isin?: string;
  jurisdiction?: string;
  seriesMint?: string;
}

/**
 * Upload a legal document to Arweave via Irys (Bundlr).
 * Returns the Arweave URI and SHA-256 hash.
 */
export async function uploadDocument(
  file: Buffer,
  tags: IrysTags,
): Promise<UploadResult> {
  const hash = crypto.createHash("sha256").update(file).digest("hex");

  if (!env.IRYS_WALLET_KEY) {
    // Dev mode — return mock URI
    console.warn("IRYS_WALLET_KEY not set, returning mock Arweave URI");
    return {
      uri: `ar://dev-${hash.slice(0, 16)}`,
      hash,
    };
  }

  // TODO: Initialize Irys client and upload
  // const irys = new Irys({ url: "https://node1.irys.xyz", token: "solana", key: env.IRYS_WALLET_KEY });
  // await irys.ready();
  // const receipt = await irys.upload(file, {
  //   tags: [
  //     { name: "Content-Type", value: tags.contentType },
  //     { name: "App-Name", value: "DinoSecurities" },
  //     { name: "Document-Hash", value: hash },
  //     ...(tags.securityType ? [{ name: "Security-Type", value: tags.securityType }] : []),
  //     ...(tags.isin ? [{ name: "ISIN", value: tags.isin }] : []),
  //     ...(tags.jurisdiction ? [{ name: "Jurisdiction", value: tags.jurisdiction }] : []),
  //     ...(tags.seriesMint ? [{ name: "Series-Mint", value: tags.seriesMint }] : []),
  //   ],
  // });
  // return { uri: `https://arweave.net/${receipt.id}`, hash };

  return { uri: `ar://dev-${hash.slice(0, 16)}`, hash };
}

/**
 * Fetch a document from Arweave and return as Buffer
 */
export async function fetchDocument(uri: string): Promise<Buffer> {
  const url = uri.startsWith("ar://")
    ? `https://arweave.net/${uri.slice(5)}`
    : uri;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Verify a document's SHA-256 hash matches the expected value
 */
export async function verifyDocumentHash(
  uri: string,
  expectedHash: string,
): Promise<boolean> {
  const data = await fetchDocument(uri);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return hash === expectedHash;
}
