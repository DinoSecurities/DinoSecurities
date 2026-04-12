import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

// Governance data is primarily on-chain via SPL Governance (Realms).
// This router provides indexed/cached access for faster queries.
// Until webhooks populate the DB, these fall back to empty results.

export const governanceRouter = router({
  getProposals: publicProcedure
    .input(
      z.object({
        realm: z.string().optional(),
        status: z.enum(["active", "passed", "rejected", "pending", "executed"]).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      // TODO: Query from indexed governance data once webhooks populate it
      // For now, governance data is read directly on-chain by the frontend hooks
      return [];
    }),

  getVotes: publicProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ ctx, input }) => {
      // TODO: Index votes from SPL Governance via webhooks
      return [];
    }),

  realmStats: publicProcedure
    .input(z.object({ realm: z.string() }))
    .query(async ({ ctx, input }) => {
      // TODO: Aggregate from indexed data
      return {
        totalProposals: 0,
        activeProposals: 0,
        participationRate: 0,
      };
    }),
});
