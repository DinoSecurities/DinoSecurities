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
  type PublicKey,
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
} from "@solana/spl-token";
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
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

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
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
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
    // Initialize the mint itself. Mint authority + freeze authority both
    // delegate to the seriesPda so dino_core can mint and emergency-pause.
    .add(
      createInitializeMintInstruction(
        mint,
        0, // decimals — securities are whole-unit
        seriesPda,
        seriesPda,
        TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(initMintInitExtrasIx);

  const sig1 = await sendAndConfirm(connection, wallet, tx1, [mintKeypair], "mint init");

  // ---- Tx 2: register issuer if needed -----------------------------------
  let sig2: string | undefined;
  const issuerAccount = await connection.getAccountInfo(issuerPda);
  if (!issuerAccount) {
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
        oracle: issuer, // user is also acting as oracle (deployer wallet)
        authority: issuer,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx2 = new Transaction().add(registerIx);
    sig2 = await sendAndConfirm(connection, wallet, tx2, [], "register issuer");
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
  const tx3 = new Transaction().add(createIx);
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
  // Fresh blockhash via "processed" bypasses the preflight cache's
  // "already processed" false-positives on retried flows.
  const { blockhash, lastValidBlockHeight } = await withRetry(
    `${label} blockhash`,
    () => connection.getLatestBlockhash("processed"),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  for (const s of extraSigners) tx.partialSign(s);
  const signed = await wallet.signTransaction(tx);
  const sig = await withRetry(`${label} send`, () =>
    connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    }),
  );
  const conf = await withRetry(`${label} confirm`, () =>
    connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    ),
  );
  if (conf.value.err) {
    throw new Error(`[${label}] tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
  }
  return sig;
}

/**
 * Compute SHA-256 of a File on the client. Returns the 32-byte digest.
 */
export async function hashFile(file: File): Promise<Uint8Array> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return sha256(buf);
}
