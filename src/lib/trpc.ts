import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../server/src/routers/index.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/trpc";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      headers: () => {
        // Wallet auth headers will be injected here when needed
        // The signMessage flow stores these in sessionStorage
        const address = sessionStorage.getItem("wallet-address");
        const signature = sessionStorage.getItem("wallet-signature");
        const timestamp = sessionStorage.getItem("wallet-timestamp");

        if (address && signature && timestamp) {
          return {
            "x-wallet-address": address,
            "x-wallet-signature": signature,
            "x-wallet-timestamp": timestamp,
          };
        }

        return {};
      },
    }),
  ],
});
