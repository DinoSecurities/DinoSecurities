import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { heliusWebhookHandler } from "./webhooks/helius.js";
import { onKYCComplete } from "./services/kyc-oracle.js";
import { env } from "./env.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook routes (raw Express, not tRPC)
app.post("/webhooks/helius", heliusWebhookHandler);

// KYC provider webhook
app.post("/webhooks/kyc", async (req, res) => {
  try {
    const { wallet, sessionId, approved, hash } = req.body;
    await onKYCComplete(wallet, sessionId, approved, hash);
    res.json({ received: true });
  } catch (err) {
    console.error("KYC webhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// tRPC API
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(env.PORT, () => {
  console.log(`DinoSecurities API running on port ${env.PORT}`);
  console.log(`  tRPC:     http://localhost:${env.PORT}/trpc`);
  console.log(`  Health:   http://localhost:${env.PORT}/health`);
  console.log(`  Webhooks: http://localhost:${env.PORT}/webhooks/helius`);
});
