import { Link } from "react-router-dom";
import { Vote, ArrowLeft } from "lucide-react";

const GovernanceComingSoon = () => (
  <div className="flex flex-col items-center justify-center py-32 text-center max-w-xl mx-auto">
    <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center mb-5">
      <Vote size={28} className="text-primary" />
    </div>
    <h2 className="text-2xl font-semibold text-foreground mb-3">Governance — coming soon</h2>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Per-series DAO voting is fully implemented in the <code>dino_governance</code> program on
      mainnet, with an indexing pipeline and a full UI wired behind the scenes. We're
      holding the user-facing flow back until we've end-to-end verified the
      realm-creation, proposal, vote, and timelock-execute path on real
      mainnet state. When that's done, this tab will open.
    </p>
    <Link
      to="/app"
      className="mt-6 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary font-semibold hover:underline"
    >
      <ArrowLeft size={12} /> Back to dashboard
    </Link>
  </div>
);

export default GovernanceComingSoon;
