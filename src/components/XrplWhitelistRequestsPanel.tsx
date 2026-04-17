import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";
import { registerHolderViaXrplCredential } from "@/lib/issuerActions";

interface Props {
  seriesMint: string;
}

/**
 * Issuer-side queue of pending XRPL-credential whitelist requests for a
 * specific series. Each row shows the holder's Solana wallet + linked
 * XRPL address; the issuer can approve (builds + signs register_holder,
 * routed through the xrpl-credential cosign endpoint so the backend
 * re-runs the credential check against live XRPL state) or reject with
 * a reason.
 */
export default function XrplWhitelistRequestsPanel({ seriesMint }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const requests = useQuery({
    queryKey: ["xrplCredentials.pendingRequestsForSeries", seriesMint],
    queryFn: () => trpc.xrplCredentials.pendingRequestsForSeries.query({ seriesMint }),
    refetchInterval: 15_000,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      trpc.xrplCredentials.rejectRequest.mutate({ id, reason }),
    onSuccess: () => {
      toast.success("Request rejected.");
      setRejectingId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["xrplCredentials.pendingRequestsForSeries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = async (id: number, solanaWallet: string, requestedJurisdiction: string | null) => {
    setBusyId(id);
    try {
      const sig = await registerHolderViaXrplCredential(
        connection,
        wallet,
        {
          mint: seriesMint,
          holderWallet: solanaWallet,
          isAccredited: true,
          jurisdiction: requestedJurisdiction ?? "US",
        },
        id,
      );
      toast.success(`Holder whitelisted. Tx ${sig.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ["xrplCredentials.pendingRequestsForSeries"] });
      qc.invalidateQueries({ queryKey: ["indexedHolders"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  if (requests.isLoading) {
    return (
      <div className="border border-border p-4 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin inline mr-1" /> Checking XRPL-credential
        whitelist queue…
      </div>
    );
  }

  if (!requests.data || requests.data.length === 0) return null;

  return (
    <div className="border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className="text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-foreground font-semibold">
          Pending XRPL-credential whitelist requests
        </span>
        <span className="text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
          {requests.data.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {requests.data.map((r) => (
          <div key={r.id} className="border border-border bg-background/40 p-3">
            <div className="grid md:grid-cols-4 gap-3 text-xs items-center">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Holder</div>
                <div className="font-mono">{truncateAddress(r.solanaWallet)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">XRPL</div>
                <div className="font-mono text-muted-foreground">
                  {truncateAddress(r.xrplAddress)}{" "}
                  <span className="text-[9px] uppercase">({r.network})</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Submitted</div>
                <div className="text-muted-foreground">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                </div>
              </div>
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => approve(r.id, r.solanaWallet, r.requestedJurisdiction)}
                  disabled={busyId === r.id || !wallet.publicKey}
                  className="text-[10px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-2 py-1 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {busyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                  Approve
                </button>
                <button
                  onClick={() => {
                    setRejectingId(r.id);
                    setRejectReason("");
                  }}
                  disabled={busyId === r.id}
                  className="text-[10px] uppercase tracking-widest border border-red-400/30 text-red-400 px-2 py-1 hover:bg-red-400/10 flex items-center gap-1"
                >
                  <XCircle size={10} /> Reject
                </button>
              </div>
            </div>

            {rejectingId === r.id && (
              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason (visible to holder)"
                  className="bg-background border border-border px-2 py-1 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reject.mutate({ id: r.id, reason: rejectReason.trim() || "rejected" })}
                    disabled={reject.isPending}
                    className="text-[10px] uppercase tracking-widest bg-red-400/10 border border-red-400/40 text-red-400 px-2 py-1 hover:bg-red-400/20"
                  >
                    Confirm reject
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
