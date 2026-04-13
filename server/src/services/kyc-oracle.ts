import crypto from "node:crypto";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { kycSessions, indexedHolders } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface KYCProvider {
  createSession(walletAddress: string): Promise<{
    sessionId: string;
    redirectUrl: string;
  }>;
  getResult(sessionId: string): Promise<{
    status: "approved" | "rejected" | "pending";
    hash: string;
    isAccredited?: boolean;
    countryCode?: string;
  }>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhook(payload: unknown): {
    sessionId: string;
    walletAddress: string;
    status: "approved" | "rejected" | "pending";
    hash: string;
    isAccredited?: boolean;
    countryCode?: string;
  };
}

class DevKYCProvider implements KYCProvider {
  async createSession(_walletAddress: string) {
    return {
      sessionId: `dev-${Date.now()}`,
      redirectUrl: `http://localhost:8080/app/settings?kyc=dev`,
    };
  }
  async getResult(sessionId: string) {
    return { status: "approved" as const, hash: `dev-kyc-hash-${sessionId}` };
  }
  verifyWebhookSignature() { return true; }
  parseWebhook(payload: any) {
    return {
      sessionId: payload.sessionId ?? `dev-${Date.now()}`,
      walletAddress: payload.walletAddress ?? "",
      status: "approved" as const,
      hash: `dev-${Date.now()}`,
    };
  }
}

/**
 * Didit (didit.me) KYC provider. Free tier supports KYC + AML screening.
 *
 * Docs: https://docs.didit.me/reference
 *
 * Flow:
 *   1. createSession() POSTs to /v1/session/ with vendor_data=walletAddress
 *      so we can map the returned session back to the wallet on webhook.
 *   2. User completes KYC at the returned URL.
 *   3. Didit POSTs result to our webhook endpoint signed with HMAC-SHA256.
 *   4. We verify signature, mark session approved, and trigger on-chain
 *      HolderRecord registration via the KYC oracle keypair.
 */
class DiditKYCProvider implements KYCProvider {
  private base = "https://verification.didit.me";
  constructor(private apiKey: string, private webhookSecret: string) {}

  private async request(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        "x-api-key": this.apiKey,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Didit ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async createSession(walletAddress: string) {
    const data = await this.request("/v1/session/", {
      method: "POST",
      body: JSON.stringify({
        callback: env.KYC_REDIRECT_URL,
        vendor_data: walletAddress,
        features: "OCR + FACE + AML",
      }),
    });
    return {
      sessionId: data.session_id ?? data.id,
      redirectUrl: data.url,
    };
  }

  async getResult(sessionId: string) {
    const data = await this.request(`/v1/session/${sessionId}/decision/`);
    const decision = String(data.status ?? "").toLowerCase();
    const status: "approved" | "rejected" | "pending" =
      decision === "approved" ? "approved"
      : decision === "declined" || decision === "rejected" ? "rejected"
      : "pending";
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ id: data.session_id ?? sessionId, status: decision }))
      .digest("hex");
    return {
      status,
      hash,
      isAccredited: Boolean(data.kyc?.accredited_investor),
      countryCode: data.kyc?.address?.country_code ?? data.kyc?.country,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhook(payload: any) {
    const status: "approved" | "rejected" | "pending" =
      payload.status === "Approved" ? "approved"
      : payload.status === "Declined" ? "rejected"
      : "pending";
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ id: payload.session_id, status: payload.status }))
      .digest("hex");
    return {
      sessionId: payload.session_id,
      walletAddress: payload.vendor_data ?? "",
      status,
      hash,
      isAccredited: Boolean(payload.kyc?.accredited_investor),
      countryCode: payload.kyc?.address?.country_code,
    };
  }
}

let cachedProvider: KYCProvider | null = null;

export function getKYCProvider(): KYCProvider {
  if (cachedProvider) return cachedProvider;
  if (env.KYC_PROVIDER === "didit" && env.KYC_PROVIDER_API_KEY && env.KYC_WEBHOOK_SECRET) {
    cachedProvider = new DiditKYCProvider(env.KYC_PROVIDER_API_KEY, env.KYC_WEBHOOK_SECRET);
  } else {
    cachedProvider = new DevKYCProvider();
  }
  return cachedProvider;
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
  extra: { isAccredited?: boolean; countryCode?: string } = {},
) {
  await db
    .update(kycSessions)
    .set({
      status: approved ? "verified" : "rejected",
      resultHash: kycHash,
      providerSessionId,
    })
    .where(eq(kycSessions.wallet, wallet));

  if (approved && wallet) {
    // Per-mint HolderRecord registration is performed lazily when the issuer
    // attempts to mint or transfer to this wallet — at that point the issuer
    // already knows which security mint applies. This avoids the oracle
    // needing to enumerate every series the user might ever hold.
    console.log(
      `KYC approved for ${wallet}: hash=${kycHash} accredited=${extra.isAccredited ?? false} country=${extra.countryCode ?? "?"}`,
    );
  }
}
