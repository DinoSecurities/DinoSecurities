import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import {
  PROPOSAL_TYPES,
  VOTE_CHOICES,
  castVote,
  closeExpired,
  createProposal,
  getProposal,
  listProposals,
} from "../services/community-governance.js";

/**
 * Community-governance tRPC surface. Reads are public (vote tallies
 * are public data by design); writes require wallet-auth so the
 * creator / voter is the wallet making the call.
 *
 * This router MUST NOT grow an `execute` procedure. Outcomes are
 * advisory — acted on manually off-platform by the DinoSecurities
 * team. Adding an execute path would turn advisory polls into a
 * governance authority over something, and the legal analysis that
 * lets us ship this feature at all depends on that being impossible.
 */
export const communityRouter = router({
  proposalTypes: publicProcedure.query(() => PROPOSAL_TYPES),

  list: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      await closeExpired();
      return listProposals(input?.limit ?? 50);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number(), viewerWallet: z.string().optional() }))
    .query(async ({ input }) => {
      await closeExpired();
      const proposal = await getProposal(input.id, input.viewerWallet);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND" });
      return proposal;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(8).max(120),
        description: z.string().min(40).max(10_000),
        proposalType: z.enum(PROPOSAL_TYPES),
        votingDurationSec: z.number().int().min(24 * 3600).max(14 * 24 * 3600),
        disclosureAck: z.boolean().refine((v) => v === true, {
          message: "must acknowledge this is a non-binding advisory poll",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createProposal({
          creator: ctx.walletAddress!,
          ...input,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  castVote: protectedProcedure
    .input(
      z.object({
        proposalId: z.number(),
        choice: z.enum(VOTE_CHOICES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await castVote({
          proposalId: input.proposalId,
          voter: ctx.walletAddress!,
          choice: input.choice,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
