import { useMemo } from "react";
import { NETWORK } from "@/providers/SolanaProvider";

interface NetworkInfo {
  name: string;
  isMainnet: boolean;
  isDevnet: boolean;
  label: string;
}

/**
 * Returns info about the current Solana network.
 */
export function useNetwork(): NetworkInfo {
  return useMemo(() => {
    const isMainnet = NETWORK === "mainnet-beta";
    const isDevnet = NETWORK === "devnet";
    const label = isMainnet
      ? "Solana Mainnet"
      : isDevnet
        ? "Solana Devnet"
        : `Solana ${NETWORK}`;

    return { name: NETWORK, isMainnet, isDevnet, label };
  }, []);
}
