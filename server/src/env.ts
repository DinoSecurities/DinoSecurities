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
  KYC_PROVIDER_API_KEY: z.string().optional(),
  SETTLEMENT_AGENT_KEY: z.string().optional(),
  IRYS_WALLET_KEY: z.string().optional(),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
});

export const env = envSchema.parse(process.env);
