import { useSyncExternalStore, useCallback } from "react";

let isOpen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function openWalletModal() {
  isOpen = true;
  notify();
}

export function closeWalletModal() {
  isOpen = false;
  notify();
}

export function useWalletModalState() {
  const open = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => isOpen,
  );

  return {
    isOpen: open,
    open: useCallback(() => openWalletModal(), []),
    close: useCallback(() => closeWalletModal(), []),
  };
}
