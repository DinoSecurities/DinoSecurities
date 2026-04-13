/**
 * POST a legal document to the backend, which uploads to Arweave via Irys
 * and returns the permanent ar:// URI plus the SHA-256 hash. The hash is
 * computed both client-side (so the wizard can show it before deploy) and
 * server-side (returned in the response, used to verify integrity).
 */
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/trpc").replace(/\/trpc\/?$/, "");

export interface UploadDocumentResult {
  uri: string;
  hash: string;
  txId?: string;
  bytes: number;
}

export interface UploadDocumentInput {
  file: File;
  securityType?: string;
  isin?: string;
  jurisdiction?: string;
}

export async function uploadLegalDocument(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const fd = new FormData();
  fd.append("file", input.file);
  if (input.securityType) fd.append("securityType", input.securityType);
  if (input.isin) fd.append("isin", input.isin);
  if (input.jurisdiction) fd.append("jurisdiction", input.jurisdiction);

  const res = await fetch(`${API_BASE}/upload-document`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload failed: ${res.status} ${text}`);
  }
  return res.json();
}
