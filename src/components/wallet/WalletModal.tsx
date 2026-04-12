import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { X } from "lucide-react";

const ALLOWED_WALLETS = ["Phantom", "Solflare"];

export default function WalletModal() {
  const { wallets, select } = useWallet();
  const { visible, setVisible } = useWalletModal();

  if (!visible) return null;

  const filtered = wallets.filter((w) =>
    ALLOWED_WALLETS.includes(w.adapter.name),
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setVisible(false)} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[360px] bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Connect Wallet</span>
          <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {filtered.map((w) => (
            <button
              key={w.adapter.name}
              onClick={() => {
                select(w.adapter.name);
                setVisible(false);
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
                  Installed
                </span>
              )}
              {w.readyState !== "Installed" && (
                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5 font-semibold">
                  Install
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
