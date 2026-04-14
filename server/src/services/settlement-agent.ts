/**
 * Settlement agent service.
 *
 * Polls open SettlementOrder PDAs on chain, finds compatible buy/sell
 * pairs, and submits atomic DvP via dino_core.execute_settlement. The
 * agent keypair signs the outer tx; inside dino_core the PDA + agent
 * delegate authorisations move the tokens.
 *
 * No order-creation or order-cancellation happens here — those are
 * user-driven. This service is purely the matching + execution leg.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  AccountMeta,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import fs from "node:fs";
import { createRequire } from "node:module";
import { env } from "../env.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;

const accountsCoder = new BorshAccountsCoder(dinoCoreIdl);
const ORDER_DISCRIMINATOR: Buffer = (() => {
  const acct = (dinoCoreIdl as any).accounts?.find((a: any) => a.name === "SettlementOrder");
  return Buffer.from(acct?.discriminator ?? []);
})();

const RPC_URL = env.SOLANA_RPC_FALLBACK || env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(env.DINO_CORE_PROGRAM_ID);
const hookProgramId = new PublicKey(env.DINO_HOOK_PROGRAM_ID);

let cachedAgent: Keypair | null = null;

function loadAgent(): Keypair | null {
  if (cachedAgent) return cachedAgent;
  if (!env.SETTLEMENT_AGENT_KEY) return null;
  try {
    const raw = env.SETTLEMENT_AGENT_KEY.trim();
    const bytes: Uint8Array = raw.startsWith("[")
      ? Uint8Array.from(JSON.parse(raw))
      : fs.existsSync(raw)
        ? Uint8Array.from(JSON.parse(fs.readFileSync(raw, "utf8")))
        : bs58.decode(raw);
    cachedAgent = Keypair.fromSecretKey(bytes);
    return cachedAgent;
  } catch (err) {
    console.warn("[settlement-agent] failed to load keypair:", err);
    return null;
  }
}

function programFor(agent: Keypair): anchor.Program {
  const wallet: any = {
    publicKey: agent.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(agent); return tx; },
    signAllTransactions: async (txs: any[]) => { txs.forEach((t) => t.partialSign(agent)); return txs; },
  };
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new anchor.Program(dinoCoreIdl as any, provider);
}

interface OpenOrder {
  pda: PublicKey;
  creator: PublicKey;
  side: "Buy" | "Sell";
  securityMint: PublicKey;
  paymentMint: PublicKey;
  tokenAmount: bigint;
  paymentAmount: bigint;
  expiresAt: number;
  nonce: anchor.BN;
}

async function fetchOpenOrders(): Promise<OpenOrder[]> {
  if (ORDER_DISCRIMINATOR.length !== 8) return [];
  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(ORDER_DISCRIMINATOR) } }],
  });
  const now = Math.floor(Date.now() / 1000);
  const out: OpenOrder[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      const d: any = accountsCoder.decode("SettlementOrder", account.data);
      const statusKey = Object.keys(d.status ?? {})[0] ?? "open";
      if (statusKey !== "open") continue;
      const expiresAt = Number(d.expires_at ?? d.expiresAt ?? 0);
      if (expiresAt <= now) continue;
      out.push({
        pda: pubkey,
        creator: d.creator,
        side: Object.keys(d.side)[0] === "sell" ? "Sell" : "Buy",
        securityMint: d.security_mint ?? d.securityMint,
        paymentMint: d.payment_mint ?? d.paymentMint,
        tokenAmount: BigInt(d.token_amount?.toString() ?? d.tokenAmount?.toString() ?? "0"),
        paymentAmount: BigInt(d.payment_amount?.toString() ?? d.paymentAmount?.toString() ?? "0"),
        expiresAt,
        nonce: new anchor.BN(d.nonce.toString()),
      });
    } catch {
      // skip un-decodeable accounts
    }
  }
  return out;
}

/**
 * Simple exact-match: buy and sell must agree on security mint, payment
 * mint, token amount, and payment amount. The agent is neutral — takes no
 * fee and doesn't cross the spread. Pricing discovery is the users'
 * responsibility. Anything fancier (partial fills, spread-matching, fees)
 * belongs in a dedicated matching engine.
 */
function findMatches(orders: OpenOrder[]): Array<{ buy: OpenOrder; sell: OpenOrder }> {
  const buys = orders.filter((o) => o.side === "Buy");
  const sells = orders.filter((o) => o.side === "Sell");
  const matches: Array<{ buy: OpenOrder; sell: OpenOrder }> = [];
  const usedSells = new Set<string>();
  for (const buy of buys) {
    const sell = sells.find(
      (s) =>
        !usedSells.has(s.pda.toBase58()) &&
        s.securityMint.equals(buy.securityMint) &&
        s.paymentMint.equals(buy.paymentMint) &&
        s.tokenAmount === buy.tokenAmount &&
        s.paymentAmount === buy.paymentAmount &&
        !s.creator.equals(buy.creator),
    );
    if (sell) {
      matches.push({ buy, sell });
      usedSells.add(sell.pda.toBase58());
    }
  }
  return matches;
}

