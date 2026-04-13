/**
 * One-time initialization of the dino_core PlatformConfig PDA on devnet.
 *
 * Run with:
 *   cd programs && npx ts-node scripts/init-platform.ts
 *
 * After this completes, the platform is operational:
 *   - Admin = the deployer wallet (can update config later)
 *   - Settlement agent = the settlement keypair (signs DvP transactions)
 *   - KYC oracle = the deployer for now (registers HolderRecords). Move to
 *     a dedicated key before mainnet.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const ADMIN_KEY = path.join(os.homedir(), ".config/solana/dinosecurities-deployer.json");
const SETTLEMENT_KEY = path.join(os.homedir(), ".config/solana/dinosecurities-settlement.json");
const PROGRAM_ID = new PublicKey("2357nPiEYZS5YFmMoviaS5f4jGBSEaV8hR5TZsXM25sA");
const IDL_PATH = path.resolve(__dirname, "../target/idl/dino_core.json");

function loadKeypair(p: string): Keypair {
  const bytes = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function main() {
  const admin = loadKeypair(ADMIN_KEY);
  const settlementAgent = loadKeypair(SETTLEMENT_KEY).publicKey;
  const kycOracle = admin.publicKey;

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);

  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID,
  );

  const existing = await connection.getAccountInfo(platformPda);
  if (existing) {
    console.log(`PlatformConfig already exists at ${platformPda.toBase58()}`);
    return;
  }

  console.log("Initializing platform with:");
  console.log("  admin            =", admin.publicKey.toBase58());
  console.log("  settlement_agent =", settlementAgent.toBase58());
  console.log("  kyc_oracle       =", kycOracle.toBase58());
  console.log("  PlatformConfig   =", platformPda.toBase58());

  const sig = await program.methods
    .initializePlatform(settlementAgent, kycOracle)
    .accountsStrict({
      platform: platformPda,
      admin: admin.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`✓ initialized — tx: ${sig}`);
  console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
