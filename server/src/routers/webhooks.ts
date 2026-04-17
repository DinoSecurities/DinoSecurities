import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { issuerWebhooks, webhookDeliveries } from "../db/schema.js";

const SUPPORTED_EVENTS = [
  "HolderRegistered",
  "HolderRevoked",
  "SettlementExecuted",
  "Transfer",
] as const;

function newSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

function maskSecret(secret: string): string {
  if (secret.length <= 12) return `${secret.slice(0, 4)}…`;
  return `${secret.slice(0, 10)}…${secret.slice(-4)}`;
}

/**
 * Issuer-facing webhook management. All routes require wallet auth; writes
 * additionally verify the caller owns the subscription (by issuerWallet
 * match). The secret is returned unmasked exactly once — on create and on
 * rotate — and masked in list responses so a leaked session can't exfiltrate
 * the HMAC key.
 */
export const webhooksRouter = router({
  list: protectedProcedure
    .input(z.object({ seriesMint: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(issuerWebhooks)
        .where(
          and(
            eq(issuerWebhooks.seriesMint, input.seriesMint),
            eq(issuerWebhooks.issuerWallet, ctx.walletAddress),
          ),
        )
        .orderBy(desc(issuerWebhooks.createdAt));
      return rows.map((r) => ({
        id: r.id,
        seriesMint: r.seriesMint,
        url: r.url,
        secretMasked: maskSecret(r.secret),
        eventsSubscribed: r.eventsSubscribed,
        active: r.active,
        createdAt: r.createdAt?.toISOString() ?? null,
        lastRotatedAt: r.lastRotatedAt?.toISOString() ?? null,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        seriesMint: z.string(),
        url: z.string().url().refine((u) => u.startsWith("https://"), {
          message: "Webhook URL must be https",
        }),
        events: z.array(z.enum(SUPPORTED_EVENTS)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const secret = newSecret();
      const [row] = await ctx.db
        .insert(issuerWebhooks)
        .values({
          seriesMint: input.seriesMint,
          issuerWallet: ctx.walletAddress,
          url: input.url,
          secret,
          eventsSubscribed: input.events,
          active: true,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id, secret };
    }),

  rotateSecret: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(issuerWebhooks)
        .where(eq(issuerWebhooks.id, input.id))
        .limit(1);
      if (!existing || existing.issuerWallet !== ctx.walletAddress) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const secret = newSecret();
      await ctx.db
        .update(issuerWebhooks)
        .set({ secret, lastRotatedAt: new Date() })
        .where(eq(issuerWebhooks.id, input.id));
      return { secret };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(issuerWebhooks)
        .where(eq(issuerWebhooks.id, input.id))
        .limit(1);
      if (!existing || existing.issuerWallet !== ctx.walletAddress) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db
        .update(issuerWebhooks)
        .set({ active: input.active })
        .where(eq(issuerWebhooks.id, input.id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(issuerWebhooks)
        .where(eq(issuerWebhooks.id, input.id))
        .limit(1);
      if (!existing || existing.issuerWallet !== ctx.walletAddress) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db.delete(issuerWebhooks).where(eq(issuerWebhooks.id, input.id));
      return { ok: true };
    }),

  recentDeliveries: protectedProcedure
    .input(z.object({ webhookId: z.number(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const [hook] = await ctx.db
        .select()
        .from(issuerWebhooks)
        .where(eq(issuerWebhooks.id, input.webhookId))
        .limit(1);
      if (!hook || hook.issuerWallet !== ctx.walletAddress) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const rows = await ctx.db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.limit);
      return rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        txSignature: r.txSignature,
        status: r.status,
        attempt: r.attempt,
        responseStatus: r.responseStatus,
        error: r.error,
        createdAt: r.createdAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
      }));
    }),
});
