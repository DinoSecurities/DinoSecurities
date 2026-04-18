import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Coins, Loader2, Plus, CheckCircle2, XCircle, Clock,
} from "lucide-react";
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

const CommunityGovernance = () => {
  const q = useQuery({
    queryKey: ["community.list"],
    queryFn: () => trpc.community.list.query({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const rows = q.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Dashboard
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Community / Governance
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Community Proposals
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            $DINO-weighted advisory polls on marketing, feature priorities, community grants,
            and community events. Bronze-tier holders (100,000 $DINO) can vote; Gold-tier
            holders (5,000,000 $DINO) can create proposals.
          </p>
        </div>
        <Link
          to="/app/community/governance/new"
          className="flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30"
        >
          <Plus size={12} /> New proposal
        </Link>
      </div>

      <NonSecurityBanner />

      {q.isLoading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Loading proposals…
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-border p-12 text-center flex flex-col items-center gap-2">
          <Coins size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No proposals yet</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            The first Gold-tier holder to file a proposal sets the tone. Outcomes are
            advisory — no on-chain execution.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p) => {
            const total = p.tally.yes + p.tally.no + p.tally.abstain;
            const yesPct = total > 0 ? Math.round((p.tally.yes / total) * 100) : 0;
            const noPct = total > 0 ? Math.round((p.tally.no / total) * 100) : 0;
            const active = p.status === "voting";
            return (
              <Link
                key={p.id}
                to={`/app/community/governance/${p.id}`}
                className="border border-border hover:border-primary/40 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                        {active ? "Voting" : "Closed"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground mb-1">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      by <HolderName wallet={p.createdBy} /> ·{" "}
                      {active
                        ? `ends ${new Date(p.votingEndsAt).toLocaleString()}`
                        : `closed ${new Date(p.votingEndsAt).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Advisory tally
                    </div>
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <span className="text-sm font-mono text-emerald-400">{yesPct}%</span>
                      <span className="text-[10px] text-muted-foreground">yes</span>
                      <span className="text-sm font-mono text-red-400 ml-2">{noPct}%</span>
                      <span className="text-[10px] text-muted-foreground">no</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.tally.voterCount} voter{p.tally.voterCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityGovernance;
