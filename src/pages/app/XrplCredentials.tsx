import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, Loader2, Plus, Power, Trash2, Search, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";

type Network = "mainnet" | "testnet" | "devnet";

/**
 * Admin surface for the XRPL Credentials (XLS-70d) trust layer. This is
 * not yet wired into register_holder — it's a verifier we can drive
 * manually while we stand up the user-facing flow. What it does today:
 *   1. Manage the allow-list of XRPL addresses we trust as credential
 *      issuers (per network).
 *   2. Run an ad-hoc verification — "does this subject hold a valid,
 *      accepted, unexpired credential from a trusted issuer?" — and log
 *      the decision to the audit table.
 */
const XrplCredentials = () => {
  const qc = useQueryClient();

  const [network, setNetwork] = useState<Network>("mainnet");
  const [newAddress, setNewAddress] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newTypes, setNewTypes] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [verifyAddress, setVerifyAddress] = useState("");
  const [verifySolana, setVerifySolana] = useState("");
  const [verifyType, setVerifyType] = useState("");
  const [verifyResult, setVerifyResult] = useState<null | {
    clean?: boolean;
    reason?: string | null;
    credential?: any;
    trustedIssuerId?: number | null;
  }>(null);

  const issuers = useQuery({
    queryKey: ["xrplCredentials.listTrustedIssuers", network],
    queryFn: () => trpc.xrplCredentials.listTrustedIssuers.query({ network }),
  });

  const verifications = useQuery({
    queryKey: ["xrplCredentials.recentVerifications"],
    queryFn: () => trpc.xrplCredentials.recentVerifications.query({ limit: 50 }),
    refetchInterval: 20_000,
  });

  const add = useMutation({
    mutationFn: () =>
      trpc.xrplCredentials.addTrustedIssuer.mutate({
        xrplAddress: newAddress.trim(),
        displayName: newDisplayName.trim(),
        credentialTypes: newTypes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        network,
        notes: newNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Trusted issuer added.");
      setNewAddress("");
      setNewDisplayName("");
      setNewTypes("");
      setNewNotes("");
      qc.invalidateQueries({ queryKey: ["xrplCredentials.listTrustedIssuers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      trpc.xrplCredentials.setActive.mutate({ id, active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xrplCredentials.listTrustedIssuers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => trpc.xrplCredentials.remove.mutate({ id }),
    onSuccess: () => {
      toast.success("Trusted issuer removed.");
      qc.invalidateQueries({ queryKey: ["xrplCredentials.listTrustedIssuers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runVerify = useMutation({
    mutationFn: () =>
      trpc.xrplCredentials.verify.mutate({
        xrplAddress: verifyAddress.trim(),
        network,
        requiredType: verifyType.trim() || undefined,
        solanaWallet: verifySolana.trim() || undefined,
      }),
    onSuccess: (res) => {
      setVerifyResult(res);
      qc.invalidateQueries({ queryKey: ["xrplCredentials.recentVerifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/issue"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Issuer Portal
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Compliance / XRPL Credentials
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          XRPL Credentials Trust Layer
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Accept on-ledger XRPL Credentials (XLS-70d) as an alternate KYC attestation alongside
          the platform's own oracle. Manage the allow-list of trusted issuers here and run
          ad-hoc verifications against the live XRPL ledger. Every check is logged immutably.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Network
        </span>
        {(["mainnet", "testnet", "devnet"] as Network[]).map((n) => (
          <button
            key={n}
            onClick={() => setNetwork(n)}
            className={`text-[10px] uppercase tracking-widest px-2 py-1 border transition-colors ${
              network === n
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="border border-border p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Add trusted issuer
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="XRPL address (r…)"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
          <input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Display name (e.g. 'Ripple KYC Partner')"
            className="bg-background border border-border px-3 py-2 text-sm"
          />
          <input
            value={newTypes}
            onChange={(e) => setNewTypes(e.target.value)}
            placeholder="Allowed credentialTypes, comma-separated (empty = any)"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="bg-background border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => add.mutate()}
          disabled={!newAddress || !newDisplayName || add.isPending}
          className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {add.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Trust this issuer
        </button>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">#</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Address</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Name</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Types</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {issuers.isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</td></tr>
            ) : !issuers.data || issuers.data.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No trusted issuers on {network} yet.</td></tr>
            ) : issuers.data.map((row) => (
              <tr key={row.id} className="border-b border-border/30 last:border-b-0">
                <td className="p-4 text-xs font-mono text-muted-foreground">#{row.id}</td>
                <td className="p-4 text-xs font-mono">{truncateAddress(row.xrplAddress)}</td>
                <td className="p-4 text-xs">{row.displayName}</td>
                <td className="p-4 text-xs text-muted-foreground">
                  {row.credentialTypes.length === 0 ? "(any)" : row.credentialTypes.join(", ")}
                </td>
                <td className="p-4 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setActive.mutate({ id: row.id, active: false })}
                      className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary flex items-center gap-1"
                      title="Pause (credentials from this issuer will stop being accepted)"
                    >
                      <Power size={10} /> Pause
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${row.displayName} from trusted issuers?`)) remove.mutate(row.id);
                      }}
                      className="text-[10px] uppercase tracking-widest border border-red-400/30 text-red-400 px-2 py-1 hover:bg-red-400/10 flex items-center gap-1"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-border p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Ad-hoc verification
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={verifyAddress}
            onChange={(e) => setVerifyAddress(e.target.value)}
            placeholder="Subject XRPL address (r…)"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
          <input
            value={verifySolana}
            onChange={(e) => setVerifySolana(e.target.value)}
            placeholder="Linked Solana wallet (optional, for audit)"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
          <input
            value={verifyType}
            onChange={(e) => setVerifyType(e.target.value)}
            placeholder="Required credentialType hex (optional)"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          onClick={() => runVerify.mutate()}
          disabled={!verifyAddress || runVerify.isPending}
          className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {runVerify.isPending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Run verification
        </button>

        {verifyResult && (
          <div
            className={`mt-3 border p-3 text-xs ${
              verifyResult.clean ? "border-primary/40 bg-primary/5" : "border-red-400/40 bg-red-400/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {verifyResult.clean ? (
                <>
                  <CheckCircle2 size={14} className="text-primary" />
                  <span className="font-semibold text-primary">Valid credential found</span>
                </>
              ) : (
                <>
                  <XCircle size={14} className="text-red-400" />
                  <span className="font-semibold text-red-400">Rejected</span>
                </>
              )}
            </div>
            {verifyResult.reason && (
              <div className="text-muted-foreground mb-2">Reason: {verifyResult.reason}</div>
            )}
            {verifyResult.credential && (
              <pre className="font-mono text-[10px] overflow-x-auto bg-background p-2 border border-border">
                {JSON.stringify(verifyResult.credential, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Verification audit log
        </div>
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">#</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Subject</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Solana</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Network</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">When</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {verifications.isLoading ? (
                <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</td></tr>
              ) : !verifications.data || verifications.data.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">No verifications run yet.</td></tr>
              ) : verifications.data.map((r) => (
                <tr key={r.id} className="border-b border-border/30 last:border-b-0">
                  <td className="p-3 text-xs font-mono text-muted-foreground">#{r.id}</td>
                  <td className="p-3 text-xs font-mono">{truncateAddress(r.xrplAddress)}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">
                    {r.solanaWallet ? truncateAddress(r.solanaWallet) : "—"}
                  </td>
                  <td className="p-3 text-xs">{r.network}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {r.clean ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                        <CheckCircle2 size={10} /> Clean
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5"
                        title={r.reason ?? undefined}
                      >
                        <XCircle size={10} /> Rejected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default XrplCredentials;