async function pickTokenProgram(mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error(`mint ${mint.toBase58()} not found`);
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

async function executeMatch(
  agent: Keypair,
  program: anchor.Program,
  match: { buy: OpenOrder; sell: OpenOrder },
): Promise<string> {
  const { buy, sell } = match;
  const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from("platform")], programId);
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), buy.securityMint.toBuffer()],
    programId,
  );

  // ATAs. Security mint always lives under Token-2022; payment mint may be
  // under either program (devnet USDC is classic Token).
  const securityProgram = await pickTokenProgram(buy.securityMint);
  const paymentProgram = await pickTokenProgram(buy.paymentMint);

  const buyerPaymentAta = getAssociatedTokenAddressSync(
    buy.paymentMint, buy.creator, false, paymentProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const sellerPaymentAta = getAssociatedTokenAddressSync(
    buy.paymentMint, sell.creator, false, paymentProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const buyerSecurityAta = getAssociatedTokenAddressSync(
    buy.securityMint, buy.creator, false, securityProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const sellerSecurityAta = getAssociatedTokenAddressSync(
    buy.securityMint, sell.creator, false, securityProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Transfer-hook extras. Token-2022 needs these in the outer tx so the
  // CPI into dino_transfer_hook resolves correctly.
  const [extraMetaPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), buy.securityMint.toBuffer()],
    hookProgramId,
  );
  const [destHolderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("holder"), buy.securityMint.toBuffer(), buy.creator.toBuffer()],
    programId,
  );

  const remainingAccounts: AccountMeta[] = [
    { pubkey: hookProgramId, isSigner: false, isWritable: false },
    { pubkey: extraMetaPda, isSigner: false, isWritable: false },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: seriesPda, isSigner: false, isWritable: false },
    { pubkey: destHolderPda, isSigner: false, isWritable: false },
  ];

  const ix = await program.methods
    .executeSettlement()
    .accountsStrict({
      platform: platformPda,
      series: seriesPda,
      buyOrder: buy.pda,
      sellOrder: sell.pda,
      securityMint: buy.securityMint,
      paymentMint: buy.paymentMint,
      buyerPaymentAta,
      sellerPaymentAta,
      buyerSecurityAta,
      sellerSecurityAta,
      agent: agent.publicKey,
      tokenProgram: securityProgram,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = blockhash;
  tx.feePayer = agent.publicKey;
  tx.sign(agent);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  const conf = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (conf.value.err) {
    throw new Error(`executeSettlement tx ${sig} reverted: ${JSON.stringify(conf.value.err)}`);
  }
  return sig;
}

/**
 * One tick of the matching loop: fetch open orders, find matches, execute
 * each one. Returns the number of successful settlements.
 */
export async function runMatchingTick(): Promise<{
  matched: number;
  settled: number;
  errors: number;
  agentLoaded: boolean;
  openOrders: number;
}> {
  const agent = loadAgent();
  if (!agent) {
    console.warn("[settlement-agent] tick skipped — SETTLEMENT_AGENT_KEY not configured");
    return { matched: 0, settled: 0, errors: 0, agentLoaded: false, openOrders: 0 };
  }
  const program = programFor(agent);
  const orders = await fetchOpenOrders();
  const matches = findMatches(orders);
  console.log(
    `[settlement-agent] tick: ${orders.length} open orders, ${matches.length} matchable (agent=${agent.publicKey.toBase58().slice(0, 8)}..)`,
  );
  if (matches.length === 0) {
    if (orders.length >= 2) {
      // We saw orders but couldn't pair them. Log a shape sample so
      // operators can see why — common reasons: mint mismatch, amount
      // mismatch, or same creator on both sides.
      for (const o of orders.slice(0, 4)) {
        console.log(
          `  order ${o.pda.toBase58().slice(0, 8)}.. side=${o.side} mint=${o.securityMint.toBase58().slice(0, 8)}.. tok=${o.tokenAmount} pay=${o.paymentAmount} creator=${o.creator.toBase58().slice(0, 8)}..`,
        );
      }
    }
    return { matched: 0, settled: 0, errors: 0, agentLoaded: true, openOrders: orders.length };
  }

  let settled = 0, errors = 0;
  for (const m of matches) {
    try {
      const sig = await executeMatch(agent, program, m);
      console.log(`[settlement-agent] settled ${m.buy.pda.toBase58().slice(0, 8)}..×${m.sell.pda.toBase58().slice(0, 8)}.. tx=${sig.slice(0, 8)}..`);
      settled++;
    } catch (err: any) {
      console.error(`[settlement-agent] settle failed:`, err?.message ?? err);
      errors++;
    }
  }
  return { matched: matches.length, settled, errors, agentLoaded: true, openOrders: orders.length };
}

/**
 * Start the background matching loop. Polls every 30s. Safe to call once
 * from the server entrypoint — idempotent if the agent key isn't configured
 * (it'll just no-op each tick).
 */
export function startSettlementAgent() {
  const agent = loadAgent();
  if (!agent) {
    console.log("[settlement-agent] SETTLEMENT_AGENT_KEY not configured — matching disabled");
    return;
  }
  console.log(`[settlement-agent] starting with agent ${agent.publicKey.toBase58()}`);
  const tick = async () => {
    try {
      await runMatchingTick();
    } catch (err) {
      console.error("[settlement-agent] tick failed:", err);
    }
  };
  // First tick immediately, then every 30s.
  void tick();
  setInterval(tick, 30_000);
}
