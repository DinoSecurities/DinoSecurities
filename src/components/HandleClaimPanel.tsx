import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AtSign, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Props {
  currentTierId: number;
}

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

/**
 * Claim-a-handle panel for the /app/dino page. Tier-gated at Bronze
 * (100,000 $DINO); the UI renders the gate explanation directly when
 * the connected wallet hasn't cleared the bar, so the claim button
 * never surfaces a cryptic server-side rejection.
 */
export default function HandleClaimPanel({ currentTierId }: Props) {
  const wallet = useWallet();
  const qc = useQueryClient();
  const [requested, setRequested] = useState("");

  const mine = useQuery({
    queryKey: ["dinoHandles.mine", wallet.publicKey?.toBase58()],
    queryFn: () => trpc.dinoHandles.mine.query(),
    enabled: !!wallet.publicKey,
  });

  const valid = HANDLE_REGEX.test(requested);
  const available = useQuery({
    queryKey: ["dinoHandles.available", requested.toLowerCase()],
    queryFn: () => trpc.dinoHandles.available.query({ handle: requested }),
    enabled: valid && !mine.data,
    staleTime: 5_000,
  });

  const claim = useMutation({
    mutationFn: () => trpc.dinoHandles.claim.mutate({ handle: requested }),
    onSuccess: (res) => {
      toast.success(`Handle @${res.displayHandle} claimed.`);
      setRequested("");
      qc.invalidateQueries({ queryKey: ["dinoHandles.mine"] });
      qc.invalidateQueries({ queryKey: ["dinoHandles.resolve"] });
      qc.invalidateQueries({ queryKey: ["dinoHandles.resolveMany"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: () => trpc.dinoHandles.release.mutate(),
    onSuccess: () => {
      toast.success("Handle released.");
      qc.invalidateQueries({ queryKey: ["dinoHandles.mine"] });
      qc.invalidateQueries({ queryKey: ["dinoHandles.resolve"] });
      qc.invalidateQueries({ queryKey: ["dinoHandles.resolveMany"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!wallet.publicKey) {
    return (
      <div className="border border-border p-4 text-xs text-muted-foreground">
        Connect a wallet to claim a community handle.
      </div>
    );
  }

  const belowBar = currentTierId < 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AtSign size={14} className="text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Community Handle
        </span>
      </div>

      <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
        Claim a handle that replaces your wallet address everywhere the platform surfaces
        a wallet — holder lists, settlement participants, community badges on series pages.
        Requires Bronze tier (100,000 $DINO) at claim time.
      </p>

      {mine.isLoading ? (
        <div className="border border-border p-4 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin inline mr-1" /> Checking your claim…
        </div>
      ) : mine.data ? (
        <div className="border border-primary/40 bg-primary/5 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              You are
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-primary">@{mine.data.displayHandle}</span>
              <span className="text-[10px] text-muted-foreground">claimed {mine.data.createdAt ? new Date(mine.data.createdAt).toLocaleDateString() : ""}</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Release @${mine.data!.displayHandle}? You can re-claim later if it's still available.`)) {
                release.mutate();
              }
            }}
            className="text-[10px] uppercase tracking-widest border border-red-400/30 text-red-400 px-2 py-1 hover:bg-red-400/10 flex items-center gap-1"
          >
            <Trash2 size={10} /> Release
          </button>
        </div>
      ) : belowBar ? (
        <div className="border border-amber-400/30 bg-amber-400/5 text-amber-400 p-4 text-xs">
          Bronze tier (100,000 $DINO) required to claim a community handle. Your current
          tier doesn't meet the bar yet.
        </div>
      ) : (
        <div className="border border-border p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">@</span>
            <input
              value={requested}
              onChange={(e) => setRequested(e.target.value)}
              placeholder="your-handle"
              maxLength={24}
              className="flex-1 bg-background border border-border px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => claim.mutate()}
              disabled={!valid || available.data?.available !== true || claim.isPending}
              className="text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {claim.isPending ? <Loader2 size={11} className="animate-spin" /> : <AtSign size={11} />}
              Claim
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
            {requested.length === 0 ? (
              <span>3–24 characters. Letters, numbers, underscore.</span>
            ) : !valid ? (
              <span className="text-red-400 flex items-center gap-1">
                <XCircle size={10} /> Invalid format — 3–24 chars, letters / numbers / underscore only.
              </span>
            ) : available.isLoading ? (
              <span>
                <Loader2 size={10} className="animate-spin inline mr-1" /> Checking…
              </span>
            ) : available.data?.available ? (
              <span className="text-primary flex items-center gap-1">
                <CheckCircle2 size={10} /> @{requested} is available
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <XCircle size={10} /> @{requested} is already claimed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
