import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
}));
