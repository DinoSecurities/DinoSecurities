import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { dinoTierFor, DINO_TIERS } from "../services/dino-balance.js";

/**
 * Public read surface for $DINO tier lookups. Any caller can ask what
 * tier a wallet currently holds — balances are public on-chain data,
 * no auth required. The platform's paid-fee flows consult this server-
 * side so a client can't spoof a tier.
 */
export const dinoRouter = router({
  tierFor: publicProcedure
    .input(z.object({ wallet: z.string().min(32).max(44) }))
    .query(async ({ input }) => {
      try {
        return await dinoTierFor(input.wallet);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          wallet: input.wallet,
          balance: 0,
          tier: DINO_TIERS[0],
          checkedAt: new Date().toISOString(),
          error: message,
        };
      }
    }),

  tierSchedule: publicProcedure.query(async () => {
    return DINO_TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      minBalance: t.minBalance,
      discountPct: t.discountPct,
    }));
  }),
});
