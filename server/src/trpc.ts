import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.js";
import { verifyWalletSignature } from "./middleware/wallet-auth.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const walletAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const { walletAddress, walletSignature, walletTimestamp } = ctx;

  if (!walletAddress || !walletSignature || !walletTimestamp) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Wallet authentication required. Send x-wallet-address, x-wallet-signature, and x-wallet-timestamp headers.",
    });
  }

  const valid = verifyWalletSignature(walletAddress, walletSignature, walletTimestamp);
  if (!valid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid wallet signature.",
    });
  }

  return next({
    ctx: { ...ctx, walletAddress },
  });
});

export const protectedProcedure = t.procedure.use(walletAuthMiddleware);

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "").split(",").filter(Boolean);

const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.walletAddress || !ADMIN_WALLETS.includes(ctx.walletAddress)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }
  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(adminMiddleware);
