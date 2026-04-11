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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(rootPath, "./src"),
      react: path.resolve(rootPath, "./node_modules/react/index.js"),
      "react/jsx-runtime": path.resolve(rootPath, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(rootPath, "./node_modules/react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(rootPath, "./node_modules/react-dom/index.js"),
      "react-dom/client": path.resolve(rootPath, "./node_modules/react-dom/client.js"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
