import { z } from "zod";
import { eq, ilike, or, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { indexedSeries } from "../db/schema.js";
import { fetchSeriesOnChain, fetchSeriesByMint } from "../services/on-chain-fetcher.js";

export const securitiesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        type: z.enum(["Equity", "Debt", "Fund", "LLC"]).optional(),
        jurisdiction: z.string().optional(),
        status: z.enum(["active", "paused", "pending"]).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const { page = 1, limit = 20, type, jurisdiction, status } = input ?? {};
      const offset = (page - 1) * limit;

      let query = ctx.db.select().from(indexedSeries).$dynamic();
      if (type) query = query.where(eq(indexedSeries.securityType, type));
      if (jurisdiction) query = query.where(eq(indexedSeries.jurisdiction, jurisdiction));
      if (status) query = query.where(eq(indexedSeries.status, status));

      const results = await query
        .orderBy(desc(indexedSeries.createdAt))
        .limit(limit)
        .offset(offset);

      // Fall back to a direct getProgramAccounts read when nothing is
      // indexed yet — keeps the marketplace honest in the gap between an
      // issuer creating a series and the Helius webhook firing.
      if (results.length === 0 && page === 1) {
        try {
          const onChain = await fetchSeriesOnChain();
          return { items: onChain.slice(0, limit), page, limit };
        } catch (err) {
          console.warn("on-chain fallback failed:", err);
        }
      }
      return { items: results, page, limit };
    }),

  getByMint: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.mintAddress, input.mint))
        .limit(1);
      if (result) return result;
      try {
        return await fetchSeriesByMint(input.mint);
      } catch {
        return null;
      }
    }),

  /**
   * Resolve a security by its human ticker symbol — case-insensitive.
   * Used by the embeddable issuer widget at /embed/:symbol so issuers
   * can paste <iframe src="…/embed/DINOMT"> on their own sites without
   * needing to look up a mint address.
   */
  getBySymbol: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(16) }))
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.symbol, input.symbol.toUpperCase()))
        .limit(1);
      return result ?? null;
    }),

  getByIssuer: publicProcedure
    .input(z.object({ issuer: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.issuer, input.issuer))
        .orderBy(desc(indexedSeries.createdAt));
      if (rows.length > 0) return rows;
      try {
        const onChain = await fetchSeriesOnChain();
        return onChain.filter((s) => s.issuer === input.issuer);
      } catch {
        return [];
      }
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const pattern = `%${input.query}%`;
      return ctx.db
        .select()
        .from(indexedSeries)
        .where(
          or(
            ilike(indexedSeries.name, pattern),
            ilike(indexedSeries.symbol, pattern),
            ilike(indexedSeries.isin, pattern),
          ),
        )
        .limit(50);
    }),
});
