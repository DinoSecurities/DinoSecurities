import { ExternalLink } from "lucide-react";
import { getExplorerUrl } from "@/lib/solana";

interface Props {
  /** Big number shown as the headline — e.g. "423ms" or "< $0.01". */
  value: string;
  /** Label under the number, e.g. "Avg Finality". */
  label?: string;
  /** Real tx signature this claim is backed by. If present, the stat becomes
   * a link to Solana Explorer; without it we render an unlinked value. */
  signature?: string | null;
  /** Optional context line under the label — "over last 47 settlements", etc. */
  caption?: string;
  /** Colour theme. "light" for purple/primary cards with white text, "dark"
   * for cards where the background is foreground-coloured. */
  variant?: "light" | "dark";
  className?: string;
}

/**
 * A number on the landing page that links to a real mainnet tx proving the
 * claim. Replaces the old marketing-only static numbers — if we write a stat,
 * it's pulled from live on-chain data and verifiable in one click.
 *
 * Falls back to the static value gracefully when we have no settlement yet.
 */
export default function ClickToVerifyStat({
  value,
  label,
  signature,
  caption,
  variant = "light",
  className = "",
}: Props) {
  const labelColor = variant === "light" ? "text-primary-foreground/70" : "text-background/60";
  const numberColor = variant === "light" ? "text-foreground" : "text-background";
  const subtle = variant === "light" ? "text-primary-foreground/70" : "text-background/60";

  const body = (
    <>
      <div className={`text-5xl font-semibold tracking-tighter ${numberColor} mb-1`}>
        {value}
      </div>
      {label && <div className={`text-xs font-medium ${labelColor}`}>{label}</div>}
      {caption && (
        <div className={`mt-2 text-[10px] uppercase tracking-widest font-medium ${subtle}`}>
          {caption}
        </div>
      )}
    </>
  );

  if (!signature) {
    return <div className={className}>{body}</div>;
  }

  return (
    <a
      href={getExplorerUrl(signature, "tx")}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block ${className}`}
      title="Verify on Solana Explorer — this number is from a real mainnet tx"
    >
      {body}
      <div
        className={`mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold ${subtle} group-hover:text-foreground transition-colors`}
      >
        Verify on-chain
        <ExternalLink size={10} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </a>
  );
}
