import { z } from "zod";
import { eq, ilike, or, desc, asc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { indexedSeries } from "../db/schema.js";

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

      return result ?? null;
    }),

  getByIssuer: publicProcedure
    .input(z.object({ issuer: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.issuer, input.issuer))
        .orderBy(desc(indexedSeries.createdAt));
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
