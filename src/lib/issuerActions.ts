/**
 * Issuer-side on-chain operations: register a holder, mint tokens to a
 * registered holder, and pause/unpause a security series. All three call
 * dino_core; the connected wallet acts as the issuer authority. For
 * register_holder the wallet additionally co-signs as the platform's
 * configured KYC oracle (the deployer wallet on devnet — see the comment
 * in createSeriesOnChain.ts). Pre-mainnet we'll move the oracle to a
 * dedicated key and split this signature.
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { PROGRAM_IDS } from "./solana";
import dinoCoreIdl from "@/idl/dino_core.json";

function programFor(connection: Connection, wallet: WalletContextState): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new anchor.Program(dinoCoreIdl as any, provider);
}

async function sendInstruction(
  connection: Connection,
  wallet: WalletContextState,
  ix: anchor.web3.TransactionInstruction,
  label: string,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("wallet missing");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  const conf = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (conf.value.err) {
    throw new Error(`[${label}] tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
  }
  return sig;
}

export interface RegisterHolderParams {
  mint: string; // base58 mint pubkey
  holderWallet: string; // base58 of investor wallet to whitelist
  isAccredited: boolean;
  jurisdiction?: string; // 2-letter ISO country code
  ttlDays?: number; // KYC validity, default 365
}

export async function registerHolder(
  connection: Connection,
  wallet: WalletContextState,
  params: RegisterHolderParams,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("wallet not connected");

  const oraclePubkeyStr = import.meta.env.VITE_KYC_ORACLE_PUBKEY;
  const registerUrl = import.meta.env.VITE_REGISTER_HOLDER_URL;
  if (!oraclePubkeyStr || !registerUrl) {
    throw new Error(
      "Holder registration is not configured. Set VITE_KYC_ORACLE_PUBKEY and VITE_REGISTER_HOLDER_URL.",
    );
  }
  const oraclePubkey = new PublicKey(oraclePubkeyStr);

  const program = programFor(connection, wallet);
  const mint = new PublicKey(params.mint);
  const holder = new PublicKey(params.holderWallet);

  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_IDS.DINO_CORE,
  );
  const [holderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("holder"), mint.toBuffer(), holder.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );

  const ttl = (params.ttlDays ?? 365) * 24 * 3600;
  const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + ttl);
  const kycHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`holder:${holder.toBase58()}:${mint.toBase58()}`),
      ),
    ),
  );
  const jurisdictionBytes: number[] = (() => {
    const j = (params.jurisdiction ?? "US").padEnd(2, " ").slice(0, 2);
    return [j.charCodeAt(0), j.charCodeAt(1)];
  })();

  // The on-chain register_holder requires the KYC oracle to sign. We build
  // the tx with the oracle as `signer` (account constraint), partial-sign
  // with the user's wallet (fee payer), and post to the backend which
  // co-signs with the oracle keypair before submitting.
  const ix = await program.methods
    .registerHolder(holder, kycHash, expiry, params.isAccredited, jurisdictionBytes)
    .accountsStrict({
      platform: platformPda,
      holder: holderPda,
      mint,
      signer: oraclePubkey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  const signed = await wallet.signTransaction(tx);
  const serialized = signed
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");

  const res = await fetch(registerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTxBase64: serialized }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Holder registration failed: ${res.status} ${text}`);
  }
  const result = (await res.json()) as { signature: string };
  return result.signature;
}

export interface MintTokensParams {
  mint: string;
  recipient: string;
  amount: bigint | number;
}

export async function mintTokens(
  connection: Connection,
  wallet: WalletContextState,
  params: MintTokensParams,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const program = programFor(connection, wallet);
  const mint = new PublicKey(params.mint);
  const recipient = new PublicKey(params.recipient);

  const [issuerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), mint.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );
  const recipientAta = getAssociatedTokenAddressSync(
    mint,
    recipient,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const ix = await program.methods
    .mintSecurities(new anchor.BN(params.amount.toString()))
    .accountsStrict({
      series: seriesPda,
      issuer: issuerPda,
      mint,
      recipient,
      recipientTokenAccount: recipientAta,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return sendInstruction(connection, wallet, ix, "mint securities");
}

export interface SetPauseParams {
  mint: string;
  paused: boolean;
}

export async function setSeriesPause(
  connection: Connection,
  wallet: WalletContextState,
  params: SetPauseParams,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const program = programFor(connection, wallet);
  const mint = new PublicKey(params.mint);

  const [issuerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), mint.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );

  const ix = await program.methods
    .emergencyPause(params.paused)
    .accountsStrict({
      issuer: issuerPda,
      series: seriesPda,
      authority: wallet.publicKey,
    })
    .instruction();

  return sendInstruction(connection, wallet, ix, params.paused ? "pause series" : "unpause series");
}
