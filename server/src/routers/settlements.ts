import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { settlementOrders } from "../db/schema.js";

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
