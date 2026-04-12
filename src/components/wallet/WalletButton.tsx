import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { truncateAddress } from "@/lib/solana";
import { LogOut, Copy, Check, ExternalLink } from "lucide-react";
import { getExplorerUrl } from "@/lib/solana";

interface WalletButtonProps {
  compact?: boolean;
}

export default function WalletButton({ compact = false }: WalletButtonProps) {
  const { publicKey, connected, disconnect, wallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (compact && connected && publicKey) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 bg-secondary border border-border px-3 py-1.5 hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_4px] shadow-primary" />
          <span className="text-xs font-mono text-foreground">
            {truncateAddress(publicKey.toBase58())}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border shadow-2xl z-50">
            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                {wallet?.adapter.name || "Wallet"}
              </div>
              <div className="text-xs font-mono text-foreground truncate">
                {publicKey.toBase58()}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <a
              href={getExplorerUrl(publicKey.toBase58())}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ExternalLink size={14} />
              View on Explorer
            </a>
            <button
              onClick={() => { disconnect(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border-t border-border"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        )}
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
