import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Vote, Plus, Clock, CheckCircle2, XCircle, Hourglass, AlertTriangle, ArrowLeft } from "lucide-react";
import { useMyTokenBalances } from "@/hooks/useTokenBalance";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";
import {
  useProposals,
  useRealm,
  useCastVote,
  useCreateProposal,
  useCreateRealm,
  useFinalizeProposal,
  useExecuteProposal,
} from "@/hooks/useGovernance";
import { PROPOSAL_TYPES, type ProposalType } from "@/lib/governanceActions";
import { truncateAddress } from "@/lib/solana";

type Proposal = NonNullable<ReturnType<typeof useProposals>["data"]>[number];

const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  UpdateLegalDoc: "Update Legal Document",
  MintAdditional: "Mint Additional Supply",
  EmergencyPause: "Emergency Pause",
};

const PROPOSAL_TYPE_DESC: Record<ProposalType, string> = {
  UpdateLegalDoc: "Replace the series' governing Ricardian document. The new Arweave URI and SHA-256 hash become the source of truth once the proposal executes.",
  MintAdditional: "Issue new supply of this security. Dilutes existing holders — passes only with majority holder approval.",
  EmergencyPause: "Pause all transfers on this series. Shorter 6-hour cooloff so issuers can react fast to compliance events.",
};

