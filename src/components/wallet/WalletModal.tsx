import { useWallet } from "@solana/wallet-adapter-react";
import { X } from "lucide-react";
import { useWalletModalState } from "./walletModalState";

const ALLOWED_WALLETS = ["Phantom", "Solflare"];

export default function WalletModal() {
  const { wallets, select, connect } = useWallet();
  const { isOpen, close } = useWalletModalState();

  if (!isOpen) return null;

  const filtered = wallets.filter((w) =>
    ALLOWED_WALLETS.includes(w.adapter.name),
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[100]" onClick={close} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[360px] bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Connect Wallet</span>
          <button onClick={close} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {filtered.map((w) => (
            <button
              key={w.adapter.name}
              onClick={async () => {
                select(w.adapter.name);
                close();
                try { await connect(); } catch {}
              }}
              className="flex items-center gap-4 w-full px-4 py-3.5 border border-border hover:bg-secondary/60 hover:border-primary/40 transition-all"
            >
              <img
                src={w.adapter.icon}
                alt={w.adapter.name}
                width={28}
                height={28}
                className="shrink-0"
              />
              <span className="text-sm font-medium text-foreground">{w.adapter.name}</span>
              {w.readyState === "Installed" && (
                <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 font-semibold">
                  Detected
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No supported wallets found. Install Phantom or Solflare.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
