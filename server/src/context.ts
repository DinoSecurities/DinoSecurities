import type { Request } from "express";
import { db } from "./db/index.js";

export async function createContext({ req }: { req: Request }) {
  return {
    db,
    walletAddress: req.headers["x-wallet-address"] as string | undefined,
    walletSignature: req.headers["x-wallet-signature"] as string | undefined,
    walletTimestamp: req.headers["x-wallet-timestamp"] as string | undefined,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
