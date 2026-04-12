import { env } from "../env.js";

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string }>;
  properties: {
    files: Array<{ uri: string; type: string }>;
    legal: {
      doc_hash: string;
      doc_uri: string;
      governing_law: string;
      ricardian_version: string;
    };
  };
}

/**
 * Upload token metadata JSON to IPFS via Pinata
 */
export async function uploadMetadata(metadata: TokenMetadata): Promise<string> {
  if (!env.PINATA_API_KEY || !env.PINATA_SECRET_KEY) {
    console.warn("Pinata keys not set, returning mock IPFS URI");
    return `ipfs://dev-${Date.now()}`;
  }

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: env.PINATA_API_KEY,
      pinata_secret_api_key: env.PINATA_SECRET_KEY,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: `${metadata.symbol}-metadata.json`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.status}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return `ipfs://${result.IpfsHash}`;
}

/**
 * Pin a file (image, etc.) to IPFS via Pinata
 */
export async function pinFile(
  file: Buffer,
  filename: string,
): Promise<string> {
  if (!env.PINATA_API_KEY || !env.PINATA_SECRET_KEY) {
    console.warn("Pinata keys not set, returning mock IPFS URI");
    return `ipfs://dev-file-${Date.now()}`;
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(file)]), filename);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: filename }),
  );

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: env.PINATA_API_KEY,
      pinata_secret_api_key: env.PINATA_SECRET_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pinata file upload failed: ${response.status}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return `ipfs://${result.IpfsHash}`;
}
