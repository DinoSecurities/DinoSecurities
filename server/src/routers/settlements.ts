import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { settlementOrders } from "../db/schema.js";
import { env } from "../env.js";

export const settlementsRouter = router({
  createOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        securityMint: z.string(),
        tokenAmount: z.number().positive(),
        usdcAmount: z.number().positive(),
        side: z.enum(["buy", "sell"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const isBuy = input.side === "buy";

      const [order] = await ctx.db
        .insert(settlementOrders)
        .values({
          orderId: input.orderId,
          buyer: isBuy ? ctx.walletAddress : null,
          seller: isBuy ? null : ctx.walletAddress,
          securityMint: input.securityMint,
          tokenAmount: input.tokenAmount,
          usdcAmount: input.usdcAmount,
          status: "pending",
        })
        .returning();

      return order;
    }),

  getOrders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(settlementOrders)
      .where(
        or(
          eq(settlementOrders.buyer, ctx.walletAddress),
          eq(settlementOrders.seller, ctx.walletAddress),
        ),
      )
      .orderBy(desc(settlementOrders.createdAt));
  }),

  getOrderBook: protectedProcedure
    .input(z.object({ securityMint: z.string() }))
    .query(async ({ ctx, input }) => {
      const orders = await ctx.db
        .select()
        .from(settlementOrders)
        .where(eq(settlementOrders.securityMint, input.securityMint))
        .orderBy(desc(settlementOrders.createdAt));

      return {
        buys: orders.filter((o) => o.buyer && !o.seller),
        sells: orders.filter((o) => o.seller && !o.buyer),
        matched: orders.filter((o) => o.buyer && o.seller),
      };
    }),

  /**
   * Public activity feed for a given wallet — settled orders where the
   * wallet was the buyer or seller, each decorated with a downloadable
   * trade-confirmation PDF URL. Used by the Portfolio Activity tab.
   */
  getMySettlements: publicProcedure
    .input(z.object({ wallet: z.string().min(32).max(44), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(settlementOrders)
        .where(
          or(
            eq(settlementOrders.buyer, input.wallet),
            eq(settlementOrders.seller, input.wallet),
          ),
        )
        .orderBy(desc(settlementOrders.settledAt))
        .limit(input.limit);

      const base = env.PUBLIC_BASE_URL ?? "";
      return rows.map((r) => ({
        orderId: r.orderId,
        role: r.buyer === input.wallet ? ("buyer" as const) : ("seller" as const),
        mint: r.securityMint,
        tokenAmount: r.tokenAmount,
        usdcAmount: r.usdcAmount,
        status: r.status,
        txSignature: r.txSignature,
        settledAt: r.settledAt?.toISOString() ?? null,
        createdAt: r.createdAt?.toISOString() ?? null,
        finalityMs: r.finalityMs,
        receiptUrl:
          r.status === "settled" && r.txSignature
            ? `${base}/receipts/${r.txSignature}.pdf`
            : null,
      }));
    }),

  /**
   * Download URL for the trade-confirmation PDF of a settled tx. Returns
   * `{ available: false }` when the signature doesn't match any settled
   * order, so the frontend can show "Receipt unavailable" instead of a
   * broken link.
   */
  receiptUrl: publicProcedure
    .input(z.object({ signature: z.string().min(32) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ sig: settlementOrders.txSignature, status: settlementOrders.status })
        .from(settlementOrders)
        .where(eq(settlementOrders.txSignature, input.signature))
        .limit(1);
      if (!row || row.status !== "settled" || !row.sig) {
        return { available: false as const };
      }
      const base = env.PUBLIC_BASE_URL ?? "";
      return {
        available: true as const,
        url: `${base}/receipts/${row.sig}.pdf`,
      };
    }),

  cancelOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(settlementOrders)
        .where(eq(settlementOrders.orderId, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found");
      if (order.buyer !== ctx.walletAddress && order.seller !== ctx.walletAddress) {
        throw new Error("Not your order");
      }
      if (order.status !== "pending") {
        throw new Error("Order cannot be cancelled");
      }

      const [updated] = await ctx.db
        .update(settlementOrders)
        .set({ status: "cancelled" })
        .where(eq(settlementOrders.orderId, input.orderId))
        .returning();

      return updated;
    }),
});
