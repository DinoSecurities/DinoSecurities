import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import {
  getBrandingFor,
  updateBranding,
} from "../services/issuer-branding.js";
import {
  getSchedule,
  setSchedule,
  clearSchedule,
  previewingMints,
} from "../services/series-preview.js";
import { dinoTierFor } from "../services/dino-balance.js";

/**
 * Unified tier-gated issuer-access surface. Branding (embed + portal
 * theme) and preview-listing scheduling live together because both
 * are issuer-facing, both are tier-gated, and consumers tend to use
 * them in the same flow.
 */
export const issuerAccessRouter = router({
  branding: publicProcedure
    .input(z.object({ issuerWallet: z.string() }))
    .query(async ({ input }) => {
      const row = await getBrandingFor(input.issuerWallet);
      if (!row) return null;
      return {
        accentColor: row.accentColor,
        logoUri: row.logoUri,
        hideEmbedFooter: row.hideEmbedFooter,
        tierAtWrite: row.tierAtWrite,
        updatedAt: row.updatedAt?.toISOString() ?? null,
      };
    }),

  myBranding: protectedProcedure.query(async ({ ctx }) => {
    const row = await getBrandingFor(ctx.walletAddress!);
    if (!row) return null;
    return {
      accentColor: row.accentColor,
      logoUri: row.logoUri,
      hideEmbedFooter: row.hideEmbedFooter,
      tierAtWrite: row.tierAtWrite,
    };
  }),

  updateBranding: protectedProcedure
    .input(
      z.object({
        accentColor: z.string().nullable().optional(),
        logoUri: z.string().nullable().optional(),
        hideEmbedFooter: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await updateBranding(ctx.walletAddress!, input);
        return {
          accentColor: result.accentColor,
          logoUri: result.logoUri,
          hideEmbedFooter: result.hideEmbedFooter,
          tierAtWrite: result.tierAtWrite,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  previewSchedule: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ input }) => {
      const scheduled = await getSchedule(input.mint);
      if (!scheduled) return null;
      return { publicListingAt: scheduled.toISOString() };
    }),

  // Public: list every mint currently in its preview window. Callers
  // use this to filter the marketplace client-side — non-Gold holders
  // see the mints hidden from their view, the result powers a single
  // set-based "is this mint in preview right now?" check across the
  // whole marketplace render.
  currentlyPreviewing: publicProcedure.query(async () => {
    const rows = await previewingMints();
    return rows.map((r) => ({
      mint: r.mint,
      publicListingAt: r.publicListingAt.toISOString(),
    }));
  }),

  upcomingListings: protectedProcedure.query(async ({ ctx }) => {
    // Gold-only visibility. A non-Gold wallet hitting this gets an
    // empty list rather than a forbidden error — the feature is
    // explicitly a Gold perk, not a secret.
    const { tier } = await dinoTierFor(ctx.walletAddress!);
    if (tier.id < 3) return [];
    const rows = await previewingMints();
    return rows.map((r) => ({
      mint: r.mint,
      publicListingAt: r.publicListingAt.toISOString(),
    }));
  }),

  schedulePreview: protectedProcedure
    .input(
      z.object({
        mint: z.string(),
        publicListingAt: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Any tier can schedule — the gate here is being the issuer, not
      // being a $DINO holder. Scheduling defers your own listing; it
      // costs nothing to anyone else.
      const when = new Date(input.publicListingAt);
      if (isNaN(when.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid date" });
      }
      await setSchedule(input.mint, when, ctx.walletAddress!);
      return { ok: true };
    }),

  clearPreview: protectedProcedure
    .input(z.object({ mint: z.string() }))
    .mutation(async ({ input }) => {
      await clearSchedule(input.mint);
      return { ok: true };
    }),
});
