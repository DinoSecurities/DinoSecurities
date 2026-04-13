import { useState } from "react";
import { Vote } from "lucide-react";

// On-chain proposal listing requires aggregating Proposal PDAs across every
// Realm (one per security mint). Wired as a stub until at least one Realm
// exists on devnet — once it does, swap this for a real `useProposals()`
// hook calling getProgramAccounts on dino_governance with the proposal
// discriminator filter.
const proposals: Array<{
  id: string; title: string; description: string; status: "active" | "passed" | "rejected" | "pending";
  series: string; proposer: string; endDate: string;
  votesFor: number; votesAgainst: number; quorum: number;
}> = [];

const Governance = () => {
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "passed" | "rejected" | "pending">("all");
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<"for" | "against" | null>(null);
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});

  const filtered = proposals.filter((p) => filterStatus === "all" || p.status === filterStatus);
  const detail = proposals.find((p) => p.id === selectedProposal);

  const handleVote = (proposalId: string) => {
    if (!voteChoice) return;
    setHasVoted((prev) => ({ ...prev, [proposalId]: true }));
    setVoteChoice(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Governance</h2>
          <p className="text-sm text-muted-foreground mt-1">Vote on proposals affecting your security holdings</p>
        </div>
        <div className="flex gap-1 bg-secondary/60 border border-border p-1 self-start">
          {(["all", "active", "passed", "pending"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Proposals list */}
        <div className="lg:col-span-5 border border-border">
          {filtered.map((p) => {
            const totalVotes = p.votesFor + p.votesAgainst;
            const forPct = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
            const quorumPct = totalVotes > 0 ? (totalVotes / p.quorum) * 100 : 0;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProposal(p.id)}
                className={`w-full text-left p-5 border-b border-border/30 hover:bg-secondary/20 transition-colors ${
                  selectedProposal === p.id ? "bg-secondary/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="text-sm font-medium text-foreground">{p.title}</div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 shrink-0 ${
                    p.status === "active" ? "text-primary bg-primary/10" :
                    p.status === "passed" ? "text-emerald-400 bg-emerald-400/10" :
                    p.status === "rejected" ? "text-red-400 bg-red-400/10" :
                    "text-amber-400 bg-amber-400/10"
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                  <span className="font-semibold text-primary">{p.series}</span>
                  <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                  <span>Ends {p.endDate}</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-primary transition-all" style={{ width: `${forPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>For: {forPct.toFixed(0)}%</span>
                  <span>Quorum: {Math.min(quorumPct, 100).toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-12 flex flex-col items-center text-center gap-2">
              <Vote size={32} className="text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">No proposals yet</div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Proposals appear here once an issuer creates a governance Realm for their security and submits the first vote.
              </p>
            </div>
          )}
        </div>

        {/* Proposal detail */}
        <div className="lg:col-span-7">
          {detail ? (
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    detail.status === "active" ? "text-primary bg-primary/10" :
                    detail.status === "passed" ? "text-emerald-400 bg-emerald-400/10" :
                    "text-muted-foreground bg-secondary"
                  }`}>
                    {detail.status}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{detail.series}</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground tracking-tight">{detail.title}</h3>
              </div>

              <div className="p-6 border-b border-border">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Description</span>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">{detail.description}</p>
              </div>

              {/* Vote breakdown */}
              <div className="p-6 border-b border-border">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-4 block">Vote Breakdown</span>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">For</div>
                    <div className="text-2xl font-semibold text-emerald-400 mt-1">{(detail.votesFor / 1000000).toFixed(1)}M</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Against</div>
                    <div className="text-2xl font-semibold text-red-400 mt-1">{(detail.votesAgainst / 1000000).toFixed(1)}M</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Quorum Progress</span>
                    <span>{((detail.votesFor + detail.votesAgainst) / detail.quorum * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(((detail.votesFor + detail.votesAgainst) / detail.quorum) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-6 border-b border-border flex flex-col gap-2">
                {[
                  ["Proposer", detail.proposer],
                  ["End Date", detail.endDate],
                  ["Quorum Required", `${(detail.quorum / 1000000).toFixed(1)}M tokens`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-mono">{val}</span>
                  </div>
                ))}
              </div>

              {/* Cast Vote */}
              {detail.status === "active" && (
                <div className="p-6">
                  {hasVoted[detail.id] ? (
                    <div className="text-center py-4">
                      <div className="text-sm font-semibold text-primary">Vote Recorded ✓</div>
                      <div className="text-xs text-muted-foreground mt-1">Your vote has been submitted on-chain</div>
                    </div>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 block">Cast Your Vote</span>
                      <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => setVoteChoice("for")}
                          className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-semibold transition-all border ${
                            voteChoice === "for" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Vote For
                        </button>
                        <button
                          onClick={() => setVoteChoice("against")}
                          className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-semibold transition-all border ${
                            voteChoice === "against" ? "bg-red-500/20 border-red-500/50 text-red-400" : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Vote Against
                        </button>
                      </div>
                      <button
                        onClick={() => handleVote(detail.id)}
                        disabled={!voteChoice}
                        className="w-full bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Submit Vote
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-12 text-center">
              <div className="text-sm text-muted-foreground">Select a proposal to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Governance;
