import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { govRealms, govProposals, govVotes } from "../db/schema.js";
import { fetchRealmOnChain, fetchProposalsOnChain } from "../services/governance-fetcher.js";

export const governanceRouter = router({
  getRealm: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(govRealms)
        .where(eq(govRealms.securityMint, input.mint))
        .limit(1);
      if (row) return row;
      try {
        return await fetchRealmOnChain(input.mint);
      } catch {
        return null;
      }
    }),

  listProposals: publicProcedure
    .input(
      z.object({
        mint: z.string(),
        status: z.enum(["voting", "succeeded", "defeated", "executed", "cancelled"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(govProposals.securityMint, input.mint)];
      if (input.status) filters.push(eq(govProposals.status, input.status));
      const rows = await ctx.db
        .select()
        .from(govProposals)
        .where(and(...filters))
        .orderBy(desc(govProposals.createdAt));
      if (rows.length > 0) return rows;
      try {
        return await fetchProposalsOnChain(input.mint);
      } catch {
        return [];
      }
    }),

  getProposal: publicProcedure
    .input(z.object({ pda: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(govProposals)
        .where(eq(govProposals.proposalPda, input.pda))
        .limit(1);
      return row ?? null;
    }),

  getVotesForProposal: publicProcedure
    .input(z.object({ pda: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(govVotes)
        .where(eq(govVotes.proposalPda, input.pda))
        .orderBy(desc(govVotes.castAt));
      return rows;
    }),

  realmStats: publicProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ ctx, input }) => {
      const proposals = await ctx.db
        .select()
        .from(govProposals)
        .where(eq(govProposals.securityMint, input.mint));
      return {
        totalProposals: proposals.length,
        voting: proposals.filter((p) => p.status === "voting").length,
        succeeded: proposals.filter((p) => p.status === "succeeded").length,
        executed: proposals.filter((p) => p.status === "executed").length,
        defeated: proposals.filter((p) => p.status === "defeated").length,
      };
    }),
});
