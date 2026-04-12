import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { documentVersions } from "../db/schema.js";
import crypto from "node:crypto";

export const documentsRouter = router({
  upload: protectedProcedure
    .input(
      z.object({
        seriesMint: z.string(),
        arweaveUri: z.string(),
        docHash: z.string(),
        version: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(documentVersions)
        .values({
          seriesMint: input.seriesMint,
          version: input.version,
          arweaveUri: input.arweaveUri,
          docHash: input.docHash,
          uploadedBy: ctx.walletAddress,
        })
        .returning();

      return doc;
    }),

  verify: publicProcedure
    .input(
      z.object({
        uri: z.string(),
        expectedHash: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const response = await fetch(input.uri);
        if (!response.ok) {
          return { valid: false, error: "Failed to fetch document" };
        }

        const buffer = await response.arrayBuffer();
        const hash = crypto
          .createHash("sha256")
          .update(Buffer.from(buffer))
          .digest("hex");

        return {
          valid: hash === input.expectedHash,
          computedHash: hash,
          expectedHash: input.expectedHash,
        };
      } catch {
        return { valid: false, error: "Verification failed" };
      }
    }),

  getHistory: publicProcedure
    .input(z.object({ seriesMint: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.seriesMint, input.seriesMint))
        .orderBy(desc(documentVersions.version));
    }),
});
