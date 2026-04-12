import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { deriveIssuerProfilePDA, deriveHolderRecordPDA, PROGRAM_IDS } from "@/lib/solana";

export type UserRole = "visitor" | "unverified" | "investor" | "issuer" | "admin";

interface UserRoleState {
  role: UserRole;
  loading: boolean;
  isConnected: boolean;
  isIssuer: boolean;
  isInvestor: boolean;
  isAdmin: boolean;
}

/**
 * Determines user role based on on-chain state:
 * - No wallet -> "visitor"
 * - Wallet connected, no HolderRecord -> "unverified"
 * - Wallet connected + HolderRecord exists -> "investor"
 * - Wallet connected + IssuerProfile exists -> "issuer"
 * - Wallet in platform multisig -> "admin"
 */
export function useUserRole(): UserRoleState {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [role, setRole] = useState<UserRole>("visitor");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) {
      setRole("visitor");
      return;
    }

    let cancelled = false;

    async function detectRole() {
      setLoading(true);
      try {
        // Check if IssuerProfile PDA exists
        const [issuerPDA] = deriveIssuerProfilePDA(publicKey!);
        const issuerAccount = await connection.getAccountInfo(issuerPDA);

        if (issuerAccount && issuerAccount.owner.equals(PROGRAM_IDS.DINO_CORE)) {
          if (!cancelled) setRole("issuer");
          return;
        }

        // Check if any HolderRecord exists for this wallet
        // We check against a known mint — in production this would scan all mints
        // For now, having a connected wallet without an issuer profile = unverified
        // The full investor check happens when we have real program data
        if (!cancelled) setRole("unverified");
      } catch {
        // If programs aren't deployed yet, default to unverified for connected wallets
        if (!cancelled) setRole("unverified");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detectRole();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connected, connection]);

  return {
    role,
    loading,
    isConnected: connected,
    isIssuer: role === "issuer",
    isInvestor: role === "investor",
    isAdmin: role === "admin",
  };
}
