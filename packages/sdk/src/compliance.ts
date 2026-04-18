import { DEFAULT_API_BASE } from "./constants.js";

/**
 * Off-chain read-only simulation of the dino_transfer_hook compliance
 * sequence. Mirrors the public /api/v1/compliance/simulate endpoint;
 * surfaced as a first-class SDK helper because it's the single most
 * useful question an external integrator asks: "would this transfer
 * succeed today?"
 */
export interface ComplianceCheck {
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
}

export interface ComplianceSimulationResult {
  overall: "pass" | "fail";
  checks: ComplianceCheck[];
}

export async function simulateCompliance(args: {
  wallet: string;
  mint: string;
  apiBase?: string;
  fetch?: typeof fetch;
}): Promise<ComplianceSimulationResult> {
  const base = (args.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, "");
  const fetchFn = args.fetch ?? fetch;
  const url = `${base}/api/v1/compliance/simulate?wallet=${encodeURIComponent(
    args.wallet,
  )}&mint=${encodeURIComponent(args.mint)}`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`compliance simulation failed: ${resp.status} ${text}`);
  }
  return (await resp.json()) as ComplianceSimulationResult;
}
