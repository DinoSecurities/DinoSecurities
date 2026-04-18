import { useHandleFor } from "@/hooks/useDinoHandles";
import { truncateAddress } from "@/lib/solana";

interface Props {
  wallet: string;
  /** If a pre-resolved handle map is available from a batched call, pass it to skip the per-row lookup. */
  handleMap?: Record<string, { displayHandle: string }>;
  className?: string;
  /** Include the trailing truncated address in parentheses after the handle, for wallets that want both signals. */
  withAddress?: boolean;
}

/**
 * Drop-in replacement for `truncateAddress(wallet)` in any label
 * surface. Renders `@displayHandle` when the wallet has claimed a
 * $DINO community handle, falls back to the familiar truncated
 * address otherwise.
 *
 * Prefer passing `handleMap` from a batched useHandlesFor at the
 * parent level — rendering a list of fifty holders with fifty
 * individual resolve queries is a rookie mistake.
 */
export default function HolderName({ wallet, handleMap, className, withAddress }: Props) {
  const { data } = useHandleFor(handleMap ? null : wallet);
  const direct = handleMap?.[wallet]?.displayHandle ?? data?.displayHandle ?? null;

  if (direct) {
    return (
      <span className={className}>
        <span className="text-primary">@{direct}</span>
        {withAddress && (
          <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
            ({truncateAddress(wallet)})
          </span>
        )}
      </span>
    );
  }
  return <span className={`font-mono ${className ?? ""}`}>{truncateAddress(wallet)}</span>;
}
