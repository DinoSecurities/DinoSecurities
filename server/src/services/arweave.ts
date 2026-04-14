import crypto from "node:crypto";
import fs from "node:fs";
import { env } from "../env.js";

interface UploadResult {
  uri: string;
  hash: string;
  txId?: string;
  bytes: number;
}

interface IrysTags {
  contentType: string;
  securityType?: string;
  isin?: string;
  jurisdiction?: string;
  seriesMint?: string;
}

let cachedUploader: any | null = null;

/**
 * Lazily build the Irys uploader. Importing @irys/upload is heavy and
 * fails fast in environments without the wallet, so we only do it on
 * the first real upload request.
 */
async function getUploader(): Promise<any | null> {
  if (cachedUploader) return cachedUploader;
  if (!env.IRYS_WALLET_KEY) return null;

  let secretKey: string;
  if (env.IRYS_WALLET_KEY.trim().startsWith("[")) {
    // Inline JSON byte array (passed through env)
    const bytes = Uint8Array.from(JSON.parse(env.IRYS_WALLET_KEY));
    const bs58 = (await import("bs58")).default;
    secretKey = bs58.encode(bytes);
  } else if (fs.existsSync(env.IRYS_WALLET_KEY)) {
    // Path to a Solana keypair JSON file
    const bytes = Uint8Array.from(JSON.parse(fs.readFileSync(env.IRYS_WALLET_KEY, "utf8")));
    const bs58 = (await import("bs58")).default;
    secretKey = bs58.encode(bytes);
  } else {
    // Already a base58 string
    secretKey = env.IRYS_WALLET_KEY;
  }

  try {
    const { Uploader } = (await import("@irys/upload")) as any;
    const { Solana } = (await import("@irys/upload-solana")) as any;
    const isDevnet = (env.SOLANA_RPC_URL || "").includes("devnet");
    // Build in a single chain: .devnet() targets Irys's devnet bundler
    // which accepts devnet SOL payments. Mainnet paths need real SOL.
    let builder = Uploader(Solana)
      .withWallet(secretKey)
      .withRpc(env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
    if (isDevnet) builder = builder.devnet();
    const uploader = await builder;
    cachedUploader = uploader;
    return uploader;
  } catch (err) {
    console.warn("Irys uploader init failed, falling back to dev URIs:", err);
    return null;
  }
}

/**
 * Upload a legal document to Arweave via Irys. Returns the Arweave URI,
 * SHA-256 hash, and the underlying tx id. Falls back to a deterministic
 * mock URI if no Irys wallet is configured (development mode).
 */
export async function uploadDocument(
  file: Buffer,
  tags: IrysTags,
): Promise<UploadResult> {
  const hash = crypto.createHash("sha256").update(file).digest("hex");
  const bytes = file.byteLength;

  const uploader = await getUploader();
  if (!uploader) {
    return { uri: `ar://dev-${hash.slice(0, 16)}`, hash, bytes };
  }

  const tagList = [
    { name: "Content-Type", value: tags.contentType },
    { name: "App-Name", value: "DinoSecurities" },
    { name: "App-Version", value: "0.2.0" },
    { name: "Document-Hash", value: hash },
  ];
  if (tags.securityType) tagList.push({ name: "Security-Type", value: tags.securityType });
  if (tags.isin) tagList.push({ name: "ISIN", value: tags.isin });
  if (tags.jurisdiction) tagList.push({ name: "Jurisdiction", value: tags.jurisdiction });
  if (tags.seriesMint) tagList.push({ name: "Series-Mint", value: tags.seriesMint });

  const receipt = await uploader.upload(file, { tags: tagList });
  return {
    uri: `ar://${receipt.id}`,
    txId: receipt.id,
    hash,
    bytes,
  };
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
