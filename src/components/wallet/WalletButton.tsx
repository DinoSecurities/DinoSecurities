import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { truncateAddress } from "@/lib/solana";

interface WalletButtonProps {
  compact?: boolean;
}

export default function WalletButton({ compact = false }: WalletButtonProps) {
  const { publicKey, connected } = useWallet();

  if (compact && connected && publicKey) {
    return (
      <div className="flex items-center gap-2 bg-secondary border border-border px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_4px] shadow-primary" />
        <span className="text-xs font-mono text-foreground">
          {truncateAddress(publicKey.toBase58())}
        </span>
      </div>
    );
  }

  return (
    <WalletMultiButton
      style={{
        backgroundColor: "hsl(var(--secondary))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "0",
        height: "34px",
        fontSize: "12px",
        fontFamily: "monospace",
        padding: "0 12px",
      }}
    />
  );
}
