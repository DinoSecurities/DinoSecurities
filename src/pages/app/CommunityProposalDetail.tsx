import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ThumbsUp, ThumbsDown, MinusCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import NonSecurityBanner from "@/components/NonSecurityBanner";
import HolderName from "@/components/HolderName";

const TYPE_LABELS: Record<string, string> = {
  marketing_budget: "Marketing budget",
  feature_request: "Feature request",
  community_grant: "Community grant",
  community_event: "Community event",
  generic: "General",
};

const CommunityProposalDetail = () => {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const qc = useQueryClient();
  const proposalId = Number(id);

  const q = useQuery({
    queryKey: ["community.get", proposalId, wallet.publicKey?.toBase58()],
    queryFn: () =>
      trpc.community.get.query({
        id: proposalId,
        viewerWallet: wallet.publicKey?.toBase58(),
      }),
    refetchInterval: 20_000,
    enabled: !isNaN(proposalId),
  });

  const vote = useMutation({
    mutationFn: (choice: "yes" | "no" | "abstain") =>
      trpc.community.castVote.mutate({ proposalId, choice }),
    onSuccess: () => {
      toast.success("Vote recorded.");
      qc.invalidateQueries({ queryKey: ["community.get"] });
      qc.invalidateQueries({ queryKey: ["community.list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 size={20} className="animate-spin inline mr-2" /> Loading proposal…
      </div>
    );
  }

  if (!q.data) {
    return (
      <div className="flex flex-col gap-6">
        <Link to="/app/community/governance" className="text-xs text-muted-foreground">
          ← Back
        </Link>
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          Proposal not found.
        </div>
      </div>
    );
  }

  const p = q.data;
  const total = p.tally.yes + p.tally.no + p.tally.abstain;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const active = p.status === "voting";

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/community/governance"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to proposals
      </Link>

      <NonSecurityBanner />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground bg-secondary/30 border border-border px-1.5 py-0.5">
              {TYPE_LABELS[p.proposalType] ?? p.proposalType}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 ${
                active
                  ? "text-primary bg-primary/10 border border-primary/30"
                  : "text-muted-foreground bg-secondary/30 border border-border"
              }`}
            >
              {active ? <Clock size={9} /> : <CheckCircle2 size={9} />}
              {active ? `Ends ${new Date(p.votingEndsAt).toLocaleString()}` : "Voting closed"}
            </span>
            <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
              #{p.id}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            {p.title}
          </h2>
          <div className="text-[11px] text-muted-foreground mt-1">
            proposed by <HolderName wallet={p.createdBy} /> ·{" "}
            {new Date(p.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="border border-border p-5">
        <div className="prose prose-invert prose-sm max-w-none text-sm text-foreground whitespace-pre-wrap">
          {p.description}
        </div>
      </div>

      <div className="border border-border p-5 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Current tally (advisory only)
        </div>

        <div className="flex flex-col gap-2">
          <TallyRow label="Yes" value={p.tally.yes} pct={pct(p.tally.yes)} color="bg-emerald-400" />
          <TallyRow label="No" value={p.tally.no} pct={pct(p.tally.no)} color="bg-red-400" />
          <TallyRow label="Abstain" value={p.tally.abstain} pct={pct(p.tally.abstain)} color="bg-muted-foreground/40" />
        </div>

        <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
          {p.tally.voterCount} voter{p.tally.voterCount === 1 ? "" : "s"} · weight in raw
          $DINO balance at time of each vote
        </div>
      </div>

      {active && wallet.publicKey && (
        <div className="border border-primary/30 bg-primary/5 p-5 flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Cast your vote
          </div>
          {p.viewerVote && (
            <div className="text-xs text-muted-foreground">
              You currently voted{" "}
              <span className="font-semibold text-foreground">{p.viewerVote}</span>. Submitting
              again rewrites your choice with your current $DINO balance as weight.
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => vote.mutate("yes")}
              disabled={vote.isPending}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest bg-emerald-400/10 border border-emerald-400/40 text-emerald-400 px-3 py-2 hover:bg-emerald-400/20"
            >
              <ThumbsUp size={11} /> Yes
            </button>
            <button
              onClick={() => vote.mutate("no")}
              disabled={vote.isPending}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest bg-red-400/10 border border-red-400/40 text-red-400 px-3 py-2 hover:bg-red-400/20"
            >
              <ThumbsDown size={11} /> No
            </button>
            <button
              onClick={() => vote.mutate("abstain")}
              disabled={vote.isPending}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest border border-border text-muted-foreground px-3 py-2 hover:bg-secondary"
            >
              <MinusCircle size={11} /> Abstain
            </button>
            {vote.isPending && <Loader2 size={14} className="animate-spin self-center text-primary" />}
          </div>
          {p.viewerBalance !== null && (
            <div className="text-[10px] text-muted-foreground">
              Your current $DINO balance:{" "}
              <span className="font-mono text-foreground">
                {p.viewerBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>{" "}
              — this is the weight that will be recorded on your vote.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function TallyRow({
  label, value, pct, color,
}: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-foreground font-semibold">{label}</span>
        <span className="text-muted-foreground font-mono">
          {value.toLocaleString()} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full bg-secondary/40">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default CommunityProposalDetail;
