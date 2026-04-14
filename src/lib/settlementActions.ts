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
  if (!wallet.publicKey) throw new Error("wallet not connected");
  const program = programFor(connection, wallet);

  const nonce = new anchor.BN(Date.now());
  const ttl = (params.expiresInSeconds ?? 24 * 3600);
  const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + ttl);
  const [orderPda] = deriveOrderPda(wallet.publicKey, nonce);

  const ix = await program.methods
    .createSettlementOrder({
      side: params.side === "Buy" ? { buy: {} } : { sell: {} },
      tokenAmount: new anchor.BN(params.tokenAmount.toString()),
      paymentAmount: new anchor.BN(params.paymentAmount.toString()),
      expiresAt: expiry,
      nonce,
    })
    .accountsStrict({
      order: orderPda,
      securityMint: new PublicKey(params.securityMint),
      paymentMint: new PublicKey(params.paymentMint),
      creator: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const signature = await sendAndConfirm(connection, wallet, ix, "create order");
  return { signature, orderPda: orderPda.toBase58(), nonce: nonce.toString() };
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
