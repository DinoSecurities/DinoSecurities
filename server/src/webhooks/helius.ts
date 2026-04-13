import type { Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { webhookEvents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { handleWebhookEvent } from "./handlers.js";

/**
 * Helius "Enhanced Webhook" auth model: it doesn't sign requests with HMAC.
 * Whatever string you set as the "Auth Header" in the Helius dashboard is
 * passed through verbatim as the `Authorization` request header. We do a
 * constant-time compare against env.WEBHOOK_SECRET.
 */
function verifyAuth(header: string | undefined): boolean {
  if (!header) return false;
  const a = Buffer.from(header.trim());
  const b = Buffer.from(env.WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function heliusWebhookHandler(req: Request, res: Response) {
  try {
    if (!verifyAuth(req.header("authorization") ?? req.header("x-webhook-signature"))) {
      return res.status(401).json({ error: "Invalid auth header" });
    }

    // The /webhooks raw middleware in index.ts hands us a Buffer; parse it
    // ourselves so this route doesn't depend on the global JSON middleware.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "invalid json" });
    }

    const events = Array.isArray(payload) ? payload : [payload];
    let processed = 0;
    for (const event of events) {
      const txSignature: string | undefined =
        event.signature || event.transaction?.signatures?.[0];
      if (!txSignature) continue;

      const [existing] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.txSignature, txSignature))
        .limit(1);
      if (existing) continue;

      await db.insert(webhookEvents).values({
        txSignature,
        eventType: event.type || "unknown",
        accounts: event.accountData || null,
        rawData: event,
        processed: false,
      });

      try {
        await handleWebhookEvent({
          ...event,
          // handlers.ts looks for logMessages; Helius enhanced events nest
          // them under transaction.meta.logMessages.
          logMessages:
            event.logMessages ??
            event.meta?.logMessages ??
            event.transaction?.meta?.logMessages ??
            [],
        });
        await db
          .update(webhookEvents)
          .set({ processed: true, processedAt: new Date() })
          .where(eq(webhookEvents.txSignature, txSignature));
        processed++;
      } catch (err) {
        console.error(`[helius-webhook] failed to process ${txSignature}:`, err);
      }
    }

    console.log(`[helius-webhook] received ${events.length} events, processed ${processed}`);
    res.json({ received: events.length, processed });
  } catch (err) {
    console.error("[helius-webhook] handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
