import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, publicProcedure } from "../trpc.js";
import {
  trustedXrplCredentialIssuers,
  xrplCredentialVerifications,
} from "../db/schema.js";
import { verifyXrplCredential } from "../services/xrpl-credentials.js";

const networkEnum = z.enum(["mainnet", "testnet", "devnet"]);
const xrplAddress = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, {
  message: "Not a valid XRPL classic address (must start with 'r')",
});

/**
 * Admin surface for managing the XRPL Credentials trust layer:
 *   - CRUD the trusted-issuer allow-list
 *   - Run an ad-hoc verification against any (xrplAddress, network)
 *   - Read the append-only verification audit log
 *
 * Public reads are intentionally limited to the active issuer list and
 * audit-log count — the raw credential data stays admin-scoped to keep
 * subjects' external identifiers out of the public surface.
 */
export const xrplCredentialsRouter = router({
  listTrustedIssuers: publicProcedure
    .input(z.object({ network: networkEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(trustedXrplCredentialIssuers)
        .where(eq(trustedXrplCredentialIssuers.active, true))
        .orderBy(desc(trustedXrplCredentialIssuers.createdAt));
      const filtered = input?.network
        ? rows.filter((r) => r.network === input.network)
        : rows;
      return filtered.map((r) => ({
        id: r.id,
        xrplAddress: r.xrplAddress,
        displayName: r.displayName,
        credentialTypes: r.credentialTypes,
        network: r.network,
      }));
    }),

  addTrustedIssuer: adminProcedure
    .input(
      z.object({
        xrplAddress,
        displayName: z.string().min(1).max(120),
        credentialTypes: z.array(z.string()).default([]),
        network: networkEnum.default("mainnet"),
        notes: z.string().max(1024).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [row] = await ctx.db
          .insert(trustedXrplCredentialIssuers)
          .values({
            xrplAddress: input.xrplAddress,
            displayName: input.displayName,
            credentialTypes: input.credentialTypes,
            network: input.network,
            notes: input.notes ?? null,
            addedBy: ctx.walletAddress!,
            active: true,
          })
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return { id: row.id };
      } catch (err) {
        if (err instanceof Error && err.message.includes("idx_trusted_xrpl_issuer_pk")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This XRPL address is already trusted on this network.",
          });
        }
        throw err;
      }
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(trustedXrplCredentialIssuers)
        .set({ active: input.active })
        .where(eq(trustedXrplCredentialIssuers.id, input.id));
      return { ok: true };
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(trustedXrplCredentialIssuers)
        .where(eq(trustedXrplCredentialIssuers.id, input.id));
      return { ok: true };
    }),

  verify: adminProcedure
    .input(
      z.object({
        xrplAddress,
        network: networkEnum.default("mainnet"),
        requiredType: z.string().optional(),
        solanaWallet: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await verifyXrplCredential({
        xrplAddress: input.xrplAddress,
        network: input.network,
        requiredType: input.requiredType,
        solanaWallet: input.solanaWallet,
        checkedBy: ctx.walletAddress,
      });
      return {
        clean: result.clean,
        reason: result.reason ?? null,
        credential: result.credential ?? null,
        trustedIssuerId: result.trustedIssuerId ?? null,
      };
    }),

  recentVerifications: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const rows = await ctx.db
        .select()
        .from(xrplCredentialVerifications)
        .orderBy(desc(xrplCredentialVerifications.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        solanaWallet: r.solanaWallet,
        xrplAddress: r.xrplAddress,
        xrplIssuer: r.xrplIssuer,
        credentialType: r.credentialType,
        network: r.network,
        clean: r.clean,
        reason: r.reason,
        createdAt: r.createdAt?.toISOString() ?? null,
      }));
    }),
});
