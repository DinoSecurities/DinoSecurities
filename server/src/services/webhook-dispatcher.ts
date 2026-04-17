import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { issuerWebhooks, webhookDeliveries } from "../db/schema.js";

/**
 * Outbound webhook dispatcher. When the Helius handler persists an indexed
 * event, it calls `dispatchEvent(seriesMint, eventType, payload, txSignature)`.
 * The dispatcher looks up every active `issuer_webhooks` row subscribed to
 * this (series, eventType), enqueues an HMAC-SHA256 signed POST to each URL,
 * and retries on 4xx/5xx with exponential backoff.
 *
 * Signing scheme mirrors Stripe's:
 *   X-DinoSecurities-Signature: sha256=HMAC(timestamp.body, secret)
 *   X-DinoSecurities-Timestamp: <unix-seconds>
 * Consumers reject events with timestamps > 5 min old to block replay.
 */

const MAX_CONCURRENT = 8;
const PER_URL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

type Job = () => Promise<void>;

const queue: Job[] = [];
let inFlight = 0;

function pump() {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    inFlight++;
    job().finally(() => {
      inFlight--;
      pump();
    });
  }
}

function enqueue(job: Job) {
  queue.push(job);
  pump();
}

function sign(secret: string, timestamp: number, body: string): string {
  const mac = crypto.createHmac("sha256", secret);
  mac.update(`${timestamp}.${body}`);
  return `sha256=${mac.digest("hex")}`;
}

async function postWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_URL_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
      signal: ctrl.signal,
    });
    const text = await resp.text().catch(() => "");
    return { status: resp.status, body: text.slice(0, 2048) };
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(deliveryId: number, attemptNumber: number): Promise<void> {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!delivery || delivery.status !== "pending") return;

  const [hook] = await db
    .select()
    .from(issuerWebhooks)
    .where(eq(issuerWebhooks.id, delivery.webhookId))
    .limit(1);
  if (!hook || !hook.active) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", error: "webhook deactivated", completedAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(delivery.payload);
  const signature = sign(hook.secret, timestamp, body);

  try {
    const { status, body: respBody } = await postWithTimeout(
      hook.url,
      {
        "X-DinoSecurities-Signature": signature,
        "X-DinoSecurities-Timestamp": String(timestamp),
        "X-DinoSecurities-Event": delivery.eventType,
      },
      body,
    );

    if (status >= 200 && status < 300) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          responseStatus: status,
          responseBody: respBody,
          completedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      return;
    }

    throw new Error(`HTTP ${status}: ${respBody.slice(0, 200)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (attemptNumber >= MAX_ATTEMPTS) {
      await db
        .update(webhookDeliveries)
        .set({ status: "failed", error: message, completedAt: new Date() })
        .where(eq(webhookDeliveries.id, deliveryId));
      return;
    }
    await db
      .update(webhookDeliveries)
      .set({ attempt: attemptNumber, error: message })
      .where(eq(webhookDeliveries.id, deliveryId));
    const delay = RETRY_DELAYS_MS[attemptNumber - 1];
    setTimeout(() => enqueue(() => attempt(deliveryId, attemptNumber + 1)), delay);
  }
}

export async function dispatchEvent(
  seriesMint: string,
  eventType: string,
  payload: Record<string, unknown>,
  txSignature?: string,
): Promise<void> {
  const hooks = await db
    .select()
    .from(issuerWebhooks)
    .where(and(eq(issuerWebhooks.seriesMint, seriesMint), eq(issuerWebhooks.active, true)));

  const subscribed = hooks.filter((h) => h.eventsSubscribed.includes(eventType));
  if (subscribed.length === 0) return;

  for (const hook of subscribed) {
    const [row] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: hook.id,
        eventType,
        txSignature: txSignature ?? null,
        payload: { event: eventType, seriesMint, txSignature, data: payload },
        status: "pending",
      })
      .returning({ id: webhookDeliveries.id });
    if (row) enqueue(() => attempt(row.id, 1));
  }
}
