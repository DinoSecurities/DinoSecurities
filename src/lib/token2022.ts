import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  ExtensionType,
  AccountState,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createFreezeAccountInstruction,
  createThawAccountInstruction,
  createApproveInstruction,
} from "@solana/spl-token";
import { PROGRAM_IDS } from "./solana";

/**
 * Build instructions to create a Token-2022 mint with DinoSecurities extensions:
 * - Transfer Hook (calls dino_transfer_hook on every transfer)
 * - Default Account State (Frozen — must be explicitly whitelisted)
 * - Metadata Pointer (stores doc_hash, ISIN, etc.)
 * - Permanent Delegate (for regulatory clawback)
 */
export function buildCreateSecurityMintInstructions(params: {
  payer: PublicKey;
  mintAuthority: PublicKey;
  freezeAuthority: PublicKey;
  permanentDelegate: PublicKey;
  transferHookProgramId: PublicKey;
  decimals: number;
}): { instructions: TransactionInstruction[]; mintKeypair: Keypair } {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  const extensions = [
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];

  const mintLen = getMintLen(extensions);

  const instructions: TransactionInstruction[] = [];

  // 1. Create account for the mint
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: params.payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: 0, // Will be calculated at send time
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  );

  // 2. Initialize extensions BEFORE initializing the mint
  instructions.push(
    createInitializeTransferHookInstruction(
      mint,
      params.mintAuthority,
      params.transferHookProgramId,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  instructions.push(
    createInitializeDefaultAccountStateInstruction(
      mint,
      AccountState.Frozen,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  instructions.push(
    createInitializeMetadataPointerInstruction(
      mint,
      params.mintAuthority,
      mint, // Metadata stored in the mint itself
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  instructions.push(
    createInitializePermanentDelegateInstruction(
      mint,
      params.permanentDelegate,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  // 3. Initialize the mint
  instructions.push(
    createInitializeMintInstruction(
      mint,
      params.decimals,
      params.mintAuthority,
      params.freezeAuthority,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  return { instructions, mintKeypair };
}

/**
 * Get or create an Associated Token Account for Token-2022
 */
export function buildGetOrCreateATAInstruction(params: {
  payer: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
}): { ata: PublicKey; instruction: TransactionInstruction | null } {
  const ata = getAssociatedTokenAddressSync(
    params.mint,
    params.owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const instruction = createAssociatedTokenAccountInstruction(
    params.payer,
    ata,
    params.owner,
    params.mint,
    TOKEN_2022_PROGRAM_ID,
  );

  return { ata, instruction };
}

/**
 * Build a mint-to instruction for Token-2022
 */
export function buildMintToInstruction(params: {
  mint: PublicKey;
  destination: PublicKey;
  authority: PublicKey;
  amount: number;
}): TransactionInstruction {
  return createMintToInstruction(
    params.mint,
    params.destination,
    params.authority,
    params.amount,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
}

/**
 * Build a freeze account instruction (Token-2022)
 */
export function buildFreezeInstruction(params: {
  account: PublicKey;
  mint: PublicKey;
  authority: PublicKey;
}): TransactionInstruction {
  return createFreezeAccountInstruction(
    params.account,
    params.mint,
    params.authority,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
}

/**
 * Build a thaw (unfreeze) account instruction (Token-2022)
 */
export function buildThawInstruction(params: {
  account: PublicKey;
  mint: PublicKey;
  authority: PublicKey;
}): TransactionInstruction {
  return createThawAccountInstruction(
    params.account,
    params.mint,
    params.authority,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
}

/**
 * Build an approve (delegate) instruction for settlement agent
 */
export function buildApproveInstruction(params: {
  account: PublicKey;
  delegate: PublicKey;
  owner: PublicKey;
  amount: number;
}): TransactionInstruction {
  return createApproveInstruction(
    params.account,
    params.delegate,
    params.owner,
    params.amount,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
}

/**
 * Calculate rent-exempt minimum for a Token-2022 mint with extensions
 */
export async function getSecurityMintRent(connection: Connection): Promise<number> {
  const extensions = [
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];
  const mintLen = getMintLen(extensions);
  return await connection.getMinimumBalanceForRentExemption(mintLen);
}
