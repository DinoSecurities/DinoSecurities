import { z } from "zod";
import { count, sum, eq, gte, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { indexedSeries, indexedHolders, settlementOrders } from "../db/schema.js";

export const analyticsRouter = router({
  platformStats: publicProcedure.query(async ({ ctx }) => {
    const [seriesCount] = await ctx.db
      .select({ count: count() })
      .from(indexedSeries);

    const [holderCount] = await ctx.db
      .select({ count: count() })
      .from(indexedHolders)
      .where(eq(indexedHolders.isRevoked, false));

    const [settlementVolume] = await ctx.db
      .select({ total: sum(settlementOrders.usdcAmount) })
      .from(settlementOrders)
      .where(eq(settlementOrders.status, "settled"));

    return {
      totalSecurities: seriesCount?.count ?? 0,
      totalHolders: holderCount?.count ?? 0,
      settlementVolume: Number(settlementVolume?.total ?? 0),
    };
  }),

  seriesStats: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [holders] = await ctx.db
        .select({ count: count() })
        .from(indexedHolders)
        .where(eq(indexedHolders.mintAddress, input.mint));

      const [volume] = await ctx.db
        .select({ total: sum(settlementOrders.usdcAmount) })
        .from(settlementOrders)
        .where(eq(settlementOrders.securityMint, input.mint));

      const [series] = await ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.mintAddress, input.mint))
        .limit(1);

      return {
        holderCount: holders?.count ?? 0,
        volume: Number(volume?.total ?? 0),
        supplyUtilization: series
          ? (series.currentSupply / series.maxSupply) * 100
          : 0,
      };
    }),

  volumeHistory: publicProcedure
    .input(
      z.object({
        range: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[input.range];
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const results = await ctx.db
        .select({
          date: sql<string>`DATE(${settlementOrders.createdAt})`,
          volume: sum(settlementOrders.usdcAmount),
          count: count(),
        })
        .from(settlementOrders)
        .where(gte(settlementOrders.createdAt, since))
        .groupBy(sql`DATE(${settlementOrders.createdAt})`)
        .orderBy(sql`DATE(${settlementOrders.createdAt})`);

      return results.map((r) => ({
        date: r.date,
        volume: Number(r.volume ?? 0),
        count: r.count,
      }));
    }),

  portfolioHistory: protectedProcedure.query(async ({ ctx }) => {
    // Historical portfolio value based on settlement activity
    const settlements = await ctx.db
      .select()
      .from(settlementOrders)
      .where(eq(settlementOrders.buyer, ctx.walletAddress))
      .orderBy(settlementOrders.createdAt);

    // Build cumulative value over time
    let cumulative = 0;
    return settlements.map((s) => {
      cumulative += s.usdcAmount;
      return {
        date: s.createdAt?.toISOString() ?? "",
        value: cumulative,
      };
    });
  }),
});
