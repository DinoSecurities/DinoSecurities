import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Loader2, Plus, Copy, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const TIER_LIMITS: Record<number, number> = {
  0: 60,
  1: 300,
  2: 1200,
  3: 3000,
};

interface Props {
  currentTierId: number;
}

/**
 * API key management for the public REST gateway at /api/v1. Each key
 * is a bearer token the caller attaches as `Authorization: Bearer …`;
 * the owner's current $DINO tier is resolved live server-side and sets
 * the rate limit the key's requests run under.
 */
export default function ApiKeysPanel({ currentTierId }: Props) {
  const wallet = useWallet();
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<{ id: number; key: string } | null>(null);
  const [label, setLabel] = useState("");

  const keys = useQuery({
    queryKey: ["apiKeys.list"],
    queryFn: () => trpc.apiKeys.list.query(),
    enabled: !!wallet.publicKey,
  });

  const create = useMutation({
    mutationFn: () =>
      trpc.apiKeys.create.mutate({ label: label.trim() || undefined }),
    onSuccess: (res) => {
      setRevealed({ id: res.id, key: res.key });
      setLabel("");
      toast.success("API key created. Copy it now — it won't be shown again.");
      qc.invalidateQueries({ queryKey: ["apiKeys.list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => trpc.apiKeys.revoke.mutate({ id }),
    onSuccess: () => {
      toast.success("Key revoked.");
      qc.invalidateQueries({ queryKey: ["apiKeys.list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));
  const currentLimit = TIER_LIMITS[currentTierId] ?? 60;

  if (!wallet.publicKey) {
    return (
      <div className="border border-border p-4 text-xs text-muted-foreground">
        Connect a wallet to create and manage API keys.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Key size={14} className="text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Public REST API Keys
        </span>
      </div>

      <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
        Attach a key to <span className="font-mono text-foreground">/api/v1/*</span> requests as{" "}
        <span className="font-mono text-foreground">Authorization: Bearer dino_live_…</span> to
        lift the anonymous 60 req/min rate limit to your $DINO tier. Tier is read live from
        your wallet's balance at request time — no need to rotate the key when you move up a
        tier. Your current limit:{" "}
        <span className="font-mono text-foreground font-semibold">{currentLimit}</span> req/min.
      </p>

      {revealed && (
        <div className="border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-primary mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground mb-1">
              Key #{revealed.id} — copy now
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              This is the only time the plaintext key is shown. Store it in a secrets manager.
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-background border border-border px-2 py-1 flex-1 truncate">
                {revealed.key}
              </code>
              <button
                onClick={() => copy(revealed.key)}
                className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary"
              >
                <Copy size={10} className="inline mr-1" /> Copy
              </button>
              <button
                onClick={() => setRevealed(null)}
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border border-border p-3 flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Key label (e.g. 'dune-dashboard', 'prod-server')"
          className="flex-1 bg-background border border-border px-3 py-2 text-sm"
        />
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {create.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Plus size={11} />
          )}
          Create key
        </button>
      </div>

      {keys.isLoading ? (
        <div className="border border-border p-6 text-center text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin inline mr-1" /> Loading…
        </div>
      ) : !keys.data || keys.data.length === 0 ? (
        <div className="border border-border p-6 text-center text-xs text-muted-foreground">
          No API keys yet.
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Prefix</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Label</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Created</th>
                <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Last used</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.data.map((k) => (
                <tr
                  key={k.id}
                  className={`border-b border-border/30 last:border-b-0 ${
                    k.active ? "" : "opacity-60"
                  }`}
                >
                  <td className="p-3 text-xs font-mono">{k.keyPrefix}…</td>
                  <td className="p-3 text-xs text-muted-foreground">{k.label ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                  </td>
                  <td className="p-3 text-right">
                    {k.active ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {k.active && (
                      <button
                        onClick={() => {
                          if (confirm("Revoke this key? Requests using it will start failing immediately.")) {
                            revoke.mutate(k.id);
                          }
                        }}
                        className="text-[10px] uppercase tracking-widest border border-red-400/30 text-red-400 px-2 py-1 hover:bg-red-400/10 flex items-center gap-1 ml-auto"
                      >
                        <Trash2 size={10} /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
