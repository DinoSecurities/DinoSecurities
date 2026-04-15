import { useEffect, useState } from "react";

/**
 * Read the user's display name from localStorage (set in Settings → Profile).
 * Stored per-wallet as `dino:profile:<wallet>` = `{ displayName, email }`.
 * Listens to storage events (cross-tab) and a custom `dino:profile-updated`
 * event (same-tab) so the navbar updates immediately after saving.
 */
export function useDisplayName(wallet: string | null | undefined): string {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!wallet) {
      setDisplayName("");
      return;
    }

    const read = () => {
      try {
        const raw = localStorage.getItem(`dino:profile:${wallet}`);
        if (!raw) {
          setDisplayName("");
          return;
        }
        const parsed = JSON.parse(raw);
        setDisplayName(typeof parsed?.displayName === "string" ? parsed.displayName.trim() : "");
      } catch {
        setDisplayName("");
      }
    };

    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key === `dino:profile:${wallet}`) read();
    };
    const onCustom = () => read();

    window.addEventListener("storage", onStorage);
    window.addEventListener("dino:profile-updated", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dino:profile-updated", onCustom);
    };
  }, [wallet]);

  return displayName;
}
