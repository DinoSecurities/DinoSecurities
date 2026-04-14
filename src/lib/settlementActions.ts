/**
 * Client-side wrappers for the settlement instructions in dino_core.
 *   - createOrder(): publishes a buy/sell intent as a SettlementOrder PDA
 *   - cancelOrder(): closes one of the caller's own open orders
 *
 * Atomic DvP execution itself runs server-side (settlement-agent service)
 * once a matching counterparty exists; the user only ever signs the order
 * creation / cancellation legs.
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { PROGRAM_IDS } from "./solana";
import dinoCoreIdl from "@/idl/dino_core.json";

export type OrderSideUI = "Buy" | "Sell";

export interface CreateOrderParams {
  securityMint: string;
  paymentMint: string; // typically USDC
  side: OrderSideUI;
  tokenAmount: bigint | number;
  paymentAmount: bigint | number;
  expiresInSeconds?: number; // default 24h
  /**
   * The settlement agent pubkey. On order creation we approve this address
   * as a Token-2022 delegate for the amount the agent will need to move —
   * USDC for Buy orders, security tokens for Sell orders. Without the
   * approval the settlement agent can't execute the DvP.
   *
   * Defaults to the platform's configured settlement_agent; pass explicitly
   * if you need to override (e.g. running a private matching engine).
   */
  settlementAgent?: string;
}

function programFor(connection: Connection, wallet: WalletContextState): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new anchor.Program(dinoCoreIdl as any, provider);
}

async function sendAndConfirm(
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

function deriveOrderPda(creator: PublicKey, nonce: anchor.BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("order"), creator.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
    PROGRAM_IDS.DINO_CORE,
  );
}

export async function createSettlementOrderOnChain(
  connection: Connection,
  wallet: WalletContextState,
  params: CreateOrderParams,
): Promise<{ signature: string; orderPda: string; nonce: string }> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("wallet not connected");
  const program = programFor(connection, wallet);

  const nonce = new anchor.BN(Date.now());
  const ttl = (params.expiresInSeconds ?? 24 * 3600);
  const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + ttl);
  const [orderPda] = deriveOrderPda(wallet.publicKey, nonce);

  const securityMint = new PublicKey(params.securityMint);
  const paymentMint = new PublicKey(params.paymentMint);

  // Resolve the token program + decimals for the mint we need to approve.
  // Buy → approve USDC (classic Token program on most deployments).
  // Sell → approve the security (Token-2022 program).
  const approveMint = params.side === "Buy" ? paymentMint : securityMint;
  const approveAmount = params.side === "Buy" ? params.paymentAmount : params.tokenAmount;
  const approveProgram = await pickTokenProgram(connection, approveMint);
  const mintInfo = await getMint(connection, approveMint, undefined, approveProgram);

  // The platform's configured settlement_agent is the delegate we need to
  // approve. Caller overrides via params.settlementAgent if needed.
  const agent = new PublicKey(
    params.settlementAgent ?? "D9byTNj21tmLoHX6SXiY2kjKXPjjGZwTejx1ccpBPpj4",
  );

  const ownerAta = getAssociatedTokenAddressSync(
    approveMint,
    wallet.publicKey,
    false,
    approveProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const approveIx = createApproveCheckedInstruction(
    ownerAta,
    approveMint,
    agent,
    wallet.publicKey,
    BigInt(approveAmount.toString()),
    mintInfo.decimals,
    [],
    approveProgram,
  );

  const createIx = await program.methods
    .createSettlementOrder({
      side: params.side === "Buy" ? { buy: {} } : { sell: {} },
      tokenAmount: new anchor.BN(params.tokenAmount.toString()),
      paymentAmount: new anchor.BN(params.paymentAmount.toString()),
      expiresAt: expiry,
      nonce,
    })
    .accountsStrict({
      order: orderPda,
      securityMint,
      paymentMint,
      creator: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Bundle approve + create into a single tx so the user only signs once
  // and we can't end up with a "created but not approved" orphan.
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");
  const tx = new Transaction().add(approveIx).add(createIx);
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
    throw new Error(`[create order] tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
  }

  return { signature: sig, orderPda: orderPda.toBase58(), nonce: nonce.toString() };
}

// Mints can live under either the legacy Token program or Token-2022. Read
// the account's owner to dispatch correctly.
async function pickTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error(`mint ${mint.toBase58()} not found`);
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  if (info.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
  throw new Error(`mint ${mint.toBase58()} is not owned by Token or Token-2022`);
}

export async function cancelSettlementOrderOnChain(
  connection: Connection,
  wallet: WalletContextState,
  orderPda: string,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const program = programFor(connection, wallet);

  const ix = await program.methods
    .cancelSettlementOrder()
    .accountsStrict({
      order: new PublicKey(orderPda),
      creator: wallet.publicKey,
    })
    .instruction();

  return sendAndConfirm(connection, wallet, ix, "cancel order");
}
