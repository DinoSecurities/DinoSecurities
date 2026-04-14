import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const rootPath = __dirname;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    global: "globalThis",
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(rootPath, "./src") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(rootPath, "./node_modules/react/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(rootPath, "./node_modules/react/jsx-dev-runtime.js") },
      { find: /^react-dom\/client$/, replacement: path.resolve(rootPath, "./node_modules/react-dom/client.js") },
      { find: /^react-dom$/, replacement: path.resolve(rootPath, "./node_modules/react-dom/index.js") },
      { find: /^react$/, replacement: path.resolve(rootPath, "./node_modules/react/index.js") },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@solana/web3.js",
      "@coral-xyz/anchor",
      "bn.js",
      "buffer",
    ],
  },
  build: {
    // The Solana + wallet-adapter + recharts stack is bulky. Split into
    // coarse-grained vendor chunks so the app shell stays < 500 kB and
    // heavy dependencies only load when their pages are visited. Anything
    // we don't name explicitly falls into the default app chunk.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@solana/") || id.includes("@coral-xyz/anchor")) return "solana";
            if (id.includes("@solana/wallet-adapter") || id.includes("@reown") || id.includes("@walletconnect")) return "wallet";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("react-router")) return "router";
          }
        },
      },
    },
  },
}));
