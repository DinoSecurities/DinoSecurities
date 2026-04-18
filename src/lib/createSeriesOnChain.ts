/**
 * End-to-end on-chain creation of a DinoSecurities security series:
 *   1. Generate a fresh Token-2022 mint keypair
 *   2. Initialize the mint with TransferHook + MetadataPointer +
 *      PermanentDelegate + DefaultAccountState(frozen) extensions
 *   3. Initialize the transfer-hook ExtraAccountMetaList PDA
 *   4. Register the issuer profile (idempotent — no-op if exists)
 *   5. Create the SecuritySeries PDA via dino_core
 *
 * Steps 1-3 go in one transaction, step 4 (if needed) in a second, and step 5
 * in a third. Splitting keeps each tx under the size + compute-unit limits
 * with all the extension instructions involved.
 *
 * For devnet testing we let the connected wallet act as both `authority`
 * (issuer) and `oracle` co-signer — this works because the platform's
 * configured oracle == the deployer wallet, which is what users currently
 * connect with. Production will move the oracle to a dedicated key.
 */
import {
  type Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import { createInitializeInstruction as createInitializeMetadataInstruction } from "@solana/spl-token-metadata";
import * as anchor from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { sha256 } from "@noble/hashes/sha2.js";
import { PROGRAM_IDS } from "./solana";
import dinoCoreIdl from "@/idl/dino_core.json";
import dinoHookIdl from "@/idl/dino_transfer_hook.json";

export type SecurityTypeUI = "Equity" | "Debt" | "Fund" | "LLC";
export type RegulationUI =
  | "RegD"
  | "RegS"
  | "RegCF"
  | "RegA+"
  | "Ricardian"
  | "None";

export interface CreateSeriesParams {
  name: string;
  symbol: string;
  securityType: SecurityTypeUI;
  jurisdiction: string;
  maxSupply: bigint | number;
  isin?: string;
  regulation: RegulationUI;
  /** Either an Arweave URI (ar://...) supplied by the issuer, or empty if doc upload deferred. */
  docUri?: string;
  /**
   * SHA-256 of the legal document bytes. If a File is supplied, the caller
   * should hash it client-side and pass the 32-byte hash here.
   */
  docHash?: Uint8Array;
}

export interface CreateSeriesResult {
  mintAddress: string;
  seriesPda: string;
  signatures: { mintInit: string; registerIssuer?: string; createSeries: string };
}

const SECURITY_TYPE_VARIANT: Record<SecurityTypeUI, any> = {
  Equity: { equity: {} },
  Debt: { debt: {} },
  Fund: { fundInterest: {} },
  LLC: { llcMembership: {} },
};

const RESTRICTION_VARIANT: Record<RegulationUI, any> = {
  None: { none: {} },
  RegD: { regD: {} },
  RegS: { regS: {} },
  RegCF: { regCf: {} },
  "RegA+": { regAPlus: {} },
  Ricardian: { ricardian: {} },
};

/**
 * Priority-fee preamble. On mainnet, a tx without a compute-unit price
 * can sit in the mempool while fee-paying txs are scheduled ahead of it
 * — long enough for the recent blockhash to expire. Every tx this file
 * constructs gets these two instructions prepended so the network has a
 * reason to include them in the current slot window.
 *
 * Override via VITE_PRIORITY_FEE_MICROLAMPORTS if the default is off
 * (e.g., devnet can drop to 1).
 */
function priorityFeeIxs(computeUnitLimit = 400_000): TransactionInstruction[] {
  const raw = import.meta.env.VITE_PRIORITY_FEE_MICROLAMPORTS;
  const microLamports = raw ? Math.max(0, parseInt(String(raw), 10) || 0) : 100_000;
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  ];
}

