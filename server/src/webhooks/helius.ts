import type { Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { webhookEvents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { handleWebhookEvent } from "./handlers.js";

/**
 * Verify HMAC-SHA256 signature from Helius webhook
 */
function verifySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Express handler for Helius enhanced webhook events
 */
export async function heliusWebhookHandler(req: Request, res: Response) {
  try {
    // Verify HMAC signature
    const signature = req.headers["x-webhook-signature"] as string;
    if (!signature) {
      res.status(401).json({ error: "Missing signature" });
      return;
    }

    const rawBody = JSON.stringify(req.body);
    if (!verifySignature(rawBody, signature)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const txSignature = event.signature || event.transaction?.signatures?.[0];
      if (!txSignature) continue;

      // Idempotency check
      const [existing] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.txSignature, txSignature))
        .limit(1);

      if (existing) continue;

      // Store raw event
      await db.insert(webhookEvents).values({
        txSignature,
        eventType: event.type || "unknown",
        accounts: event.accountData || null,
        rawData: event,
        processed: false,
      });

      // Process event
      try {
        await handleWebhookEvent(event);
        await db
          .update(webhookEvents)
          .set({ processed: true, processedAt: new Date() })
          .where(eq(webhookEvents.txSignature, txSignature));
      } catch (err) {
        console.error(`Failed to process event ${txSignature}:`, err);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
