import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { kycSessions } from "../db/schema.js";
import { getKYCProvider } from "../services/kyc-oracle.js";

export const kycRouter = router({
  initSession: publicProcedure
    .input(z.object({ wallet: z.string().min(32).max(44) }))
    .mutation(async ({ ctx, input }) => {
      const provider = getKYCProvider();
      const { sessionId: providerSessionId, redirectUrl } = await provider.createSession(
        input.wallet,
      );

      const [session] = await ctx.db
        .insert(kycSessions)
        .values({
          wallet: input.wallet,
          status: "pending",
          providerSessionId,
        })
        .returning();

      return {
        sessionId: session.id,
        providerSessionId,
        redirectUrl,
      };
    }),

  getStatusForWallet: publicProcedure
    .input(z.object({ wallet: z.string().min(32).max(44) }))
    .query(async ({ ctx, input }) => {
      const [latest] = await ctx.db
        .select()
        .from(kycSessions)
        .where(eq(kycSessions.wallet, input.wallet))
        .orderBy(desc(kycSessions.createdAt))
        .limit(1);
      if (!latest) return { status: "none" as const, session: null };
      return {
        status: latest.status as "pending" | "verified" | "expired" | "revoked" | "none",
        session: latest,
      };
    }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [latest] = await ctx.db
      .select()
      .from(kycSessions)
      .where(eq(kycSessions.wallet, ctx.walletAddress))
      .orderBy(desc(kycSessions.createdAt))
      .limit(1);

    if (!latest) {
      return { status: "none" as const, session: null };
    }

    return {
      status: latest.status as "pending" | "verified" | "expired" | "revoked" | "none",
      session: latest,
    };
  }),
});