function timeLeft(target: Date | string | null | undefined): string {
  if (!target) return "—";
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    voting: "bg-amber-400/10 text-amber-400 border-amber-400/40",
    succeeded: "bg-emerald-400/10 text-emerald-400 border-emerald-400/40",
    defeated: "bg-red-400/10 text-red-400 border-red-400/40",
    executed: "bg-primary/10 text-primary border-primary/40",
    cancelled: "bg-muted/20 text-muted-foreground border-border",
  };
  const icon: Record<string, JSX.Element> = {
    voting: <Hourglass size={11} />,
    succeeded: <CheckCircle2 size={11} />,
    defeated: <XCircle size={11} />,
    executed: <CheckCircle2 size={11} />,
    cancelled: <XCircle size={11} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-widest border font-semibold ${styles[status] ?? styles.cancelled}`}>
      {icon[status] ?? <Clock size={11} />}
      {status}
    </span>
  );
}

const Governance = () => {
  const { publicKey } = useWallet();
  const { data: balances } = useMyTokenBalances();
  const { data: securities } = useIndexedSecurities();
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [selectedProposalPda, setSelectedProposalPda] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Series the user can govern — either they hold tokens, or they're the issuer.
  const governable = useMemo(() => {
    const mints = new Set<string>();
    balances?.forEach((b) => b.balance > 0 && mints.add(b.mint));
    securities?.forEach((s) => {
      if (publicKey && s.issuer === publicKey.toBase58()) mints.add(s.mintAddress);
    });
    return securities?.filter((s) => mints.has(s.mintAddress)) ?? [];
  }, [balances, securities, publicKey]);

  // Default to the first series once we have one.
  const activeMint = selectedMint ?? governable[0]?.mintAddress ?? null;
  const activeSeries = governable.find((s) => s.mintAddress === activeMint);

  const realm = useRealm(activeMint);
  const proposals = useProposals(activeMint);
  const selectedProposal = proposals.data?.find((p) => p.proposalPda === selectedProposalPda);

  const createRealm = useCreateRealm();

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Vote size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Connect a wallet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Governance is per-security. Connect the wallet that holds the security tokens you want to vote with, or the issuer wallet that created a series.
        </p>
      </div>
    );
  }

  if (governable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Vote size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">No governable series</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You need to either hold tokens of a security series, or be the issuer of one, to participate in governance. Issue a series in the Issuer Portal or acquire tokens on the Marketplace to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Governance</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each security series is its own DAO. Token-weighted voting — 1 token = 1 vote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeMint ?? ""}
            onChange={(e) => { setSelectedMint(e.target.value); setSelectedProposalPda(null); }}
            className="bg-secondary border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50"
          >
            {governable.map((s) => (
              <option key={s.mintAddress} value={s.mintAddress}>
                {s.symbol} — {s.name}
              </option>
            ))}
          </select>
          {realm.data && (
            <button
              onClick={() => { setShowCreate(true); setSelectedProposalPda(null); }}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] uppercase tracking-widest font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={12} /> Propose
            </button>
          )}
        </div>
      </div>

      {realm.isLoading && (
        <div className="p-6 border border-border text-sm text-muted-foreground">Loading realm…</div>
      )}
      {!realm.isLoading && !realm.data && activeSeries && (
        <div className="p-6 border border-amber-500/40 bg-amber-500/5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-foreground">No governance realm yet</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A one-time <code className="text-primary">create_realm</code> transaction initializes the DAO for <strong>{activeSeries.symbol}</strong>. Only the issuer <code>{truncateAddress(activeSeries.issuer)}</code> should run this.
            Default parameters: 50% vote threshold, 10% quorum, 3-day voting, 48-hour execution cooloff.
          </p>
          <div>
            <button
              onClick={() => createRealm.mutate({ mint: activeMint! })}
              disabled={createRealm.isPending || activeSeries.issuer !== publicKey.toBase58()}
              className="bg-primary text-primary-foreground px-4 py-2 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {createRealm.isPending ? "Creating…" : "Create Realm"}
            </button>
            {activeSeries.issuer !== publicKey.toBase58() && (
              <span className="ml-3 text-[10px] text-muted-foreground">
                Only the issuer can bootstrap this realm.
              </span>
            )}
          </div>
        </div>
      )}

      {realm.data && !showCreate && !selectedProposal && (
        <RealmOverview realm={realm.data} />
      )}

      {realm.data && !showCreate && !selectedProposal && (
        <div className="border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Proposals · {proposals.data?.length ?? 0}
            </span>
          </div>
          {proposals.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading proposals…</div>
          )}
          {!proposals.isLoading && (proposals.data?.length ?? 0) === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No proposals yet. Be the first to propose.
            </div>
          )}
          {(proposals.data ?? []).map((p) => (
            <button
              key={p.proposalPda}
              onClick={() => setSelectedProposalPda(p.proposalPda)}
              className="w-full p-4 border-b border-border last:border-0 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={p.status} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {PROPOSAL_TYPE_LABELS[p.proposalType as ProposalType] ?? p.proposalType}
                  </span>
                </div>
                <div className="text-sm text-foreground font-medium">{p.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  by {truncateAddress(p.proposer)} · ends in {timeLeft(p.votingEndsAt)}
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <div><span className="text-emerald-400 font-semibold">{Number(p.yesVotes).toLocaleString()}</span> yes</div>
                <div><span className="text-red-400 font-semibold">{Number(p.noVotes).toLocaleString()}</span> no</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedProposal && (
        <ProposalDetail
          proposal={selectedProposal}
          mint={activeMint!}
          onBack={() => setSelectedProposalPda(null)}
        />
      )}

      {showCreate && realm.data && activeMint && (
        <CreateProposalWizard
          mint={activeMint}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); proposals.refetch(); }}
        />
      )}
    </div>
  );
};

function RealmOverview({ realm }: { realm: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-border">
      {[
        ["Threshold", `${(realm.voteThresholdBps / 100).toFixed(0)}%`],
        ["Quorum", `${(realm.quorumBps / 100).toFixed(0)}%`],
        ["Voting period", `${Math.round(realm.votingPeriodSec / 86400)} days`],
        ["Timelock", `${Math.round(realm.cooloffPeriodSec / 3600)} h`],
        ["Proposals", `${realm.proposalCount ?? 0}`],
      ].map(([label, val], i, a) => (
        <div key={label} className={`p-4 ${i < a.length - 1 ? "border-b md:border-b-0 md:border-r" : ""} border-border`}>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
          <div className="text-lg font-semibold text-foreground mt-1">{val}</div>
        </div>
      ))}
    </div>
  );
}

function ProposalDetail({
  proposal, mint, onBack,
}: {
  proposal: Proposal; mint: string; onBack: () => void;
}) {
  const { publicKey } = useWallet();
  const castVote = useCastVote();
  const finalize = useFinalizeProposal();
  const execute = useExecuteProposal();
  const votingEnded = new Date(proposal.votingEndsAt).getTime() <= Date.now();
  const executionReady = new Date(proposal.executionEta).getTime() <= Date.now();
  const totalVotes = Number(proposal.yesVotes) + Number(proposal.noVotes) + Number(proposal.abstainVotes);
  const pctYes = totalVotes > 0 ? (Number(proposal.yesVotes) / totalVotes) * 100 : 0;
  const pctNo = totalVotes > 0 ? (Number(proposal.noVotes) / totalVotes) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={12} /> Back to proposals
      </button>

      <div className="p-6 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={proposal.status} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {PROPOSAL_TYPE_LABELS[proposal.proposalType as ProposalType] ?? proposal.proposalType}
          </span>
        </div>
        <h3 className="text-xl font-semibold text-foreground">{proposal.title}</h3>
        {proposal.descriptionUri && (
          <a href={proposal.descriptionUri.startsWith("http") ? proposal.descriptionUri : `https://arweave.net/${proposal.descriptionUri.replace("ar://", "")}`}
             target="_blank" rel="noopener noreferrer"
             className="text-[11px] text-primary hover:underline">
            Read full description →
          </a>
        )}
        <div className="text-[11px] text-muted-foreground">
          Proposer: <span className="font-mono">{truncateAddress(proposal.proposer)}</span>
          &nbsp;·&nbsp; Voting ends: {timeLeft(proposal.votingEndsAt)}
          &nbsp;·&nbsp; Execution eta: {timeLeft(proposal.executionEta)}
        </div>
      </div>

      <div className="p-6 border border-border flex flex-col gap-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Vote tally</div>
        <div className="flex h-3 bg-secondary border border-border overflow-hidden">
          <div className="bg-emerald-400" style={{ width: `${pctYes}%` }} />
          <div className="bg-red-400" style={{ width: `${pctNo}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Yes</div>
            <div className="text-2xl font-semibold text-emerald-400">{Number(proposal.yesVotes).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">No</div>
            <div className="text-2xl font-semibold text-red-400">{Number(proposal.noVotes).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Abstain</div>
            <div className="text-2xl font-semibold text-muted-foreground">{Number(proposal.abstainVotes).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {proposal.status === "voting" && !votingEnded && (
        <div className="p-6 border border-border flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Cast your vote</div>
          <div className="grid grid-cols-3 gap-2">
            {(["Yes", "No", "Abstain"] as const).map((choice) => (
              <button
                key={choice}
                onClick={() => castVote.mutate({ proposalPda: proposal.proposalPda, mint, choice })}
                disabled={castVote.isPending || !publicKey}
                className={`p-3 text-xs font-semibold text-center border transition-colors disabled:opacity-50 ${
                  choice === "Yes" ? "border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10" :
                  choice === "No" ? "border-red-400/50 text-red-400 hover:bg-red-400/10" :
                  "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{choice}</button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Your vote weight = your security-token balance at the time of casting. One vote per wallet per proposal.</p>
        </div>
      )}

      {proposal.status === "voting" && votingEnded && (
        <div className="p-4 border border-amber-400/40 bg-amber-400/5 flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">Voting ended — anyone can now finalize the tally.</span>
          <button onClick={() => finalize.mutate({ proposalPda: proposal.proposalPda, mint })} disabled={finalize.isPending}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90">
            {finalize.isPending ? "Finalizing…" : "Finalize"}
          </button>
        </div>
      )}

      {proposal.status === "succeeded" && (
        <div className="p-4 border border-primary/40 bg-primary/5 flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">
            {executionReady ? "Timelock cleared — ready to execute." : `Timelock active — executable in ${timeLeft(proposal.executionEta)}.`}
          </span>
          <button onClick={() => execute.mutate({ proposalPda: proposal.proposalPda, mint })}
                  disabled={execute.isPending || !executionReady}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90">
            {execute.isPending ? "Executing…" : "Execute"}
          </button>
        </div>
      )}
    </div>
  );
}

