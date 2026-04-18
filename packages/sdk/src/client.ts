import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { DEFAULT_API_BASE } from "./constants.js";

export interface CreateDinoClientOptions {
  /** Override the default production base URL. */
  apiBase?: string;
  /** Pass a wallet-auth bundle if you need protected routes. */
  auth?: {
    walletAddress: string;
    walletSignature: string;
    walletTimestamp: string;
  };
  /** Custom fetch implementation (for proxies, retries, logging). */
  fetch?: typeof fetch;
}

/**
 * Typed tRPC client factory. For full type inference, parameterize with
 * the upstream AppRouter type exposed by the DinoSecurities backend:
 *
 *   import type { AppRouter } from "@dinosecurities/api-types";
 *   const dino = createDinoClient<AppRouter>();
 *   await dino.securities.list();   //  ← autocompleted, fully typed
 *
 * Without the AppRouter type parameter, the client still works at
 * runtime; you just lose compile-time inference. Future SDK versions
 * will bundle the AppRouter type directly so the parameter becomes
 * optional.
 */
export function createDinoClient<TRouter = any>(opts: CreateDinoClientOptions = {}) {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const url = `${apiBase.replace(/\/$/, "")}/trpc`;

  return createTRPCClient<TRouter>({
    links: [
      httpBatchLink({
        url,
        fetch: opts.fetch ?? fetch,
        headers: () => {
          if (!opts.auth) return {};
          return {
            "x-wallet-address": opts.auth.walletAddress,
            "x-wallet-signature": opts.auth.walletSignature,
            "x-wallet-timestamp": opts.auth.walletTimestamp,
          };
        },
      }),
    ],
  });
}
