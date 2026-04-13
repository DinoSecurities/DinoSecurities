/**
 * Reset the platform's KYC oracle to the deployer wallet.
 *
 * Useful after running tests that temporarily rotated the oracle. Run with:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/dinosecurities-deployer.json \
 *   npx ts-node --transpile-only --compiler-options \
 *     '{"module":"commonjs","esModuleInterop":true,"resolveJsonModule":true}' \
 *     scripts/reset-oracle.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const IDL_PATH = path.resolve(__dirname, "../target/idl/dino_core.json");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("platform")], program.programId);
  const admin = (provider.wallet as anchor.Wallet).payer;

  const sig = await program.methods
    .updatePlatform(null, null, admin.publicKey, null)
    .accountsStrict({ platform: pda, admin: admin.publicKey })
    .rpc();
  console.log(`reset kyc_oracle = ${admin.publicKey.toBase58()}`);
  console.log(`tx: ${sig}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
