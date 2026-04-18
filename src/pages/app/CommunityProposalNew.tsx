import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send, Lock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useDinoTier } from "@/hooks/useDinoBalance";
import NonSecurityBanner from "@/components/NonSecurityBanner";

const TYPE_OPTIONS = [
  { value: "marketing_budget", label: "Marketing budget" },
  { value: "feature_request", label: "Feature request" },
  { value: "community_grant", label: "Community grant" },
  { value: "community_event", label: "Community event" },
  { value: "generic", label: "General" },
] as const;

const DURATION_OPTIONS = [
  { value: 2 * 24 * 3600, label: "2 days" },
  { value: 3 * 24 * 3600, label: "3 days" },
  { value: 7 * 24 * 3600, label: "7 days" },
  { value: 14 * 24 * 3600, label: "14 days" },
];

const CommunityProposalNew = () => {
  const navigate = useNavigate();
  const { tier, loading } = useDinoTier();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposalType, setProposalType] = useState<typeof TYPE_OPTIONS[number]["value"]>("generic");
  const [votingDurationSec, setVotingDurationSec] = useState(7 * 24 * 3600);
  const [disclosureAck, setDisclosureAck] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      trpc.community.create.mutate({
        title: title.trim(),
        description: description.trim(),
        proposalType,
        votingDurationSec,
        disclosureAck,
      }),
    onSuccess: (res) => {
      toast.success("Proposal submitted.");
      navigate(`/app/community/governance/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const belowBar = tier.id < 3;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/community/governance"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to proposals
      </Link>

      <div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          New Community Proposal
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Gold-tier $DINO holders (5,000,000 $DINO) file advisory proposals the community
          votes on. Outcomes inform — but do not bind — the DinoSecurities team.
        </p>
      </div>

      <NonSecurityBanner />

      {loading ? (
        <div className="border border-border p-6 text-center text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin inline mr-2" /> Checking your tier…
        </div>
      ) : belowBar ? (
        <div className="border border-amber-400/30 bg-amber-400/5 p-6 flex items-start gap-3">
          <Lock size={16} className="text-amber-400 mt-1 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground mb-1">Gold tier required</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Proposal creation is gated at Gold (5,000,000 $DINO). Your current tier is{" "}
              <span className="font-semibold text-foreground">{tier.name}</span>. Any Bronze-
              or-higher holder can still vote on existing proposals.
            </p>
            <Link
              to="/app/dino"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary hover:underline"
            >
              View $DINO tiers →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="border border-border p-4 flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Proposal type
            </label>
            <select
              value={proposalType}
              onChange={(e) => setProposalType(e.target.value as any)}
              className="bg-background border border-border px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-border p-4 flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="8–120 characters"
              maxLength={120}
              className="bg-background border border-border px-3 py-2 text-sm"
            />
            <div className="text-[10px] text-muted-foreground">{title.length} / 120</div>
          </div>

          <div className="border border-border p-4 flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Description (markdown)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the community is voting on. 40–10,000 characters. Content referencing a specific security, a Solana address, or securities-authority language (delist / halt / freeze / clawback) will be rejected."
              rows={10}
              maxLength={10_000}
              className="bg-background border border-border px-3 py-2 text-sm font-mono"
            />
            <div className="text-[10px] text-muted-foreground">{description.length} / 10,000</div>
          </div>

          <div className="border border-border p-4 flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Voting duration
            </label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setVotingDurationSec(o.value)}
                  className={`text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                    votingDurationSec === o.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 border border-amber-400/30 bg-amber-400/5 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={disclosureAck}
              onChange={(e) => setDisclosureAck(e.target.checked)}
              className="mt-1"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I acknowledge this proposal is <span className="text-foreground font-semibold">advisory only</span>.
              The vote will not execute on-chain, move any treasury, or affect any regulated
              security on the platform. Outcomes are a community signal; implementation is
              at the platform team's discretion.
            </span>
          </label>

          <div className="flex justify-end">
            <button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !disclosureAck ||
                title.trim().length < 8 ||
                description.trim().length < 40
              }
              className="flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {create.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              Submit proposal
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CommunityProposalNew;
