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
import { db } from "./db/index.js";
import { settlementOrders, indexedSeries } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { env } from "./env.js";

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

app.listen(env.PORT, () => {
  console.log(`DinoSecurities API running on port ${env.PORT} [${BUILD_MARKER}]`);
  console.log(`  tRPC:     http://localhost:${env.PORT}/trpc`);
  console.log(`  Health:   http://localhost:${env.PORT}/health`);
  console.log(`  Webhooks: http://localhost:${env.PORT}/webhooks/helius`);
  startSettlementAgent();
});
