import { z } from "zod";
import { avg, count, desc, eq, gte, isNotNull, sum, sql } from "drizzle-orm";
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

  /**
   * Last N successful settlements on mainnet, shaped for the click-to-verify
   * widgets on the landing page. Each item links directly to the Solana
   * Explorer tx so any claim we render on the marketing site is provable.
   */
  recentSettlements: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(25).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 5;
      const rows = await ctx.db
        .select({
          signature: settlementOrders.txSignature,
          settledAt: settlementOrders.settledAt,
          finalityMs: settlementOrders.finalityMs,
          feeLamports: settlementOrders.feeLamports,
          slot: settlementOrders.settlementSlot,
          usdcAmount: settlementOrders.usdcAmount,
          tokenAmount: settlementOrders.tokenAmount,
          mint: settlementOrders.securityMint,
        })
        .from(settlementOrders)
        .where(eq(settlementOrders.status, "settled"))
        .orderBy(desc(settlementOrders.settledAt))
        .limit(limit);

      // Headline aggregates rolled up over the returned window. Used by the
      // PlatformSection to render "avg over last N" context under each stat.
      const [agg] = await ctx.db
        .select({
          avgFinalityMs: avg(settlementOrders.finalityMs),
          avgFeeLamports: avg(settlementOrders.feeLamports),
          totalCount: count(),
        })
        .from(settlementOrders)
        .where(eq(settlementOrders.status, "settled"));

      const [withFinality] = await ctx.db
        .select({ count: count() })
        .from(settlementOrders)
        .where(isNotNull(settlementOrders.finalityMs));

      return {
        items: rows
          .filter((r) => r.signature)
          .map((r) => ({
            signature: r.signature as string,
            settledAt: r.settledAt?.toISOString() ?? null,
            finalityMs: r.finalityMs ?? null,
            feeSol: r.feeLamports != null ? r.feeLamports / 1e9 : null,
            slot: r.slot ?? null,
            usdc: r.usdcAmount / 1e6,
            tokens: r.tokenAmount,
            mint: r.mint,
          })),
        aggregates: {
          avgFinalityMs: agg?.avgFinalityMs ? Number(agg.avgFinalityMs) : null,
          avgFeeSol: agg?.avgFeeLamports ? Number(agg.avgFeeLamports) / 1e9 : null,
          totalSettlements: Number(agg?.totalCount ?? 0),
          samplesWithFinality: Number(withFinality?.count ?? 0),
        },
      };
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
