import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const ADMIN_KEY = process.env.HOME + "/.config/solana/dinosecurities-deployer.json";
const SETTLEMENT_AGENT = new PublicKey("D9byTNj21tmLoHX6SXiY2kjKXPjjGZwTejx1ccpBPpj4");
const KYC_ORACLE = new PublicKey("Bv3Cy58QmuDpBFwAtbjPJmEMbWaob9XZoBHmjU9nTipc");
const PROGRAM_ID = new PublicKey("2357nPiEYZS5YFmMoviaS5f4jGBSEaV8hR5TZsXM25sA");
const IDL_PATH = path.resolve(__dirname, "../target/idl/dino_core.json");

async function main() {
  const bytes = JSON.parse(fs.readFileSync(ADMIN_KEY, "utf8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(bytes));
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);
  const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from("platform")], PROGRAM_ID);

  const existing = await connection.getAccountInfo(platformPda);
  if (existing) { console.log("already initialized:", platformPda.toBase58()); return; }

  console.log("admin   =", admin.publicKey.toBase58());
  console.log("agent   =", SETTLEMENT_AGENT.toBase58());
  console.log("oracle  =", KYC_ORACLE.toBase58());
  console.log("PDA     =", platformPda.toBase58());

  const sig = await program.methods
    .initializePlatform(SETTLEMENT_AGENT, KYC_ORACLE)
    .accountsStrict({ platform: platformPda, admin: admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
    .rpc();
  console.log("tx:", sig);
}
main().catch(e => { console.error(e); process.exit(1); });
