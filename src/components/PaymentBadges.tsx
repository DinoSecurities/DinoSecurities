/**
 * Row of "Accepted payments" badges.
 *
 * USDC is live on the platform today — that's the only payment mint the
 * settlement flow currently routes through. wXRP is shown as "Coming Soon"
 * until Hex Trust's LayerZero OFT deployment on Solana is confirmed live
 * with real liquidity. When it ships, flip `WXRP_LIVE` to `true` and add
 * `VITE_WXRP_MINT` to the env.
 */

const WXRP_LIVE = true;

interface PaymentBadgesProps {
  /** Small variant — used inside modals / side panels. Default is the regular size. */
  size?: "sm" | "md";
  /** If true, renders inline (horizontal) with no heading. Default is vertical with heading. */
  inline?: boolean;
  className?: string;
}

export default function PaymentBadges({
  size = "md",
  inline = false,
  className = "",
}: PaymentBadgesProps) {
  const badgeSize = size === "sm" ? "text-[10px] px-2 py-1" : "text-xs px-3 py-1.5";
  const iconSize = size === "sm" ? 14 : 16;

  const content = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* USDC — live */}
      <div
        className={`flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 ${badgeSize}`}
      >
        <USDCIcon size={iconSize} />
        <span className="font-semibold text-emerald-400">USDC</span>
      </div>

      {/* wXRP */}
      <div
        className={`flex items-center gap-2 ${
          WXRP_LIVE
            ? "bg-emerald-500/10 border border-emerald-500/30"
            : "bg-secondary/60 border border-border"
        } ${badgeSize}`}
        title={WXRP_LIVE ? "wXRP payments accepted" : "wXRP payments coming soon"}
      >
        <XRPIcon size={iconSize} />
        <span className={`font-semibold ${WXRP_LIVE ? "text-emerald-400" : "text-muted-foreground"}`}>wXRP</span>
        {!WXRP_LIVE && (
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 bg-muted/40 border border-border px-1.5 py-0.5">
            Soon
          </span>
        )}
      </div>
    </div>
  );

  if (inline) return <div className={className}>{content}</div>;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        Accepted payments
      </span>
      {content}
    </div>
  );
}

// Minimal inline SVGs — avoid adding image asset deps for two tiny logos.
function USDCIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M20.5 18.4c0-2.4-1.4-3.2-4.2-3.5-2-.3-2.4-.8-2.4-1.7 0-.9.6-1.4 1.9-1.4 1.1 0 1.8.4 2.1 1.3.1.2.3.3.5.3h1.1c.3 0 .5-.2.5-.5v-.1c-.3-1.4-1.4-2.4-2.9-2.6V8.8c0-.3-.2-.5-.6-.6h-1c-.3 0-.5.2-.6.6v1.3c-2 .3-3.3 1.6-3.3 3.2 0 2.3 1.4 3.1 4.2 3.5 1.9.3 2.5.8 2.5 1.8 0 1-.9 1.7-2 1.7-1.6 0-2.1-.7-2.3-1.5-.1-.3-.3-.4-.5-.4h-1.1c-.3 0-.5.2-.5.5v.1c.3 1.6 1.3 2.6 3.5 2.9v1.4c0 .3.2.5.6.6h1c.3 0 .5-.2.6-.6v-1.4c2.1-.3 3.5-1.7 3.5-3.5z"
        fill="#fff"
      />
      <path
        d="M12.7 24.5c-4.4-1.6-6.7-6.4-5-10.7.9-2.4 2.8-4.2 5-5 .2-.1.3-.3.3-.6v-.9c0-.2-.1-.4-.3-.4-.1 0-.2 0-.2.1-5.3 1.7-8.2 7.3-6.5 12.6 1 3.1 3.4 5.5 6.5 6.5.2.1.4 0 .5-.2.1-.1.1-.2.1-.3v-.9c-.1-.1-.3-.3-.4-.2zM19.6 6.8c-.2-.1-.4 0-.5.2-.1.1-.1.2-.1.3v.9c0 .3.2.5.4.6 4.4 1.6 6.7 6.4 5 10.7-.9 2.4-2.8 4.2-5 5-.2.1-.3.3-.3.6v.9c0 .2.1.4.3.4.1 0 .2 0 .2-.1 5.3-1.7 8.2-7.3 6.5-12.6-1-3.1-3.4-5.5-6.5-6.5z"
        fill="#fff"
      />
    </svg>
  );
}

function XRPIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#23292F" />
      <path
        d="M22.2 8.5h2.5l-5.2 5.1c-1.9 1.9-5 1.9-6.9 0L7.3 8.5h2.5l4 3.9c1.2 1.2 3.1 1.2 4.3 0l4.1-3.9zM9.8 23.5H7.3l5.2-5.2c1.9-1.9 5-1.9 6.9 0l5.2 5.2h-2.5l-4-4c-1.2-1.2-3.1-1.2-4.3 0l-4 4z"
        fill="#fff"
      />
    </svg>
  );
}
