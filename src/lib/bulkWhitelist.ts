import * as anchor from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { PROGRAM_IDS } from "./solana";
import dinoCoreIdl from "@/idl/dino_core.json";

/**
 * Bulk whitelist import client helpers.
 *
 * Parses the issuer-uploaded CSV, validates each row, builds a
 * register_holder instruction per row, wraps each in its own
 * transaction, collects them for a single Phantom signAllTransactions
 * call, and POSTs the signed batch to the backend /admin/bulk-whitelist
 * /submit endpoint which loops the same oracle-cosign path
 * /register-holder uses — so sanctions screening runs per row.
 *
 * Design choice: one holder per transaction, not bundled three per tx.
 * signAllTransactions handles "N Phantom confirmations in one popup"
 * cleanly, and one-ix-per-tx keeps the retry / error surface simple —
 * each row's outcome is a single tx signature or a single error.
 */

export interface BulkRow {
  wallet: string;
  jurisdiction: string;
  accredited: boolean;
  ttlDays: number;
  notes?: string;
  /** Original CSV row index, for error reporting back to the UI. */
  rowIndex: number;
}

export interface BulkRowError {
  rowIndex: number;
  raw: Record<string, unknown>;
  error: string;
}

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validate one parsed CSV row. Returns either a typed BulkRow or an
 * error record the UI can display verbatim.
 */
export function validateRow(
  raw: Record<string, unknown>,
  rowIndex: number,
): BulkRow | BulkRowError {
  const walletRaw = String(raw.wallet ?? raw.Wallet ?? "").trim();
  if (!PUBKEY_RE.test(walletRaw)) {
    return { rowIndex, raw, error: "wallet is not a valid base58 pubkey" };
  }
  const jur = String(raw.jurisdiction ?? raw.Jurisdiction ?? "US").trim().toUpperCase();
  if (jur.length < 2 || jur.length > 2) {
    return { rowIndex, raw, error: "jurisdiction must be a 2-letter ISO code (e.g. US, DE, SG)" };
  }
  const accRaw = String(raw.accredited ?? raw.Accredited ?? "").trim().toLowerCase();
  const accredited = accRaw === "true" || accRaw === "1" || accRaw === "yes" || accRaw === "y";
  const ttl = Number(raw.ttl_days ?? raw.ttlDays ?? raw.TTL ?? 365);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 365 * 10) {
    return { rowIndex, raw, error: "ttl_days must be a positive number ≤ 3650" };
  }
  return {
    wallet: walletRaw,
    jurisdiction: jur,
    accredited,
    ttlDays: ttl,
    notes: raw.notes ? String(raw.notes) : undefined,
    rowIndex,
  };
}

/**
 * Build one register_holder transaction per row. Returns the array of
 * unsigned Transactions ready for wallet.signAllTransactions, plus a
 * parallel array of rowIndex → tx-index mapping so the UI can correlate.
 */
export async function buildBulkTransactions(
  connection: Connection,
  wallet: WalletContextState,
  mint: string,
  rows: BulkRow[],
  oraclePubkeyStr: string,
): Promise<Transaction[]> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const program = new anchor.Program(
    dinoCoreIdl as unknown as anchor.Idl,
    new anchor.AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction!,
        signAllTransactions: wallet.signAllTransactions!,
      } as unknown as anchor.Wallet,
      { commitment: "confirmed" },
    ),
  );

  const mintPk = new PublicKey(mint);
  const oracle = new PublicKey(oraclePubkeyStr);
  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_IDS.DINO_CORE,
  );

  // Single blockhash shared across all txs — keeps signing fast. If any
  // tx lands slowly, we'll get Retry/BlockhashNotFound on that one row
  // only, which the UI surfaces with a "retry this row" button.
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const txs: Transaction[] = [];
  for (const row of rows) {
    const holder = new PublicKey(row.wallet);
    const [holderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("holder"), mintPk.toBuffer(), holder.toBuffer()],
      PROGRAM_IDS.DINO_CORE,
    );

    const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + row.ttlDays * 24 * 3600);
    const kycHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`holder:${holder.toBase58()}:${mintPk.toBase58()}`),
        ),
      ),
    );
    const jurisdictionBytes: number[] = [
      row.jurisdiction.charCodeAt(0),
      row.jurisdiction.charCodeAt(1),
    ];

    const ix = await program.methods
      .registerHolder(holder, kycHash, expiry, row.accredited, jurisdictionBytes)
      .accountsStrict({
        platform: platformPda,
        holder: holderPda,
        mint: mintPk,
        signer: oracle,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
      .add(ix);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = blockhash;
    txs.push(tx);
  }

  return txs;
}

export interface BulkResult {
  rowIndex: number;
  success: boolean;
  signature?: string;
  error?: string;
  code?: string;
}

/**
 * Submit signed transactions in chunks to keep per-request backend work
 * bounded. Yields per-chunk progress to the caller via onProgress.
 */
export async function submitBulkTransactions(
  signed: Transaction[],
  rowIndices: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult[]> {
  const CHUNK = 20;
  const results: BulkResult[] = [];
  const total = signed.length;
  let done = 0;
  for (let i = 0; i < signed.length; i += CHUNK) {
    const slice = signed.slice(i, i + CHUNK);
    const rowSlice = rowIndices.slice(i, i + CHUNK);
    const body = {
      txs: slice.map((tx, k) => ({
        signedTxBase64: tx
          .serialize({ requireAllSignatures: false, verifySignatures: false })
          .toString("base64"),
        rowIndex: rowSlice[k],
      })),
    };
    const res = await fetch(
      `${import.meta.env.VITE_API_URL?.replace("/trpc", "") ?? ""}/admin/bulk-whitelist/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      for (const ri of rowSlice) {
        results.push({
          rowIndex: ri,
          success: false,
          error: `batch failed: ${res.status} ${text.slice(0, 160)}`,
        });
      }
    } else {
      const { results: chunkResults } = (await res.json()) as { results: BulkResult[] };
      results.push(...chunkResults);
    }
    done += slice.length;
    onProgress?.(done, total);
  }
  return results;
}

/** CSV template bytes — single-row example so issuers can save-as and fill in. */
export const CSV_TEMPLATE = [
  "wallet,jurisdiction,accredited,ttl_days,notes",
  "4e4Xf6ZtLuPqV8z5Ewp7e6GUCqbgUq3YVwigGPJYNyTM,US,true,365,example row — replace with real investors",
].join("\n");
