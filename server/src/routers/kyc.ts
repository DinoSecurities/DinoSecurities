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

      // Auto-expire pending sessions that haven't been resolved within an
      // hour. Didit sessions have their own TTL; if no webhook has landed
      // by then, the user either abandoned the flow or the webhook is
      // misconfigured. Surfacing "expired" lets the UI show a retry button.
      let effectiveStatus = latest.status;
      if (latest.status === "pending") {
        const createdAt = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        if (Date.now() - createdAt > 60 * 60 * 1000) {
          effectiveStatus = "expired";
          await ctx.db
            .update(kycSessions)
            .set({ status: "expired" })
            .where(eq(kycSessions.id, latest.id));
        }
      }

      return {
        status: effectiveStatus as "pending" | "verified" | "expired" | "revoked" | "none",
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
