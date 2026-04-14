import { z } from "zod";
import { eq, and, count } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { indexedHolders } from "../db/schema.js";
import { fetchHoldersForMint } from "../services/on-chain-holders.js";

export const holdersRouter = router({
  getForSeries: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const indexed = await ctx.db
        .select()
        .from(indexedHolders)
        .where(eq(indexedHolders.mintAddress, input.mint));
      if (indexed.length > 0) return indexed;
      // Fallback to direct on-chain scan when the indexer is empty (same
      // pattern as securities.list). Caps RPC calls via 2-min cache.
      try {
        return await fetchHoldersForMint(input.mint);
      } catch {
        return [];
      }
    }),

  getForWallet: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(indexedHolders)
      .where(eq(indexedHolders.wallet, ctx.walletAddress));
  }),

  stats: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [total] = await ctx.db
        .select({ count: count() })
        .from(indexedHolders)
        .where(
          and(
            eq(indexedHolders.mintAddress, input.mint),
            eq(indexedHolders.isRevoked, false),
          ),
        );

      const [accredited] = await ctx.db
        .select({ count: count() })
        .from(indexedHolders)
        .where(
          and(
            eq(indexedHolders.mintAddress, input.mint),
            eq(indexedHolders.isAccredited, true),
            eq(indexedHolders.isRevoked, false),
          ),
        );

      const [frozen] = await ctx.db
        .select({ count: count() })
        .from(indexedHolders)
        .where(
          and(
            eq(indexedHolders.mintAddress, input.mint),
            eq(indexedHolders.isFrozen, true),
          ),
        );

      return {
        totalHolders: total?.count ?? 0,
        accreditedHolders: accredited?.count ?? 0,
        frozenHolders: frozen?.count ?? 0,
      };
    }),
});
