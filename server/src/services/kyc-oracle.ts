import { env } from "../env.js";
import { db } from "../db/index.js";
import { kycSessions, indexedHolders } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * KYC Provider interface — swap implementations for Jumio, Persona, etc.
 */
interface KYCProvider {
  createSession(walletAddress: string): Promise<{
    sessionId: string;
    redirectUrl: string;
  }>;
  getResult(sessionId: string): Promise<{
    status: "approved" | "rejected" | "pending";
    hash: string;
  }>;
}

/**
 * Stub KYC provider for development — always approves
 */
class DevKYCProvider implements KYCProvider {
  async createSession(walletAddress: string) {
    return {
      sessionId: `dev-${Date.now()}`,
      redirectUrl: `http://localhost:8080/app/settings?kyc=dev`,
    };
  }

  async getResult(sessionId: string) {
    return {
      status: "approved" as const,
      hash: `dev-kyc-hash-${sessionId}`,
    };
  }
}

/**
 * Get the configured KYC provider
 */
export function getKYCProvider(): KYCProvider {
  if (!env.KYC_PROVIDER_API_KEY) {
    return new DevKYCProvider();
  }

  // TODO: Return real Jumio/Persona provider when API key is configured
  // return new JumioProvider(env.KYC_PROVIDER_API_KEY);
  return new DevKYCProvider();
}

/**
 * Handle KYC completion webhook from the provider.
 * Called when Jumio/Persona sends a result.
 */
export async function onKYCComplete(
  wallet: string,
  providerSessionId: string,
  approved: boolean,
  kycHash: string,
) {
  // Update session in DB
  await db
    .update(kycSessions)
    .set({
      status: approved ? "verified" : "rejected",
      resultHash: kycHash,
      providerSessionId,
    })
    .where(eq(kycSessions.wallet, wallet));

  if (approved) {
    // TODO: Call dino_core.register_holder to create HolderRecord PDA on-chain
    // This requires the oracle keypair (SETTLEMENT_AGENT_KEY or dedicated oracle key)
    // const connection = getHealthyConnection();
    // const oracleKeypair = loadKeypair(env.KYC_ORACLE_KEY);
    // await registerHolderOnChain(connection, oracleKeypair, wallet, kycHash);

    console.log(`KYC approved for ${wallet}, hash: ${kycHash}`);
  }
}
