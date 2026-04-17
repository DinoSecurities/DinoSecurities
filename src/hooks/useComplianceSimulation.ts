import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface ComplianceCheck {
  id: string;
  name: string;
  status: CheckStatus;
  detail?: string;
}

export interface ComplianceSimulation {
  pass: boolean;
  checks: ComplianceCheck[];
  series: { mint: string; restriction: string; paused: boolean } | null;
  holder: {
    isRevoked: boolean;
    isFrozen: boolean;
    isAccredited: boolean;
    kycExpiry: number;
    jurisdiction: string;
  } | null;
  holderPda?: string;
}

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Read-only pre-trade compliance simulator. Given a wallet + security mint
 * it returns the exact pass/fail sequence the on-chain transfer hook would
 * run, without sending any tx or requiring a signature.
 */
export function useComplianceSimulation(wallet: string, mint: string) {
  const enabled = PUBKEY_RE.test(wallet) && PUBKEY_RE.test(mint);
  return useQuery({
    queryKey: ["compliance.simulate", wallet, mint],
    queryFn: () => trpc.compliance.simulate.query({ wallet, mint }) as Promise<ComplianceSimulation>,
    enabled,
    // Cache for a minute — holder / series state changes are rare.
    staleTime: 60_000,
    retry: 1,
  });
}
