import { defineConfig } from "tsup";

/**
 * Dual-format build. tsup generates ESM + CJS + d.ts for each entry, so
 * consumers on either runtime get a first-class experience. The subpath
 * exports (./idl, ./pdas, ./compliance) keep bundle size lean for
 * consumers who only need one slice of the SDK.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    idl: "src/idl.ts",
    pdas: "src/pdas.ts",
    compliance: "src/compliance.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
  target: "node18",
  external: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
    "@trpc/client",
  ],
});
