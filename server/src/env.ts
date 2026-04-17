import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/dinosecurities"),
  SOLANA_RPC_URL: z.string().default("https://api.devnet.solana.com"),
  SOLANA_RPC_FALLBACK: z.string().optional(),
  DINO_CORE_PROGRAM_ID: z.string().default("11111111111111111111111111111111"),
  DINO_HOOK_PROGRAM_ID: z.string().default("11111111111111111111111111111111"),
  DINO_GOV_PROGRAM_ID: z.string().default("11111111111111111111111111111111"),
  HELIUS_API_KEY: z.string().default(""),
  WEBHOOK_SECRET: z.string().default("dev-webhook-secret"),
  KYC_PROVIDER: z.enum(["dev", "didit"]).default("dev"),
  KYC_PROVIDER_API_KEY: z.string().optional(),
  KYC_WEBHOOK_SECRET: z.string().optional(),
  KYC_REDIRECT_URL: z.string().default("https://www.dinosecurities.com/app/settings?kyc=callback"),
  SETTLEMENT_AGENT_KEY: z.string().optional(),
  /**
   * KYC oracle keypair — co-signs register_issuer and register_holder
   * instructions. Must match platform.kyc_oracle as configured at
   * initialize_platform. Accepts a JSON byte-array, a filesystem path
   * to a Solana keypair JSON, or a base58 secret key string.
   */
  KYC_ORACLE_KEY: z.string().optional(),
  IRYS_WALLET_KEY: z.string().optional(),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  ADMIN_WALLETS: z.string().default(""),
  // Public base URL this API is served under — used to build absolute
  // links to static artifacts (trade-confirmation PDFs, etc.) that the
  // frontend can render in a new tab. Leave empty to return relative URLs.
  PUBLIC_BASE_URL: z.string().default("https://squid-app-zj6jb.ondigitalocean.app"),
});

export const env = envSchema.parse(process.env);
