import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, publicProcedure, protectedProcedure } from "../trpc.js";
import {
  trustedXrplCredentialIssuers,
  walletXrplBindings,
  xrplBindingChallenges,
  xrplCredentialVerifications,
  xrplWhitelistRequests,
} from "../db/schema.js";
import { verifyXrplCredential } from "../services/xrpl-credentials.js";
import {
  completeBinding,
  issueChallenge,
} from "../services/xrpl-bindings.js";

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
        // Admin ad-hoc verification bypasses the binding check so an
        // auditor can probe any subject address. The register_holder
        // path does NOT pass this flag.
        skipBindingCheck: true,
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

  // -- P2 binding + holder-driven request surface ----------------------------

  issueChallenge: protectedProcedure
    .input(
      z.object({
        xrplAddress,
        network: networkEnum.default("mainnet"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await issueChallenge(
        ctx.walletAddress!,
        input.xrplAddress,
        input.network,
      );
      return {
        challengeId: result.id,
        nonce: result.nonce,
        message: result.message,
        expiresAt: result.expiresAt.toISOString(),
      };
    }),

  completeBinding: protectedProcedure
    .input(
      z.object({
        challengeId: z.number(),
        signatureHex: z.string().regex(/^[0-9a-fA-F]+$/),
        publicKeyHex: z.string().regex(/^[0-9a-fA-F]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch challenge to make sure the caller owns it. Binding endpoints
      // leak less if we check ownership here rather than trusting the
      // challenge-row join on solanaWallet alone.
      const [challenge] = await ctx.db
        .select()
        .from(xrplBindingChallenges)
        .where(eq(xrplBindingChallenges.id, input.challengeId))
        .limit(1);
      if (!challenge || challenge.solanaWallet !== ctx.walletAddress) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      try {
        const result = await completeBinding({
          challengeId: input.challengeId,
          signatureHex: input.signatureHex,
          publicKeyHex: input.publicKeyHex,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  myBindings: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(walletXrplBindings)
      .where(eq(walletXrplBindings.solanaWallet, ctx.walletAddress!))
      .orderBy(desc(walletXrplBindings.provedAt));
    return rows.map((r) => ({
      id: r.id,
      xrplAddress: r.xrplAddress,
      keyType: r.keyType,
      network: r.network,
      provedAt: r.provedAt?.toISOString() ?? null,
    }));
  }),

  submitWhitelistRequest: protectedProcedure
    .input(
      z.object({
        seriesMint: z.string(),
        xrplAddress,
        network: networkEnum.default("mainnet"),
        requiredType: z.string().optional(),
        jurisdiction: z.string().length(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const verification = await verifyXrplCredential({
        solanaWallet: ctx.walletAddress!,
        xrplAddress: input.xrplAddress,
        network: input.network,
        requiredType: input.requiredType,
        checkedBy: ctx.walletAddress,
        // Holder-driven flow: binding is required.
      });
      if (!verification.clean) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: verification.reason ?? "credential verification failed",
        });
      }
      const [verifRow] = await ctx.db
        .select({ id: xrplCredentialVerifications.id })
        .from(xrplCredentialVerifications)
        .where(eq(xrplCredentialVerifications.xrplAddress, input.xrplAddress))
        .orderBy(desc(xrplCredentialVerifications.createdAt))
        .limit(1);
      const [row] = await ctx.db
        .insert(xrplWhitelistRequests)
        .values({
          seriesMint: input.seriesMint,
          solanaWallet: ctx.walletAddress!,
          xrplAddress: input.xrplAddress,
          network: input.network,
          verificationId: verifRow?.id ?? null,
          requestedJurisdiction: input.jurisdiction ?? null,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [xrplWhitelistRequests.seriesMint, xrplWhitelistRequests.solanaWallet],
          set: {
            xrplAddress: input.xrplAddress,
            network: input.network,
            verificationId: verifRow?.id ?? null,
            requestedJurisdiction: input.jurisdiction ?? null,
            status: "pending",
            rejectionReason: null,
          },
        })
        .returning({ id: xrplWhitelistRequests.id });
      return { id: row?.id ?? null };
    }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(xrplWhitelistRequests)
      .where(eq(xrplWhitelistRequests.solanaWallet, ctx.walletAddress!))
      .orderBy(desc(xrplWhitelistRequests.createdAt));
    return rows.map((r) => ({
      id: r.id,
      seriesMint: r.seriesMint,
      xrplAddress: r.xrplAddress,
      network: r.network,
      status: r.status,
      resolvedTx: r.resolvedTx,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt?.toISOString() ?? null,
    }));
  }),

  pendingRequestsForSeries: protectedProcedure
    .input(z.object({ seriesMint: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(xrplWhitelistRequests)
        .where(
          and(
            eq(xrplWhitelistRequests.seriesMint, input.seriesMint),
            eq(xrplWhitelistRequests.status, "pending"),
          ),
        )
        .orderBy(desc(xrplWhitelistRequests.createdAt));
      return rows.map((r) => ({
        id: r.id,
        solanaWallet: r.solanaWallet,
        xrplAddress: r.xrplAddress,
        network: r.network,
        requestedJurisdiction: r.requestedJurisdiction,
        createdAt: r.createdAt?.toISOString() ?? null,
      }));
    }),

  rejectRequest: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(xrplWhitelistRequests)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
          resolvedAt: new Date(),
          resolvedBy: ctx.walletAddress!,
        })
        .where(eq(xrplWhitelistRequests.id, input.id));
      return { ok: true };
    }),
});
