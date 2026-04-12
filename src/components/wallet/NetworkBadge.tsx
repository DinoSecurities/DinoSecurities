import { NETWORK } from "@/providers/SolanaProvider";

export default function NetworkBadge() {
  const isMainnet = NETWORK === "mainnet-beta";
  const isDevnet = NETWORK === "devnet";

  const label = isMainnet
    ? "Solana Mainnet"
    : isDevnet
      ? "Solana Devnet"
      : `Solana ${NETWORK}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </span>
      <div
        className={`w-1.5 h-1.5 rounded-full shadow-[0_0_6px] ${
          isMainnet
            ? "bg-primary shadow-primary"
            : "bg-yellow-500 shadow-yellow-500"
        }`}
      />
    </div>
  );
}
