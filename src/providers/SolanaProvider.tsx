import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  LedgerWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("devnet");

interface SolanaProviderProps {
  children: ReactNode;
}

export default function SolanaProvider({ children }: SolanaProviderProps) {
  const endpoint = useMemo(() => RPC_URL, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new LedgerWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export { NETWORK, RPC_URL };
