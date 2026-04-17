import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { heliusWebhookHandler } from "./webhooks/helius.js";
import { onKYCComplete, getKYCProvider } from "./services/kyc-oracle.js";
import { uploadDocument } from "./services/arweave.js";
import { startSettlementAgent, runMatchingTick, debugFetch, getLastFetchBreakdown } from "./services/settlement-agent.js";
import { cosignAndSubmit, getOraclePubkey } from "./services/oracle-signer.js";
import { buildReceipt } from "./services/trade-receipt.js";
import {
  refreshAllSanctionsLists,
  screenWallet,
  isAdminWallet,
} from "./services/sanctions.js";
import { db } from "./db/index.js";
import {
  settlementOrders,
  indexedSeries,
  sanctionsOverrides,
} from "./db/schema.js";
import { eq, desc } from "drizzle-orm";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { env } from "./env.js";
import { wss } from "./ws.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https:", "wss:"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const corsOrigins = env.CORS_ORIGIN.split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const webhookLimiter = rateLimit({ windowMs: 60_000, limit: 600 });

// Capture raw body for webhook signature verification.
app.use("/webhooks", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/webhooks/helius", webhookLimiter, heliusWebhookHandler);

app.post("/webhooks/kyc", webhookLimiter, async (req, res) => {
  try {
    const raw = (req.body as Buffer).toString("utf8");
    // Didit v3 sends three signatures: X-Signature (HMAC(timestamp + body)),
    // X-Signature-V2 (same algo, v2 format), and X-Signature-Simple (plain
    // HMAC(body)). Our verifier computes plain HMAC(body), so we prefer the
    // Simple variant. Fall back to X-Signature with timestamp prefix.
    const sigSimple = String(req.header("x-signature-simple") ?? "");
    const sigLegacy = String(req.header("x-didit-signature") ?? req.header("x-signature") ?? "");
    const timestamp = String(req.header("x-timestamp") ?? "");
    console.log(
      `[kyc-webhook] received ${raw.length} bytes, ` +
      `simple=${sigSimple.slice(0, 16)}..., legacy=${sigLegacy.slice(0, 16)}..., ts=${timestamp}`,
    );
    const provider = getKYCProvider();
    const verified =
      (sigSimple && provider.verifyWebhookSignature(raw, sigSimple)) ||
      (sigLegacy && timestamp && provider.verifyWebhookSignature(`${timestamp}.${raw}`, sigLegacy)) ||
      (sigLegacy && provider.verifyWebhookSignature(raw, sigLegacy));
    if (!verified) {
      console.warn("[kyc-webhook] signature verification FAILED (tried simple + timestamp+body + raw)");
      return res.status(401).json({ error: "invalid signature" });
    }
    const payload = JSON.parse(raw);
    const parsed = provider.parseWebhook(payload);
    await onKYCComplete(parsed.walletAddress, parsed.sessionId, parsed.status === "approved", parsed.hash, {
      isAccredited: parsed.isAccredited,
      countryCode: parsed.countryCode,
    });
    res.json({ received: true });
  } catch (err) {
    console.error("KYC webhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Document upload — multipart, capped at 50 MB to match the wizard's
// declared limit. Hands the file to Irys → Arweave and returns the URI.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
app.post("/upload-document", uploadLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no file" });
    const result = await uploadDocument(req.file.buffer, {
      contentType: req.file.mimetype || "application/pdf",
      securityType: typeof req.body?.securityType === "string" ? req.body.securityType : undefined,
      isin: typeof req.body?.isin === "string" ? req.body.isin : undefined,
      jurisdiction: typeof req.body?.jurisdiction === "string" ? req.body.jurisdiction : undefined,
    });
    res.json(result);
  } catch (err: any) {
    console.error("upload-document failed:", err);
    res.status(500).json({ error: err?.message ?? "upload failed" });
  }
});

app.use("/trpc", apiLimiter, createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// KYC oracle co-signing endpoints. Client partial-signs a tx containing
// exactly one register_issuer / register_holder call, posts it here, we
// co-sign with the oracle keypair and submit.
const coSignLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
app.get("/oracle-pubkey", (_req, res) => {
  const pk = getOraclePubkey();
  res.json({ pubkey: pk?.toBase58() ?? null });
});
// Plain-text diagnostic: which RPC, which program ID, which agent.
// Exposed without auth because it leaks no secrets — all values are public.
app.get("/agent-debug-fetch", async (_req, res) => {
  try {
    res.json(await debugFetch());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "debug-fetch failed" });
  }
});
app.get("/agent-info", (_req, res) => {
  res.json({
    program: env.DINO_CORE_PROGRAM_ID,
    rpcFallback: env.SOLANA_RPC_FALLBACK ?? null,
    rpcPrimary: env.SOLANA_RPC_URL,
    hasAgentKey: Boolean(env.SETTLEMENT_AGENT_KEY),
    hasOracleKey: Boolean(env.KYC_ORACLE_KEY),
    adminWallets: env.ADMIN_WALLETS || null,
  });
});
app.post("/register-issuer", coSignLimiter, async (req, res) => {
  try {
    const { signedTxBase64 } = req.body ?? {};
    if (typeof signedTxBase64 !== "string") {
      return res.status(400).json({ error: "signedTxBase64 required" });
    }
    const result = await cosignAndSubmit(signedTxBase64, "register_issuer");
    res.json(result);
  } catch (err: any) {
    console.error("[register-issuer] failed:", err?.message ?? err);
    res.status(400).json({ error: err?.message ?? "co-sign failed" });
  }
});
app.post("/register-holder", coSignLimiter, async (req, res) => {
  try {
    const { signedTxBase64 } = req.body ?? {};
    if (typeof signedTxBase64 !== "string") {
      return res.status(400).json({ error: "signedTxBase64 required" });
    }
    const result = await cosignAndSubmit(signedTxBase64, "register_holder");
    res.json(result);
  } catch (err: any) {
    console.error("[register-holder] failed:", err?.message ?? err);
    res.status(400).json({ error: err?.message ?? "co-sign failed" });
  }
});

// Issuer approval path for holder-initiated XRPL-credential whitelist
// requests. The request row already embeds the (xrplAddress, network) we
// verified at submit time; the issuer signs the register_holder tx with
// that holder's pubkey and posts it here. The cosigner re-runs the XRPL
// credential check against the live ledger so a credential revoked
// between submit and approve is caught, then completes the cosign + the
// request row's status transitions to 'approved' with the tx signature.
app.post("/register-holder/xrpl-credential", coSignLimiter, async (req, res) => {
  try {
    const { signedTxBase64, whitelistRequestId } = req.body ?? {};
    if (typeof signedTxBase64 !== "string" || typeof whitelistRequestId !== "number") {
      return res.status(400).json({ error: "signedTxBase64 and whitelistRequestId required" });
    }
    const { db } = await import("./db/index.js");
    const { xrplWhitelistRequests } = await import("./db/schema.js");
    const { eq } = await import("drizzle-orm");
    const [request] = await db
      .select()
      .from(xrplWhitelistRequests)
      .where(eq(xrplWhitelistRequests.id, whitelistRequestId))
      .limit(1);
    if (!request) return res.status(404).json({ error: "request not found" });
    if (request.status !== "pending") {
      return res.status(409).json({ error: `request is ${request.status}, not pending` });
    }
    const { signature } = await cosignAndSubmit(signedTxBase64, "register_holder", {
      source: "xrpl_credential",
      xrplAddress: request.xrplAddress,
      network: request.network as "mainnet" | "testnet" | "devnet",
    });
    await db
      .update(xrplWhitelistRequests)
      .set({
        status: "approved",
        resolvedAt: new Date(),
        resolvedTx: signature,
      })
      .where(eq(xrplWhitelistRequests.id, whitelistRequestId));
    res.json({ signature, requestId: whitelistRequestId });
  } catch (err: any) {
    console.error("[register-holder/xrpl-credential] failed:", err?.message ?? err);
    res.status(400).json({ error: err?.message ?? "co-sign failed", code: err?.code });
  }
});

// Sanctions-list admin endpoints. All require the WEBHOOK_SECRET in
// the Authorization header — same bar as /admin/run-matching.
function requireAdminAuth(req: express.Request): boolean {
  const auth = req.header("authorization");
  return Boolean(auth && auth.trim() === env.WEBHOOK_SECRET);
}

// Trigger a refresh of all three sanctions lists (OFAC SDN / EU /
// UK HMT). Intended to be called by a scheduled cron (DO scheduler or
// external), but also exposed for manual runs during setup.
app.post("/admin/sanctions/refresh", async (req, res) => {
  if (!requireAdminAuth(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const summary = await refreshAllSanctionsLists();
    res.json({ refreshedAt: new Date().toISOString(), summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "refresh failed" });
  }
});

// Screen a specific wallet on demand — useful during onboarding QA.
app.get("/admin/sanctions/screen", async (req, res) => {
  if (!requireAdminAuth(req)) return res.status(401).json({ error: "unauthorized" });
  const wallet = String(req.query.wallet ?? "");
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  try {
    res.json(await screenWallet(wallet));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "screen failed" });
  }
});

// File an override: an authenticated admin wallet explicitly approves a
// sanctions-flagged wallet for onboarding, with free-text justification.
// The admin must sign a message containing the wallet + justification
// so we can audit-log the authorization on-chain-equivalently.
app.post("/admin/sanctions/override", express.json(), async (req, res) => {
  try {
    const {
      wallet,
      seriesMint = null,
      justification,
      adminWallet,
      adminSignatureBase58,
    } = req.body ?? {};
    if (!wallet || !justification || !adminWallet || !adminSignatureBase58) {
      return res.status(400).json({ error: "wallet, justification, adminWallet, adminSignatureBase58 required" });
    }
    if (!isAdminWallet(adminWallet)) {
      return res.status(403).json({ error: "admin wallet not whitelisted" });
    }
    // The admin signed a deterministic message tying their identity to
    // this override. Verify with tweetnacl.
    const msg = `dinosecurities:sanctions-override:${wallet}:${seriesMint ?? "*"}:${justification}`;
    const sig = bs58.decode(adminSignatureBase58);
    const pub = new PublicKey(adminWallet).toBytes();
    if (!nacl.sign.detached.verify(Buffer.from(msg), sig, pub)) {
      return res.status(403).json({ error: "admin signature verification failed" });
    }

    const screen = await screenWallet(wallet);
    const [row] = await db
      .insert(sanctionsOverrides)
      .values({
        wallet,
        seriesMint,
        matchedSources: [...new Set(screen.hits.map((h) => h.source))],
        matchedIdentifiers: screen.hits,
        justification,
        adminWallet,
        adminSignature: adminSignatureBase58,
        status: "active",
      })
      .returning();
    console.log(
      `[sanctions] override #${row.id} filed by ${adminWallet} for ${wallet} (${screen.hits.length} hits)`,
    );
    res.json({ id: row.id, status: row.status, createdAt: row.createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "override failed" });
  }
});

// Revoke an active override. Same auth bar. Appends a status change to
// the audit log instead of deleting the row — overrides are immutable
// history by design.
app.post("/admin/sanctions/override/:id/revoke", async (req, res) => {
  if (!requireAdminAuth(req)) return res.status(401).json({ error: "unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  const [row] = await db
    .update(sanctionsOverrides)
    .set({ status: "revoked" })
    .where(eq(sanctionsOverrides.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "override not found" });
  res.json({ id: row.id, status: row.status });
});

// Bulk whitelist import — issuer uploads a CSV of holders on the
// frontend, signs all the register_holder txs in one Phantom popup via
// signAllTransactions, then POSTs them here. We loop through the array
// calling the same cosignAndSubmit path /register-holder uses, so
// sanctions screening and all validation logic runs identically per row.
// Returns per-row result ({ rowIndex, success, signature | error }) so
// the client can render a progress / status table.
app.post("/admin/bulk-whitelist/submit", express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const { txs } = req.body ?? {};
    if (!Array.isArray(txs) || txs.length === 0) {
      return res.status(400).json({ error: "txs array required" });
    }
    if (txs.length > 100) {
      return res.status(400).json({ error: "max 100 txs per request — chunk client-side" });
    }
    const results: Array<{
      rowIndex: number;
      success: boolean;
      signature?: string;
      error?: string;
      code?: string;
    }> = [];
    for (const entry of txs) {
      const rowIndex = Number(entry?.rowIndex ?? -1);
      const signedTxBase64 = entry?.signedTxBase64;
      if (typeof signedTxBase64 !== "string") {
        results.push({ rowIndex, success: false, error: "signedTxBase64 missing" });
        continue;
      }
      try {
        const { signature } = await cosignAndSubmit(signedTxBase64, "register_holder");
        results.push({ rowIndex, success: true, signature });
      } catch (err: any) {
        results.push({
          rowIndex,
          success: false,
          error: err?.message ?? "cosign failed",
          code: err?.code,
        });
      }
    }
    const summary = {
      total: txs.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
    res.json({ summary, results });
  } catch (err: any) {
    console.error("[bulk-whitelist] failed:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "bulk submit failed" });
  }
});

// Admin endpoint to trigger a matching tick on demand — useful for testing
// and for operators who want to kick the queue without waiting 30s.
app.post("/admin/run-matching", async (req, res) => {
  const auth = req.header("authorization");
  if (!auth || auth.trim() !== env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const result = await runMatchingTick();
    res.json({ ...result, breakdown: getLastFetchBreakdown() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "tick failed" });
  }
});

const BUILD_MARKER = "v28bc88f-errorSamples";

// Trade-confirmation PDF for a settled DvP tx. Streamed on demand —
// we don't persist rendered PDFs; each request rebuilds from the
// authoritative settlement row. 7-year SEC-style retention is implicit
// because the underlying row is never deleted.
app.get("/receipts/:signature.pdf", async (req, res) => {
  try {
    const signature = req.params.signature;
    if (!signature || signature.length < 32) {
      return res.status(400).json({ error: "invalid signature" });
    }
    const [row] = await db
      .select()
      .from(settlementOrders)
      .where(eq(settlementOrders.txSignature, signature))
      .limit(1);
    if (!row || row.status !== "settled") {
      return res.status(404).json({ error: "no settled order for that signature" });
    }
    const [series] = await db
      .select()
      .from(indexedSeries)
      .where(eq(indexedSeries.mintAddress, row.securityMint))
      .limit(1);

    const pdf = await buildReceipt({
      signature: row.txSignature!,
      settledAt: row.settledAt ?? new Date(),
      buyer: row.buyer,
      seller: row.seller,
      securityMint: row.securityMint,
      securitySymbol: series?.symbol ?? null,
      securityName: series?.name ?? null,
      isin: series?.isin ?? null,
      tokenAmount: row.tokenAmount,
      usdcAmount: row.usdcAmount,
      paymentMintLabel: "USDC — EPjFWdd5…wyTDt1v",
      feeLamports: row.feeLamports,
      finalityMs: row.finalityMs,
      slot: row.settlementSlot,
      restriction: series?.transferRestrictions ?? null,
      docHash: series?.docHash ?? null,
      docUri: series?.docUri ?? null,
      // ar.io-signed attestation slot — null until production integration.
      arioAttestation: null,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="DinoSecurities-${(series?.symbol ?? "receipt").toLowerCase()}-${signature.slice(0, 8)}.pdf"`,
    );
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(pdf);
  } catch (err) {
    console.error("[receipt] render failed:", err);
    res.status(500).json({ error: (err as Error)?.message ?? "render failed" });
  }
});

app.get("/build", (_req, res) => res.json({ build: BUILD_MARKER, startedAt: new Date().toISOString() }));

const server = app.listen(env.PORT, () => {
  console.log(`DinoSecurities API running on port ${env.PORT} [${BUILD_MARKER}]`);
  console.log(`  tRPC:     http://localhost:${env.PORT}/trpc`);
  console.log(`  Health:   http://localhost:${env.PORT}/health`);
  console.log(`  Webhooks: http://localhost:${env.PORT}/webhooks/helius`);
  console.log(`  WS:       ws://localhost:${env.PORT}/ws/settlements`);
  startSettlementAgent();
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws/settlements") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});
