import { Check, Loader2, ShieldAlert, ShieldOff } from "lucide-react";
import { useDocVerification } from "@/hooks/useDocVerification";

interface Props {
  docUri: string | null | undefined;
  expectedHex: string | null | undefined;
  /** Compact variant suitable for small cards / marketplace tiles. */
  compact?: boolean;
  className?: string;
}

function shortenHex(hex: string, head = 10, tail = 6) {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/**
 * Verification badge rendered next to a security's Governing Document.
 *
 * Four states:
 *   idle / verifying — "Verifying on-chain hash…"  (amber spinner)
 *   matches          — "Document verified"          (emerald check)
 *   mismatch         — "Document altered"           (red warn) + digests
 *   unverifiable     — "Verification unavailable"   (muted) + reason
 */
export default function DocVerificationBadge({
  docUri,
  expectedHex,
  compact = false,
  className = "",
}: Props) {
  const { data, isLoading } = useDocVerification(docUri, expectedHex);
  const state = isLoading ? { status: "verifying" as const } : data ?? { status: "idle" as const };

  if (state.status === "idle" || state.status === "verifying") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 size={compact ? 12 : 14} className="text-amber-400 animate-spin" />
        <span className={`${compact ? "text-[10px]" : "text-xs"} uppercase tracking-widest font-semibold text-amber-400`}>
          Verifying on-chain hash…
        </span>
      </div>
    );
  }

  if (state.status === "matches") {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Check size={compact ? 10 : 12} className="text-emerald-400" strokeWidth={3} />
          </div>
          <span className={`${compact ? "text-[10px]" : "text-xs"} uppercase tracking-widest font-semibold text-emerald-400`}>
            Document verified on-chain
          </span>
        </div>
        {!compact && (
          <span className="text-[10px] text-muted-foreground font-mono ml-7">
            SHA-256 match · {(state.bytes / 1024).toFixed(1)} KB · {shortenHex(state.actualHex)}
          </span>
        )}
      </div>
    );
  }

  if (state.status === "mismatch") {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/50 flex items-center justify-center">
            <ShieldAlert size={compact ? 10 : 12} className="text-red-400" />
          </div>
          <span className={`${compact ? "text-[10px]" : "text-xs"} uppercase tracking-widest font-semibold text-red-400`}>
            Document altered since issuance
          </span>
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground font-mono ml-7 flex flex-col gap-0.5">
            <span>Expected {shortenHex(state.expectedHex)}</span>
            <span>Actual &nbsp;&nbsp;{shortenHex(state.actualHex)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ShieldOff size={compact ? 12 : 14} className="text-muted-foreground" />
      <span className={`${compact ? "text-[10px]" : "text-xs"} uppercase tracking-widest font-semibold text-muted-foreground`}>
        Verification unavailable
      </span>
      {!compact && (
        <span className="text-[10px] text-muted-foreground/70 font-mono">· {state.reason}</span>
      )}
    </div>
  );
}
