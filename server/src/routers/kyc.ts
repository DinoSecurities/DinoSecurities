import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { kycSessions } from "../db/schema.js";

export const kycRouter = router({
  initSession: protectedProcedure.mutation(async ({ ctx }) => {
    // Create a KYC session record — the actual provider integration
    // (Jumio/Persona) will be wired up by the KYC oracle service
    const [session] = await ctx.db
      .insert(kycSessions)
      .values({
        wallet: ctx.walletAddress,
        status: "pending",
      })
      .returning();

    // TODO: Call KYC provider to create verification session
    // const provider = getKYCProvider();
    // const { sessionId, redirectUrl } = await provider.createSession(ctx.walletAddress);
    // Update session with providerSessionId

    return {
      sessionId: session.id,
      // redirectUrl will come from KYC provider
      redirectUrl: null as string | null,
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
