import { z } from "zod";
import { router, adminProcedure } from "../trpc.js";
import {
  reconcileAllSeries,
  reconcileSupply,
} from "../services/supply-reconciliation.js";

/**
 * Bigints in the reconciliation result don't survive JSON. The tRPC
 * transport would throw on any bigint in the return value, so we
 * serialize to strings on the wire and the client re-parses to bigint
 * (or to Number — safe up to 2^53-1, which every realistic issuance
 * is well under).
 */
function serialize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out;
}

export const adminRouter = router({
  supplyReconciliation: adminProcedure
    .input(z.object({ mint: z.string() }))
    .query(async ({ input }) => {
      const result = await reconcileSupply(input.mint);
      return serialize(result as unknown as Record<string, unknown>);
    }),

  supplyReconciliationAll: adminProcedure.query(async () => {
    const rows = await reconcileAllSeries();
    return rows.map((r) => serialize(r as unknown as Record<string, unknown>));
  }),
});
