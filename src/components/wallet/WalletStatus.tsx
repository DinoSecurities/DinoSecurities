import { useWallet } from "@solana/wallet-adapter-react";
import { truncateAddress } from "@/lib/solana";
import { NETWORK } from "@/providers/SolanaProvider";

export default function WalletStatus() {
  const { publicKey, connected, wallet } = useWallet();
  const isMainnet = NETWORK === "mainnet-beta";
  const networkLabel = isMainnet ? "Solana Mainnet" : "Solana Devnet";

  if (!connected || !publicKey) {
    return (
      <div className="px-3 py-3 bg-secondary/60 border border-border">
        <div className="text-xs text-muted-foreground text-center">
          No wallet connected
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 bg-secondary/60 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_6px] ${
            isMainnet
              ? "bg-primary shadow-primary"
              : "bg-yellow-500 shadow-yellow-500"
          }`}
        />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {wallet?.adapter.name || "Wallet"}
        </span>
      </div>
      <div className="text-xs text-foreground font-mono truncate">
        {truncateAddress(publicKey.toBase58())}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        {networkLabel}
      </div>
    </div>
  );
}