export async function createSecuritySeriesOnChain(
  connection: Connection,
  wallet: WalletContextState,
  params: CreateSeriesParams,
): Promise<CreateSeriesResult> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  const issuer = wallet.publicKey;

  // ---- Anchor program clients --------------------------------------------
  const provider = new anchor.AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const coreProgram = new anchor.Program(
    dinoCoreIdl as any,
    provider,
  );
  const hookProgram = new anchor.Program(
    dinoHookIdl as any,
    provider,
  );

  // ---- PDAs ---------------------------------------------------------------
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  const [platformPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_IDS.DINO_CORE,
  );
  const [issuerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), issuer.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );
  const [seriesPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("series"), mint.toBuffer()],
    PROGRAM_IDS.DINO_CORE,
  );
  const [extraMetaPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    PROGRAM_IDS.DINO_HOOK,
  );

  // ---- Tx 1: init mint with extensions + extra metas ----------------------
  // Note: we deliberately omit DefaultAccountState=Frozen. The Transfer Hook
  // already enforces every compliance check (whitelist, accreditation,
  // freeze status, jurisdiction) on every transfer. Default-freezing every
  // new ATA on top of that blocks DvP settlement (the agent can't move
  // tokens out of a frozen account) with no real security benefit — per-
  // holder freeze via HolderRecord.is_frozen is still available when the
  // issuer needs to pause a specific bad actor.
  const extensions = [
    ExtensionType.TransferHook,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];
  const mintLen = getMintLen(extensions);
  // TokenMetadata extension is variable-length and gets allocated via
  // mint.reallocate after init. Pre-fund enough rent for both the base
  // mint extensions AND the metadata bytes so the reallocate doesn't
  // need a separate rent top-up.
  const tokenName = (params.name ?? params.symbol).slice(0, 64);
  const tokenSymbol = params.symbol.slice(0, 16);
  const tokenUri = (params.docUri ?? "").slice(0, 200);
  // Rough metadata TLV size: 4-byte type + 4-byte length + (name+symbol+uri lengths + 12 bytes overhead per field) + 64-byte updateAuthority + 32-byte mint.
  const metadataLen =
    4 + 4 + 32 + 32 +
    4 + tokenName.length +
    4 + tokenSymbol.length +
    4 + tokenUri.length;
  const mintRent = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataLen,
  );

  const initMintInitExtrasIx = await hookProgram.methods
    .initializeExtraAccountMetaList()
    .accountsStrict({
      payer: issuer,
      extraAccountMetaList: extraMetaPda,
      mint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx1 = new Transaction()
    .add(...priorityFeeIxs(400_000))
    .add(
      SystemProgram.createAccount({
        fromPubkey: issuer,
        newAccountPubkey: mint,
        lamports: mintRent,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
    )
    // TransferHook extension — points at dino_transfer_hook so every transfer
    // CPIs into our compliance program.
    .add(
      createInitializeTransferHookInstruction(
        mint,
        seriesPda, // hook program authority (can update the hook)
        PROGRAM_IDS.DINO_HOOK,
        TOKEN_2022_PROGRAM_ID,
      ),
    )
    // MetadataPointer points back to the mint itself (inline metadata).
    .add(
      createInitializeMetadataPointerInstruction(
        mint,
        seriesPda, // update authority
        mint, // metadata address (self)
        TOKEN_2022_PROGRAM_ID,
      ),
    )
    // PermanentDelegate gives the seriesPda regulatory clawback authority.
    .add(
      createInitializePermanentDelegateInstruction(
        mint,
        seriesPda,
        TOKEN_2022_PROGRAM_ID,
      ),
    )
    // Initialize the mint with the issuer as temporary mint authority so
    // they can sign the metadata initialize that follows. We hand authority
    // to seriesPda after metadata is written.
    .add(
      createInitializeMintInstruction(
        mint,
        0, // decimals — securities are whole-unit
        issuer,
        issuer,
        TOKEN_2022_PROGRAM_ID,
      ),
    )
    // Write the TokenMetadata extension data (name/symbol/uri). Phantom
    // and other wallets read this so the asset shows as e.g. "DINOMT"
    // instead of "Unknown Token". Update authority is the seriesPda so
    // dino_core can update metadata via CPI later.
    .add(
      createInitializeMetadataInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority: seriesPda,
        mint,
        mintAuthority: issuer,
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
      }),
    )
    // Hand mint + freeze authority to seriesPda so dino_core can mint
    // additional supply and emergency-pause.
    .add(
      createSetAuthorityInstruction(
        mint, issuer, AuthorityType.MintTokens, seriesPda, [], TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(
      createSetAuthorityInstruction(
        mint, issuer, AuthorityType.FreezeAccount, seriesPda, [], TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(initMintInitExtrasIx);

  const sig1 = await sendAndConfirm(connection, wallet, tx1, [mintKeypair], "mint init");

  // ---- Tx 2: register issuer if needed -----------------------------------
  // The on-chain register_issuer instruction requires both the user (authority)
  // AND the KYC oracle to sign. The frontend partial-signs with the user's
  // wallet, serializes the tx, and posts to the backend which co-signs with
  // the oracle keypair before submitting.
  let sig2: string | undefined;
  const issuerAccount = await connection.getAccountInfo(issuerPda);
  if (!issuerAccount) {
    const oraclePubkeyStr = import.meta.env.VITE_KYC_ORACLE_PUBKEY;
    const registerUrl = import.meta.env.VITE_REGISTER_ISSUER_URL;
    if (!oraclePubkeyStr || !registerUrl) {
      throw new Error(
        "Issuer registration is not configured. Set VITE_KYC_ORACLE_PUBKEY and VITE_REGISTER_ISSUER_URL.",
      );
    }
    const oraclePubkey = new PublicKey(oraclePubkeyStr);

    const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const kycHashBytes = Array.from(
      sha256(new TextEncoder().encode(`issuer:${issuer.toBase58()}`)),
    );
    const registerIx = await coreProgram.methods
      .registerIssuer(
        params.name.slice(0, 100) || "Unnamed Issuer",
        params.jurisdiction.slice(0, 8) || "US",
        kycHashBytes,
        new anchor.BN(oneYear),
      )
      .accountsStrict({
        issuer: issuerPda,
        platform: platformPda,
        oracle: oraclePubkey,
        authority: issuer,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx2 = new Transaction().add(...priorityFeeIxs(200_000)).add(registerIx);
    tx2.feePayer = issuer;
    tx2.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

    if (!wallet.signTransaction) throw new Error("Wallet does not support signing");
    const signed = await wallet.signTransaction(tx2);
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
      throw new Error(`Issuer registration failed: ${res.status} ${text}`);
    }
    const result = (await res.json()) as { signature: string };
    sig2 = result.signature;
  }

  // ---- Tx 3: create the security series PDA ------------------------------
  const docHashArr = Array.from(
    params.docHash ?? sha256(new TextEncoder().encode(params.docUri ?? params.symbol)),
  );
  const createIx = await coreProgram.methods
    .createSecuritySeries({
      name: params.name.slice(0, 64),
      symbol: params.symbol.slice(0, 16),
      securityType: SECURITY_TYPE_VARIANT[params.securityType],
      docHash: docHashArr,
      docUri: (params.docUri ?? "").slice(0, 200),
      isin: (params.isin ?? "").slice(0, 12),
      maxSupply: new anchor.BN(params.maxSupply.toString()),
      transferRestriction: RESTRICTION_VARIANT[params.regulation],
    })
    .accountsStrict({
      issuer: issuerPda,
      series: seriesPda,
      mint,
      authority: issuer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  const tx3 = new Transaction().add(...priorityFeeIxs(200_000)).add(createIx);
  const sig3 = await sendAndConfirm(connection, wallet, tx3, [], "create series");

  return {
    mintAddress: mint.toBase58(),
    seriesPda: seriesPda.toBase58(),
    signatures: { mintInit: sig1, registerIssuer: sig2, createSeries: sig3 },
  };
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const transient =
        msg.includes("503") ||
        msg.includes("Service unavailable") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("429");
      if (!transient || i === attempts - 1) throw e;
      const delay = 400 * Math.pow(2, i); // 400ms, 800, 1600, 3200, 6400
      console.warn(`[${label}] transient RPC error, retrying in ${delay}ms:`, msg);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function sendAndConfirm(
  connection: Connection,
  wallet: WalletContextState,
  tx: Transaction,
  extraSigners: Keypair[],
  label: string,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("wallet missing");
  // "confirmed" commitment gives a blockhash the network actually agrees
  // on — "processed" is ahead of consensus on mainnet and shrinks the
  // usable window before the tx can even be sent.
  const { blockhash, lastValidBlockHeight } = await withRetry(
    `${label} blockhash`,
    () => connection.getLatestBlockhash("confirmed"),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  for (const s of extraSigners) tx.partialSign(s);
  const signed = await wallet.signTransaction(tx);
  const raw = signed.serialize();

  // Initial submission. After this, keep re-broadcasting the same
  // serialized bytes every 2s until either confirmation resolves or the
  // block-height window closes. A single sendRawTransaction is not
  // enough on mainnet under load — dropped sends are silent and you
  // only find out via a blockhash-expired error 60s later.
  const sig = await withRetry(`${label} send`, () =>
    connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 }),
  );

  let resendTimer: ReturnType<typeof setInterval> | undefined;
  try {
    resendTimer = setInterval(() => {
      connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {
        // Swallow resend errors; confirmTransaction is the source of truth.
      });
    }, 2000);

    const conf = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (conf.value.err) {
      throw new Error(`[${label}] tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
    }
    return sig;
  } finally {
    if (resendTimer) clearInterval(resendTimer);
  }
}

/**
 * Compute SHA-256 of a File on the client. Returns the 32-byte digest.
 */
export async function hashFile(file: File): Promise<Uint8Array> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return sha256(buf);
}
