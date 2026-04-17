import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, Loader2, Copy, CheckCircle2, XCircle, Link2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";
import { useIndexedSecurityByMint } from "@/hooks/useIndexedSecurities";

type Network = "mainnet" | "testnet" | "devnet";

/**
 * Holder self-serve XRPL-credentials whitelist flow.
 *
 * Walks the connected Solana wallet through:
 *   1. Claim an XRPL address + network.
 *   2. Request a challenge — the server issues a nonce bound to the
 *      (solanaWallet, xrplAddress, network) triple.
 *   3. Holder signs the challenge message with their XRPL wallet
 *      (Xaman, Gem, Crossmark — whatever exposes raw message signing)
 *      and pastes back the signature + public key.
 *   4. Server verifies, records the binding, and we submit a whitelist
 *      request that runs credential verification end-to-end.
 *   5. Issuer sees the pending request on their portal and one-click
 *      approves — at which point register_holder cosigns with
 *      kyc_source = 'xrpl_credential' and the holder is whitelisted.
 */
const XrplWhitelist = () => {
  const { mint } = useParams<{ mint: string }>();
  const wallet = useWallet();
  const qc = useQueryClient();
  const sec = useIndexedSecurityByMint(mint);

  const [network, setNetwork] = useState<Network>("mainnet");
  const [xrplAddress, setXrplAddress] = useState("");
  const [jurisdiction, setJurisdiction] = useState("US");
  const [challenge, setChallenge] = useState<null | {
    challengeId: number;
    nonce: string;
    message: string;
    expiresAt: string;
  }>(null);
  const [signatureHex, setSignatureHex] = useState("");
  const [publicKeyHex, setPublicKeyHex] = useState("");
  const [bound, setBound] = useState(false);

  const myRequests = useQuery({
    queryKey: ["xrplCredentials.myRequests"],
    queryFn: () => trpc.xrplCredentials.myRequests.query(),
    enabled: !!wallet.publicKey,
    refetchInterval: 15_000,
  });

  const issuers = useQuery({
    queryKey: ["xrplCredentials.listTrustedIssuers", network],
    queryFn: () => trpc.xrplCredentials.listTrustedIssuers.query({ network }),
  });

  const requestChallenge = useMutation({
    mutationFn: () =>
      trpc.xrplCredentials.issueChallenge.mutate({
        xrplAddress: xrplAddress.trim(),
        network,
      }),
    onSuccess: (res) => {
      setChallenge(res);
      setBound(false);
      toast.success("Challenge issued. Sign the message with your XRPL wallet.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bind = useMutation({
    mutationFn: () =>
      trpc.xrplCredentials.completeBinding.mutate({
        challengeId: challenge!.challengeId,
        signatureHex: signatureHex.trim(),
        publicKeyHex: publicKeyHex.trim(),
      }),
    onSuccess: () => {
      setBound(true);
      toast.success("XRPL wallet binding confirmed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () =>
      trpc.xrplCredentials.submitWhitelistRequest.mutate({
        seriesMint: mint!,
        xrplAddress: xrplAddress.trim(),
        network,
        jurisdiction,
      }),
    onSuccess: () => {
      toast.success("Whitelist request submitted to the issuer.");
      qc.invalidateQueries({ queryKey: ["xrplCredentials.myRequests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={`/app/marketplace/${mint}`}
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to security
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Whitelist · XRPL Credentials
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Qualify with an XRPL Credential
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          If a trusted KYC provider has issued you an on-ledger credential on XRPL, you can use
          it to qualify for{" "}
          <span className="font-mono text-foreground">
            {sec.data?.symbol ?? (mint ? truncateAddress(mint) : "this series")}
          </span>{" "}
          — no re-running of KYC with the platform's own oracle. You'll be asked to prove you
          control the XRPL address by signing a short challenge.
        </p>
      </div>

      {!wallet.publicKey && (
        <div className="border border-amber-400/40 bg-amber-400/5 text-amber-400 text-xs p-4">
          Connect your Solana wallet to begin. The Solana wallet you connect is the one that
          will get whitelisted on-chain.
        </div>
      )}

      <div className="border border-border p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          1. Claim your XRPL address
        </div>
        <div className="flex items-center gap-2 mb-3">
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
        <input
          value={xrplAddress}
          onChange={(e) => setXrplAddress(e.target.value)}
          placeholder="Your XRPL address (r…)"
          className="w-full bg-background border border-border px-3 py-2 text-sm font-mono mb-3"
        />
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Jurisdiction
          </span>
          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
            className="w-20 bg-background border border-border px-3 py-2 text-sm font-mono"
            maxLength={2}
          />
          <span className="text-[10px] text-muted-foreground">2-letter ISO</span>
        </div>
        <button
          onClick={() => requestChallenge.mutate()}
          disabled={!wallet.publicKey || !xrplAddress || requestChallenge.isPending}
          className="flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {requestChallenge.isPending ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
          Issue challenge
        </button>

        {issuers.data && issuers.data.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Trusted issuers on {network}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {issuers.data.map((i) => (
                <span
                  key={i.id}
                  className="text-[10px] bg-secondary/30 border border-border px-2 py-0.5 font-mono"
                  title={i.xrplAddress}
                >
                  {i.displayName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {challenge && (
        <div className="border border-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
            2. Sign this message with your XRPL wallet
          </div>
          <div className="bg-background border border-border p-3 mb-3">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {challenge.message}
            </pre>
            <button
              onClick={() => copy(challenge.message)}
              className="mt-2 text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary flex items-center gap-1"
            >
              <Copy size={10} /> Copy message
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Use your XRPL wallet's "sign arbitrary message" feature. Paste the resulting
            signature and public key below. Challenge expires at{" "}
            {new Date(challenge.expiresAt).toLocaleTimeString()}.
          </p>
          <div className="grid gap-3">
            <input
              value={publicKeyHex}
              onChange={(e) => setPublicKeyHex(e.target.value)}
              placeholder="XRPL public key (hex) — ED… for ed25519 or 02…/03… for secp256k1"
              className="bg-background border border-border px-3 py-2 text-sm font-mono"
            />
            <textarea
              value={signatureHex}
              onChange={(e) => setSignatureHex(e.target.value)}
              placeholder="Signature (hex)"
              rows={3}
              className="bg-background border border-border px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            onClick={() => bind.mutate()}
            disabled={!signatureHex || !publicKeyHex || bind.isPending}
            className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {bind.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            Verify binding
          </button>

          {bound && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-primary">
              <CheckCircle2 size={14} /> Binding confirmed. You can now submit your whitelist
              request.
            </div>
          )}
        </div>
      )}

      {bound && (
        <div className="border border-primary/40 bg-primary/5 p-4">
          <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
            3. Submit whitelist request
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            We'll query XRPL for an active credential from a trusted issuer on{" "}
            {network}. If found, the issuer of this series will see a pending request to
            whitelist you.
          </p>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary text-primary-foreground px-3 py-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submit.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Submit to issuer
          </button>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Your XRPL whitelist requests
        </div>
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Series</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">XRPL</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Network</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Submitted</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.isLoading ? (
                <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</td></tr>
              ) : !myRequests.data || myRequests.data.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No whitelist requests yet.</td></tr>
              ) : myRequests.data.map((r) => (
                <tr key={r.id} className="border-b border-border/30 last:border-b-0">
                  <td className="p-3 text-xs font-mono">{truncateAddress(r.seriesMint)}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">{truncateAddress(r.xrplAddress)}</td>
                  <td className="p-3 text-xs">{r.network}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                  <td className="p-3 text-right">
                    {r.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                        <CheckCircle2 size={10} /> Whitelisted
                      </span>
                    ) : r.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5" title={r.rejectionReason ?? undefined}>
                        <XCircle size={10} /> Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5">
                        <Loader2 size={10} className="animate-spin" /> Pending
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

export default XrplWhitelist;
