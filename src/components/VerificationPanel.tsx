import { CheckCircle2, Clock, Network } from "lucide-react";
import DocVerificationBadge from "@/components/DocVerificationBadge";

interface Props {
  docUri: string | null | undefined;
  expectedHex: string | null | undefined;
  className?: string;
}

/**
 * Document-provenance panel for SecurityDetail.
 *
 * Two layers of proof, rendered stacked:
 *
 *   1. LIVE — our existing in-browser SHA-256 check against the on-chain
 *      `doc_hash`. Proves the Arweave bytes haven't changed since issuance.
 *
 *   2. RESERVED — a slot for the ar.io gateway-signed attestation (wallet-
 *      level provenance: proves the document was signed by a specific
 *      Arweave wallet owner, not just that bytes match a hash). Rendered
 *      today as a "coming soon" row so visitors see the slot is held, not
 *      absent. When the ar.io production endpoint is live, this row fills
 *      in with the signed attestation + a link to the gateway's cert.
 */
export default function VerificationPanel({ docUri, expectedHex, className = "" }: Props) {
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Layer 1 — live SHA-256 */}
      <div className="border border-border bg-background/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-foreground font-semibold">
            Layer 1 · Hash Integrity
          </span>
        </div>
        <DocVerificationBadge docUri={docUri} expectedHex={expectedHex} />
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-3">
          Runs in your browser. We fetch the Arweave bytes, SHA-256 them
          locally, and compare to the on-chain commitment. If the document
          has been altered since issuance, this flips red.
        </p>
      </div>

      {/* Layer 2 — reserved for ar.io attestation */}
      <div className="border border-t-0 border-border bg-muted/10 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={14} className="text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Layer 2 · Gateway Attestation
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-400/80 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5">
            <Clock size={10} /> Coming soon
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Wallet-level document provenance, signed by an ar.io gateway
          operator. Proves the Arweave tx was cryptographically signed by
          the issuer's wallet — one level stronger than our hash check.
          Auditor- and regulator-friendly signed PDF output.
        </p>
      </div>
    </div>
  );
}
