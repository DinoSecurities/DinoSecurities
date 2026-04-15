/**
 * End-to-end smoke test for the full DvP lifecycle on Solana devnet.
 *
 * The deployer wallet (loaded from ANCHOR_WALLET) plays admin + issuer +
 * oracle. The script generates two throwaway keypairs for buyer and
 * seller, funds them with SOL, creates its own payment token (no
 * dependence on Circle's devnet USDC being faucetable), mints security
 * tokens to the seller, and runs both sides through the full order
 * lifecycle. Success = both orders flipped to Settled and the token
 * balances moved the right directions.
 *
 * Run with:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/dinosecurities-deployer.json \
 *   npx ts-node --transpile-only --compiler-options \
 *     '{"module":"commonjs","esModuleInterop":true,"resolveJsonModule":true}' \
 *     scripts/smoke-test.ts
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createApproveCheckedInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const IDL_PATH = path.resolve(__dirname, "../target/idl/dino_core.json");
const HOOK_IDL_PATH = path.resolve(__dirname, "../target/idl/dino_transfer_hook.json");

const CORE_IDL = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
const HOOK_IDL = JSON.parse(fs.readFileSync(HOOK_IDL_PATH, "utf8"));
const CORE_ID = new PublicKey(CORE_IDL.address);
const HOOK_ID = new PublicKey(HOOK_IDL.address);

const SETTLEMENT_AGENT = new PublicKey("D9byTNj21tmLoHX6SXiY2kjKXPjjGZwTejx1ccpBPpj4");
const BACKEND_URL = process.env.BACKEND_URL ?? "https://squid-app-zj6jb.ondigitalocean.app";
const MATCHING_SECRET = process.env.WEBHOOK_SECRET ?? "2eaa668af67e4218906d84eafdfa6e62e0a5941e94657d2d81b0fdad04100326";

function log(step: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${step.padEnd(14)} ${msg}`);
}

function fail(step: string, msg: string): never {
  console.error(`\n✗ ${step}: ${msg}\n`);
  process.exit(1);
}

async function airdropOrTransfer(
  provider: anchor.AnchorProvider,
  payer: Keypair,
  to: PublicKey,
  lamports: number,
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports }),
  );
  await provider.sendAndConfirm(tx, [payer]);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const deployer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;
  const coreProgram = new anchor.Program(CORE_IDL as any, provider);
  const hookProgram = new anchor.Program(HOOK_IDL as any, provider);

  log("setup", `deployer = ${deployer.publicKey.toBase58()}`);
  const solBalance = await connection.getBalance(deployer.publicKey);
  log("setup", `deployer balance = ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (solBalance < 0.3 * LAMPORTS_PER_SOL) fail("setup", "deployer needs >= 0.3 devnet SOL");

  // --- actors ----------------------------------------------------------------
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  log("actors", `seller = ${seller.publicKey.toBase58().slice(0, 8)}..`);
  log("actors", `buyer  = ${buyer.publicKey.toBase58().slice(0, 8)}..`);

  for (const kp of [seller, buyer]) {
    await airdropOrTransfer(provider, deployer, kp.publicKey, 0.04 * LAMPORTS_PER_SOL);
  }
  log("actors", "funded both with 0.04 SOL each");

  // --- payment mint (plain SPL token, deployer is mint authority) -----------
  // Classic SPL, matching real USDC on mainnet.
  const paymentMint = Keypair.generate();
  const paymentDecimals = 6;
  const paymentLen = 82; // classic SPL mint
  const paymentRent = await connection.getMinimumBalanceForRentExemption(paymentLen);
  const paymentTx = new Transaction()
    .add(
      SystemProgram.createAccount({
        fromPubkey: deployer.publicKey,
        newAccountPubkey: paymentMint.publicKey,
        lamports: paymentRent,
        space: paymentLen,
        programId: TOKEN_PROGRAM_ID,
      }),
    )
    .add(
      createInitializeMintInstruction(
        paymentMint.publicKey,
        paymentDecimals,
        deployer.publicKey,
        null,
        TOKEN_PROGRAM_ID,
      ),
    );
  await provider.sendAndConfirm(paymentTx, [deployer, paymentMint]);
  log("payment", `mint = ${paymentMint.publicKey.toBase58().slice(0, 8)}..`);

  // Fund buyer with 100_000 test "USDC" (= 100_000 * 10^6 in lamports).
  const buyerPaymentAta = getAssociatedTokenAddressSync(paymentMint.publicKey, buyer.publicKey);
  const buyerFundTx = new Transaction()
    .add(
      createAssociatedTokenAccountInstruction(
        deployer.publicKey,
        buyerPaymentAta,
        buyer.publicKey,
        paymentMint.publicKey,
      ),
    )
    .add(
      createMintToInstruction(
        paymentMint.publicKey,
        buyerPaymentAta,
        deployer.publicKey,
        100_000n * 10n ** BigInt(paymentDecimals),
      ),
    );
  await provider.sendAndConfirm(buyerFundTx, [deployer]);
  log("payment", "buyer funded with 100,000 test USDC");

  // Seller needs an empty payment ATA so the DvP can credit them.
  const sellerPaymentAta = getAssociatedTokenAddressSync(paymentMint.publicKey, seller.publicKey);
  const sellerAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      deployer.publicKey,
      sellerPaymentAta,
      seller.publicKey,
      paymentMint.publicKey,
    ),
  );
  await provider.sendAndConfirm(sellerAtaTx, [deployer]);

  // --- security mint (Token-2022 with extensions) ---------------------------
  const securityMint = Keypair.generate();
  const [seriesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("series"), securityMint.publicKey.toBuffer()],
    CORE_ID,
  );
  const [issuerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), deployer.publicKey.toBuffer()],
    CORE_ID,
  );
  const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from("platform")], CORE_ID);
  const [extraMetaPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), securityMint.publicKey.toBuffer()],
    HOOK_ID,
  );

  const extensions = [
    ExtensionType.TransferHook,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];
  const mintLen = getMintLen(extensions);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  const hookInitIx = await hookProgram.methods
    .initializeExtraAccountMetaList()
    .accountsStrict({
      payer: deployer.publicKey,
      extraAccountMetaList: extraMetaPda,
      mint: securityMint.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const securityMintTx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(
      SystemProgram.createAccount({
        fromPubkey: deployer.publicKey,
        newAccountPubkey: securityMint.publicKey,
        lamports: mintRent,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
    )
    .add(
      createInitializeTransferHookInstruction(
        securityMint.publicKey, seriesPda, HOOK_ID, TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(
      createInitializeMetadataPointerInstruction(
        securityMint.publicKey, seriesPda, securityMint.publicKey, TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(
      createInitializePermanentDelegateInstruction(
        securityMint.publicKey, seriesPda, TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(
      createInitializeMintInstruction(
        securityMint.publicKey, 0, seriesPda, seriesPda, TOKEN_2022_PROGRAM_ID,
      ),
    )
    .add(hookInitIx);
  await provider.sendAndConfirm(securityMintTx, [deployer, securityMint]);
  log("security", `mint = ${securityMint.publicKey.toBase58().slice(0, 8)}..`);

  // Register issuer profile for the deployer if it doesn't exist.
  const issuerInfo = await connection.getAccountInfo(issuerPda);
  if (!issuerInfo) {
    const kycHash = Array.from(createHash("sha256").update(`issuer:${deployer.publicKey.toBase58()}`).digest());
    const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
    await coreProgram.methods
      .registerIssuer("Smoke Test Issuer", "US", kycHash, expiry)
      .accountsStrict({
        issuer: issuerPda,
        platform: platformPda,
        oracle: deployer.publicKey,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    log("issuer", "registered");
  } else {
    log("issuer", "already registered");
  }

  // Create the series.
  const symbol = "SMOKE" + Date.now().toString().slice(-5);
  const docHash = Array.from(createHash("sha256").update("smoke-test-doc").digest());
  await coreProgram.methods
    .createSecuritySeries({
      name: "Smoke Test Equity",
      symbol,
      securityType: { equity: {} },
      docHash,
      docUri: "ar://smoke",
      isin: "",
      maxSupply: new anchor.BN(10_000),
      transferRestriction: { regD: {} },
    } as any)
    .accountsStrict({
      issuer: issuerPda,
      series: seriesPda,
      mint: securityMint.publicKey,
      authority: deployer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  log("series", `created ${symbol}`);

  // --- whitelist both actors (via backend oracle co-signer) -----------------
  // The platform's configured kyc_oracle is a dedicated key held by the
  // backend — we don't have it locally. Build the register_holder tx with
  // the oracle's pubkey in the signer slot, have the deployer partial-sign
  // as fee payer, then POST to /register-holder for the oracle co-sign.
  const oracleRes = await fetch(`${BACKEND_URL}/oracle-pubkey`);
  const { pubkey: oraclePubkeyStr } = await oracleRes.json();
  if (!oraclePubkeyStr) fail("whitelist", "backend didn't return oracle pubkey");
  const oraclePubkey = new PublicKey(oraclePubkeyStr);
  log("whitelist", `oracle = ${oraclePubkeyStr.slice(0, 8)}..`);

  for (const [name, kp] of [["seller", seller], ["buyer", buyer]] as const) {
    const [holderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("holder"), securityMint.publicKey.toBuffer(), kp.publicKey.toBuffer()],
      CORE_ID,
    );
    const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
    const kycHash = Array.from(createHash("sha256").update(`holder:${kp.publicKey.toBase58()}`).digest());
    const ix = await coreProgram.methods
      .registerHolder(kp.publicKey, kycHash, expiry, true, [85, 83])
      .accountsStrict({
        platform: platformPda,
        holder: holderPda,
        mint: securityMint.publicKey,
        signer: oraclePubkey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = new Transaction().add(ix);
    tx.feePayer = deployer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.partialSign(deployer);
    const signedBase64 = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
    const res = await fetch(`${BACKEND_URL}/register-holder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTxBase64: signedBase64 }),
    });
    if (!res.ok) fail("whitelist", `${name}: ${res.status} ${await res.text()}`);
    const { signature } = (await res.json()) as { signature: string };
    log("whitelist", `${name} -> ${kp.publicKey.toBase58().slice(0, 8)}.. tx=${signature.slice(0, 8)}..`);
  }

  // --- mint 100 security tokens to seller -----------------------------------
  const sellerSecurityAta = getAssociatedTokenAddressSync(
    securityMint.publicKey, seller.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  await coreProgram.methods
    .mintSecurities(new anchor.BN(100))
    .accountsStrict({
      series: seriesPda,
      issuer: issuerPda,
      mint: securityMint.publicKey,
      recipient: seller.publicKey,
      recipientTokenAccount: sellerSecurityAta,
      authority: deployer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  log("mint", "100 tokens -> seller");

  // Pre-create buyer's security ATA so execute_settlement has somewhere to land.
  const buyerSecurityAta = getAssociatedTokenAddressSync(
    securityMint.publicKey, buyer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const buyerSecAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      deployer.publicKey, buyerSecurityAta, buyer.publicKey, securityMint.publicKey,
      TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );
  await provider.sendAndConfirm(buyerSecAtaTx, [deployer]);

  // --- both parties approve the settlement agent + create orders ------------
  const TOKEN_AMOUNT = new anchor.BN(50);
  const PAYMENT_AMOUNT = new anchor.BN(500 * 10 ** paymentDecimals); // 500 payment tokens

  async function createOrder(creator: Keypair, side: "buy" | "sell"): Promise<PublicKey> {
    const nonce = new anchor.BN(Date.now() + (side === "buy" ? 1 : 0));
    const [orderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), creator.publicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      CORE_ID,
    );
    const approveMint = side === "buy" ? paymentMint.publicKey : securityMint.publicKey;
    const approveAmount = side === "buy" ? PAYMENT_AMOUNT : TOKEN_AMOUNT;
    const approveProgram = side === "buy" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
    const approveDecimals = side === "buy" ? paymentDecimals : 0;
    const ownerAta = getAssociatedTokenAddressSync(
      approveMint, creator.publicKey, false, approveProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const tx = new Transaction()
      .add(
        createApproveCheckedInstruction(
          ownerAta, approveMint, SETTLEMENT_AGENT, creator.publicKey,
          BigInt(approveAmount.toString()), approveDecimals, [], approveProgram,
        ),
      )
      .add(
        await coreProgram.methods
          .createSettlementOrder({
            side: side === "buy" ? { buy: {} } : { sell: {} },
            tokenAmount: TOKEN_AMOUNT,
            paymentAmount: PAYMENT_AMOUNT,
            expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) + 3600),
            nonce,
          } as any)
          .accountsStrict({
            order: orderPda,
            securityMint: securityMint.publicKey,
            paymentMint: paymentMint.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
    await provider.sendAndConfirm(tx, [creator]);
    return orderPda;
  }

  const sellOrderPda = await createOrder(seller, "sell");
  log("order", `sell ${sellOrderPda.toBase58().slice(0, 8)}..`);
  const buyOrderPda = await createOrder(buyer, "buy");
  log("order", `buy  ${buyOrderPda.toBase58().slice(0, 8)}..`);

  // --- trigger the matching loop --------------------------------------------
  // Devnet RPC lags a few seconds between tx confirm and getProgramAccounts
  // visibility. Retry matching up to 6 times with growing delay so we
  // don't declare failure over a ~10-15s indexing race.
  log("match", "waiting 4s for devnet RPC to index orders");
  await new Promise((r) => setTimeout(r, 4000));

  let matchResult: any = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${BACKEND_URL}/admin/run-matching`, {
      method: "POST",
      headers: { authorization: MATCHING_SECRET },
    });
    if (!res.ok) fail("match", `backend returned ${res.status}: ${await res.text()}`);
    matchResult = await res.json();
    log("match", `attempt ${attempt}: ${JSON.stringify(matchResult)}`);
    if (matchResult.settled > 0) break;
    if (matchResult.openOrders >= 2 && matchResult.matched === 0) {
      log("match", "orders visible but not matched — see DO logs for shape mismatch");
      break;
    }
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }

  // --- verify both orders settled ------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  const sellOrder: any = await (coreProgram.account as any).settlementOrder.fetch(sellOrderPda);
  const buyOrder: any = await (coreProgram.account as any).settlementOrder.fetch(buyOrderPda);
  const sellStatus = Object.keys(sellOrder.status)[0];
  const buyStatus = Object.keys(buyOrder.status)[0];
  log("verify", `sell.status = ${sellStatus}`);
  log("verify", `buy.status  = ${buyStatus}`);
  if (sellStatus !== "settled" || buyStatus !== "settled") {
    fail("verify", "expected both orders settled");
  }

  // Balance checks.
  const sellerSec = await getAccount(connection, sellerSecurityAta, "confirmed", TOKEN_2022_PROGRAM_ID);
  const buyerSec = await getAccount(connection, buyerSecurityAta, "confirmed", TOKEN_2022_PROGRAM_ID);
  const sellerPay = await getAccount(connection, sellerPaymentAta, "confirmed", TOKEN_PROGRAM_ID);
  const buyerPay = await getAccount(connection, buyerPaymentAta, "confirmed", TOKEN_PROGRAM_ID);
  log("balance", `seller security = ${sellerSec.amount} (expected 50)`);
  log("balance", `buyer security  = ${buyerSec.amount} (expected 50)`);
  log("balance", `seller payment  = ${sellerPay.amount} (expected 500_000_000)`);
  log("balance", `buyer payment   = ${buyerPay.amount} (expected 99_500_000_000)`);

  const ok =
    sellerSec.amount === 50n &&
    buyerSec.amount === 50n &&
    sellerPay.amount === 500_000_000n &&
    buyerPay.amount === 99_500_000_000n;

  if (!ok) fail("verify", "balance mismatch");

  console.log("\n✓ SMOKE TEST PASSED — full DvP lifecycle verified on devnet\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
