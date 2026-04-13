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

app.listen(env.PORT, () => {
  console.log(`DinoSecurities API running on port ${env.PORT}`);
  console.log(`  tRPC:     http://localhost:${env.PORT}/trpc`);
  console.log(`  Health:   http://localhost:${env.PORT}/health`);
  console.log(`  Webhooks: http://localhost:${env.PORT}/webhooks/helius`);
});
