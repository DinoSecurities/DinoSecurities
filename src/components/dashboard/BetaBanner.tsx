import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shield, X } from "lucide-react";

/**
 * First-connect beta disclaimer. Shown once per wallet per browser; slides
 * in when the user connects, auto-dismisses after 10s with a slide-up
 * animation. Dismissal is persisted in localStorage keyed on the wallet
 * pubkey, so returning users don't see it again. A manual X button lets
 * users close it early.
 */
const LS_PREFIX = "dinosecurities:beta-seen:";
const VISIBLE_MS = 10_000;

const BetaBanner = () => {
  const { publicKey, connected } = useWallet();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) {
      setVisible(false);
      return;
    }
    const key = LS_PREFIX + publicKey.toBase58();
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;

    setVisible(true);
    window.localStorage.setItem(key, String(Date.now()));
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [connected, publicKey]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0, height: 0 }}
          animate={{ y: 0, opacity: 1, height: "auto" }}
          exit={{ y: -40, opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-6 py-2 flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest text-amber-300/90 font-semibold">
            <Shield size={12} />
            <span>
              Experimental beta — protocol is unaudited. Not investment advice. Use at your own risk.{" "}
              <a
                href="https://github.com/DinoSecurities/DinoSecurities/blob/main/TERMS.md"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-amber-200 normal-case tracking-normal"
              >
                Terms
              </a>
            </span>
            <button
              onClick={() => setVisible(false)}
              className="ml-2 text-amber-300/60 hover:text-amber-200"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BetaBanner;
