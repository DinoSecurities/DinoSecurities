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

// Helius free tier blocks getProgramAccounts, so we force the public
// devnet RPC for order scans regardless of env. Matches the on-chain-
// fetcher's policy. Mainnet will need a paid-plan RPC that permits
// scans; set SOLANA_RPC_FALLBACK to that when the time comes.
const RPC_URL = env.SOLANA_RPC_FALLBACK || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
console.log(`[settlement-agent] RPC = ${RPC_URL}`);
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

let lastFetchBreakdown = {
  raw: 0, decoded: 0, open: 0, dropped: 0,
  decodeErr: 0, notOpen: 0, expired: 0,
  statusKeys: [] as string[],
  lastError: "" as string,
  decodedFieldSample: null as any,
};

export function getLastFetchBreakdown() { return lastFetchBreakdown; }

async function fetchOpenOrders(): Promise<OpenOrder[]> {
  if (ORDER_DISCRIMINATOR.length !== 8) {
    console.warn(`[settlement-agent] ORDER_DISCRIMINATOR.length = ${ORDER_DISCRIMINATOR.length} — IDL not loaded correctly`);
    return [];
  }
  const filter = { memcmp: { offset: 0, bytes: bs58.encode(ORDER_DISCRIMINATOR) } };
  console.log(`[settlement-agent] fetching orders: program=${programId.toBase58().slice(0, 8)}.. disc=${bs58.encode(ORDER_DISCRIMINATOR)}`);
  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [filter],
  });
  console.log(`[settlement-agent] RPC returned ${accounts.length} raw accounts`);
  const now = Math.floor(Date.now() / 1000);
  const out: OpenOrder[] = [];
  let decoded = 0, dropped = 0, decodeErr = 0, notOpen = 0, expired = 0;
  let lastError = "", decodedFieldSample: any = null;
  const statusKeys = new Set<string>();
  for (const { pubkey, account } of accounts) {
    try {
      const d: any = accountsCoder.decode("SettlementOrder", account.data);
      decoded++;
      if (decodedFieldSample === null) {
        decodedFieldSample = {
          keys: Object.keys(d),
          creatorType: typeof d.creator,
          nonceType: typeof d.nonce,
          tokenAmountType: typeof (d.token_amount ?? d.tokenAmount),
          securityMintType: typeof (d.security_mint ?? d.securityMint),
        };
      }
      // Anchor 0.32 emits enum variant keys in the original Rust case
      // ("Open" / "Buy" / "Sell"), not lowercase. Normalise for both.
      const rawStatus = Object.keys(d.status ?? {})[0] ?? "";
      statusKeys.add(rawStatus);
      const statusKey = rawStatus.toLowerCase();
      const expiresAt = Number(d.expires_at ?? d.expiresAt ?? 0);
      if (statusKey !== "open") { dropped++; notOpen++; continue; }
      if (expiresAt <= now) { dropped++; expired++; continue; }
      const sideKey = (Object.keys(d.side)[0] ?? "").toLowerCase();
      out.push({
        pda: pubkey,
        creator: d.creator,
        side: sideKey === "sell" ? "Sell" : "Buy",
        securityMint: d.security_mint ?? d.securityMint,
        paymentMint: d.payment_mint ?? d.paymentMint,
        tokenAmount: BigInt(d.token_amount?.toString() ?? d.tokenAmount?.toString() ?? "0"),
        paymentAmount: BigInt(d.payment_amount?.toString() ?? d.paymentAmount?.toString() ?? "0"),
        expiresAt,
        // d.nonce is already a BN instance from the BorshAccountsCoder —
        // no need to reconstruct. `new anchor.BN(...)` was throwing
        // "not a constructor" under ESM interop anyway.
        nonce: d.nonce,
      });
    } catch (err) {
      // skip un-decodeable accounts but track them
      dropped++;
      decodeErr++;
      if (!lastError) lastError = (err as Error)?.message ?? String(err);
      if (decodeErr <= 2) {
        console.error(`[settlement-agent] decode/shape error on ${pubkey.toBase58()}:`, (err as Error)?.message);
      }
    }
  }
  lastFetchBreakdown = {
    raw: accounts.length, decoded, open: out.length, dropped,
    decodeErr, notOpen, expired,
    statusKeys: Array.from(statusKeys),
    lastError,
    decodedFieldSample,
  };
  console.log(`[settlement-agent] fetchOpenOrders: ${accounts.length} raw -> ${decoded} decoded -> ${out.length} open (${dropped} dropped; notOpen=${notOpen} expired=${expired} decodeErr=${decodeErr}) statuses=${Array.from(statusKeys).join(",")}`);
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

  // Transfer-hook extras. Token-2022 forwards the outer tx's
  // remaining_accounts as-is to the hook Execute ix, in this order:
  //   [0] ExtraAccountMetaList PDA (hook reads it to resolve extras)
  //   [1] dino_core program    (extras[0] in hook's declaration)
  //   [2] series PDA           (extras[1])
  //   [3] dest HolderRecord    (extras[2])
  //   [4] hook program ID      (so Token-2022 can invoke)
  const [extraMetaPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), buy.securityMint.toBuffer()],
    hookProgramId,
  );
  const [destHolderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("holder"), buy.securityMint.toBuffer(), buy.creator.toBuffer()],
    programId,
  );

  const remainingAccounts: AccountMeta[] = [
    { pubkey: extraMetaPda, isSigner: false, isWritable: false },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: seriesPda, isSigner: false, isWritable: false },
    { pubkey: destHolderPda, isSigner: false, isWritable: false },
    { pubkey: hookProgramId, isSigner: false, isWritable: false },
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
      securityTokenProgram: securityProgram,
      paymentTokenProgram: paymentProgram,
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
  errorSamples?: string[];
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
  const errorSamples: string[] = [];
  for (const m of matches) {
    try {
      const sig = await executeMatch(agent, program, m);
      console.log(`[settlement-agent] settled ${m.buy.pda.toBase58().slice(0, 8)}..×${m.sell.pda.toBase58().slice(0, 8)}.. tx=${sig.slice(0, 8)}..`);
      settled++;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[settlement-agent] settle failed:`, msg);
      if (errorSamples.length < 2) errorSamples.push(msg);
      errors++;
    }
  }
  return { matched: matches.length, settled, errors, agentLoaded: true, openOrders: orders.length, errorSamples };
}

/**
 * Raw RPC probe for diagnostics. Returns the total number of accounts
 * owned by dino_core AND the number matching the SettlementOrder
 * discriminator filter, so we can see whether a 0 result is because the
 * program has no orders or because the filter is dropping them.
 */
export async function debugFetch(): Promise<{
  rpc: string;
  program: string;
  discriminatorB58: string;
  totalAccountsUnfiltered: number | string;
  totalAccountsFiltered: number | string;
  sample: Array<{ pubkey: string; dataLen: number; firstBytes: string }>;
}> {
  const out: any = {
    rpc: RPC_URL,
    program: programId.toBase58(),
    discriminatorB58: bs58.encode(ORDER_DISCRIMINATOR),
    totalAccountsUnfiltered: "?",
    totalAccountsFiltered: "?",
    sample: [],
  };
  try {
    const unfiltered = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      dataSlice: { offset: 0, length: 16 }, // cheap — just the discriminator
    });
    out.totalAccountsUnfiltered = unfiltered.length;
    out.sample = unfiltered.slice(0, 5).map((a) => ({
      pubkey: a.pubkey.toBase58(),
      dataLen: a.account.data.length,
      firstBytes: Buffer.from(a.account.data).slice(0, 8).toString("hex"),
    }));
  } catch (e: any) {
    out.totalAccountsUnfiltered = `error: ${e?.message ?? e}`;
  }
  try {
    const filtered = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      filters: [{ memcmp: { offset: 0, bytes: bs58.encode(ORDER_DISCRIMINATOR) } }],
    });
    out.totalAccountsFiltered = filtered.length;
    // Decode the first few so we can see exactly what status + side look like
    out.decodedSample = filtered.slice(0, 5).map((a) => {
      try {
        const d: any = accountsCoder.decode("SettlementOrder", a.account.data);
        return {
          pda: a.pubkey.toBase58(),
          statusKey: Object.keys(d.status ?? {})[0],
          sideKey: Object.keys(d.side ?? {})[0],
          expiresAt: Number(d.expires_at ?? d.expiresAt ?? 0),
        };
      } catch (e: any) {
        return { pda: a.pubkey.toBase58(), error: String(e?.message ?? e) };
      }
    });
  } catch (e: any) {
    out.totalAccountsFiltered = `error: ${e?.message ?? e}`;
  }
  return out;
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
