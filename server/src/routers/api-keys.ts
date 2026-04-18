import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import {
  createApiKey,
  listApiKeysFor,
  revokeApiKey,
} from "../services/api-keys.js";

/**
 * Wallet-authed key-management surface for the public REST API.
 * Every route is protectedProcedure — callers must prove ownership of
 * the wallet associated with the key via the standard wallet-auth
 * middleware. The plaintext key returned from `create` is the only
 * time the backend emits the full value; everything else exposes the
 * display prefix only.
 */
export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listApiKeysFor(ctx.walletAddress!);
    return rows.map((r) => ({
      id: r.id,
      keyPrefix: r.keyPrefix,
      label: r.label,
      active: r.active,
      createdAt: r.createdAt?.toISOString() ?? null,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        label: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createApiKey(ctx.walletAddress!, input.label ?? null);
      return {
        id: result.id,
        key: result.key, // returned exactly once
        keyPrefix: result.keyPrefix,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await revokeApiKey(input.id, ctx.walletAddress!);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