function CreateProposalWizard({
  mint, onClose, onCreated,
}: {
  mint: string; onClose: () => void; onCreated: () => void;
}) {
  const [type, setType] = useState<ProposalType>("UpdateLegalDoc");
  const [title, setTitle] = useState("");
  const [descriptionUri, setDescriptionUri] = useState("");
  const create = useCreateProposal(mint);

  const submit = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({ type, title, descriptionUri });
    onCreated();
  };

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onClose} className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={12} /> Cancel
      </button>

      <div className="p-6 border border-border flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Proposal type</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            {PROPOSAL_TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                      className={`p-3 text-xs font-semibold text-center border transition-colors ${
                        type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      }`}>
                {PROPOSAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{PROPOSAL_TYPE_DESC[type]}</p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={128}
                 placeholder="Short, descriptive"
                 className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Description URL <span className="opacity-60">(optional — Arweave or any public URL with full details)</span>
          </label>
          <input value={descriptionUri} onChange={(e) => setDescriptionUri(e.target.value)} maxLength={200}
                 placeholder="ar://… or https://…"
                 className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50" />
        </div>

        <div className="text-[11px] text-muted-foreground">
          Anyone holding at least 1 security token can submit. Vote weight at cast time is your balance then, not now. Execution has a timelock: {type === "EmergencyPause" ? "6 hours" : "48 hours"} after vote passes.
        </div>

        <div className="flex gap-3">
          <button onClick={submit} disabled={!title.trim() || create.isPending}
                  className="bg-primary text-primary-foreground px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90">
            {create.isPending ? "Submitting…" : "Submit proposal"}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default Governance;
