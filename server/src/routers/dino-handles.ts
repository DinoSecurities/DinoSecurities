import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import {
  HANDLE_REGEX,
  claimHandle,
  getMyHandle,
  isHandleAvailable,
  releaseHandle,
  resolveHandle,
  resolveHandles,
} from "../services/dino-handles.js";

/**
 * Handle surface. Reads are public — anyone can ask "what handle does
 * wallet X use?" — writes are wallet-authed so only the owner of a
 * wallet can claim or release its handle.
 */
export const dinoHandlesRouter = router({
  available: publicProcedure
    .input(z.object({ handle: z.string().regex(HANDLE_REGEX) }))
    .query(async ({ input }) => ({
      available: await isHandleAvailable(input.handle),
    })),

  resolve: publicProcedure
    .input(z.object({ wallet: z.string() }))
    .query(async ({ input }) => {
      const record = await resolveHandle(input.wallet);
      if (!record) return null;
      return {
        ownerWallet: record.ownerWallet,
        handle: record.handle,
        displayHandle: record.displayHandle,
      };
    }),

  resolveMany: publicProcedure
    .input(z.object({ wallets: z.array(z.string()).max(200) }))
    .query(async ({ input }) => {
      const map = await resolveHandles(input.wallets);
      return Object.fromEntries(
        Object.entries(map).map(([wallet, record]) => [
          wallet,
          { displayHandle: record.displayHandle, handle: record.handle },
        ]),
      );
    }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const record = await getMyHandle(ctx.walletAddress!);
    if (!record) return null;
    return {
      id: record.id,
      ownerWallet: record.ownerWallet,
      handle: record.handle,
      displayHandle: record.displayHandle,
      minTierAtClaim: record.minTierAtClaim,
      balanceAtClaim: record.balanceAtClaim,
      createdAt: record.createdAt.toISOString(),
    };
  }),

  claim: protectedProcedure
    .input(z.object({ handle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const record = await claimHandle(ctx.walletAddress!, input.handle);
        return {
          id: record.id,
          handle: record.handle,
          displayHandle: record.displayHandle,
          minTierAtClaim: record.minTierAtClaim,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  release: protectedProcedure.mutation(async ({ ctx }) => {
    await releaseHandle(ctx.walletAddress!);
    return { ok: true };
  }),
});
