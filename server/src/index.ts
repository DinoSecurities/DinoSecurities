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
    const signature = String(req.header("x-didit-signature") ?? req.header("x-signature") ?? "");
    const provider = getKYCProvider();
    if (!provider.verifyWebhookSignature(raw, signature)) {
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

app.listen(env.PORT, () => {
  console.log(`DinoSecurities API running on port ${env.PORT}`);
  console.log(`  tRPC:     http://localhost:${env.PORT}/trpc`);
  console.log(`  Health:   http://localhost:${env.PORT}/health`);
  console.log(`  Webhooks: http://localhost:${env.PORT}/webhooks/helius`);
  startSettlementAgent();
});
