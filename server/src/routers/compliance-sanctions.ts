import { z } from "zod";
import { desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { sanctionsOverrides, sanctionsEntries } from "../db/schema.js";
import { screenWallet } from "../services/sanctions.js";
import { sql, count } from "drizzle-orm";

/**
 * Public-read slice of the sanctions screening surface. Used by the
 * Issuer Portal's "Screening" card and by the public compliance
 * simulator to display an extra line (if a wallet is on a sanctions
 * list, flag it alongside the on-chain hook checks).
 *
 * Write operations (refresh, override, revoke) live on the Express
 * admin endpoints at /admin/sanctions/* and require the shared admin
 * secret — they're not exposed over tRPC.
 */
export const sanctionsRouter = router({
  screen: publicProcedure
    .input(z.object({ wallet: z.string().min(32).max(44) }))
    .query(async ({ input }) => {
      const result = await screenWallet(input.wallet);
      // Narrow the payload — raw OFAC XML blobs are big and noisy;
      // callers want names + sources, not the full fixture.
      return {
        clean: result.clean,
        overrideActive: result.overrideActive,
        overrideId: result.overrideId,
        hits: result.hits.map((h) => ({
          source: h.source,
          displayName: h.displayName,
          identifier: h.identifier,
          listedOn: h.listedOn,
        })),
      };
    }),

  listOverrides: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const rows = await ctx.db
        .select()
        .from(sanctionsOverrides)
        .orderBy(desc(sanctionsOverrides.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        wallet: r.wallet,
        seriesMint: r.seriesMint,
        matchedSources: r.matchedSources,
        justification: r.justification,
        adminWallet: r.adminWallet,
        status: r.status,
        createdAt: r.createdAt?.toISOString() ?? null,
      }));
    }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const perSource = await ctx.db
      .select({
        source: sanctionsEntries.source,
        count: count(),
      })
      .from(sanctionsEntries)
      .groupBy(sanctionsEntries.source);
    const [overrideCount] = await ctx.db
      .select({ count: count() })
      .from(sanctionsOverrides)
      .where(sql`status = 'active'`);
    return {
      entriesBySource: perSource.map((r) => ({ source: r.source, count: Number(r.count) })),
      activeOverrides: Number(overrideCount?.count ?? 0),
    };
  }),
});
