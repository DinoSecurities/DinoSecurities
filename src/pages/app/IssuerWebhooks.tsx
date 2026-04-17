import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Webhook, Loader2, Plus, RefreshCw, Power, Trash2, Copy, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";
import { useIndexedSecurityByMint } from "@/hooks/useIndexedSecurities";

const EVENT_OPTIONS = [
  { value: "HolderRegistered", label: "Holder registered" },
  { value: "HolderRevoked", label: "Holder revoked" },
  { value: "SettlementExecuted", label: "Settlement executed" },
  { value: "Transfer", label: "Transfer" },
] as const;

/**
 * Issuer-facing webhook management for a single series. List existing hooks,
 * add a new one (URL + event mask), rotate the HMAC secret, toggle active,
 * delete, and peek at the last 50 delivery attempts per hook. The secret
 * returned on create/rotate is shown exactly once — matches the Stripe
 * pattern so integrators already know the drill.
 */
const IssuerWebhooks = () => {
  const { mint } = useParams<{ mint: string }>();
  const qc = useQueryClient();
  const sec = useIndexedSecurityByMint(mint);

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["HolderRegistered", "SettlementExecuted"]);
  const [revealed, setRevealed] = useState<{ id: number; secret: string } | null>(null);
  const [openDeliveries, setOpenDeliveries] = useState<number | null>(null);

  const hooks = useQuery({
    queryKey: ["webhooks.list", mint],
    queryFn: () => trpc.webhooks.list.query({ seriesMint: mint! }),
    enabled: !!mint,
    refetchInterval: 20_000,
  });

  const create = useMutation({
    mutationFn: () =>
      trpc.webhooks.create.mutate({
        seriesMint: mint!,
        url: url.trim(),
        events: events as any,
      }),
    onSuccess: (res) => {
      setRevealed({ id: res.id, secret: res.secret });
      setUrl("");
      toast.success("Webhook created. Copy the signing secret — it won't be shown again.");
      qc.invalidateQueries({ queryKey: ["webhooks.list", mint] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (id: number) => trpc.webhooks.rotateSecret.mutate({ id }),
    onSuccess: (res, id) => {
      setRevealed({ id, secret: res.secret });
      toast.success("Secret rotated. Copy it — old one will stop working immediately.");
      qc.invalidateQueries({ queryKey: ["webhooks.list", mint] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      trpc.webhooks.toggleActive.mutate({ id, active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks.list", mint] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => trpc.webhooks.delete.mutate({ id }),
    onSuccess: () => {
      toast.success("Webhook deleted.");
      qc.invalidateQueries({ queryKey: ["webhooks.list", mint] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deliveries = useQuery({
    queryKey: ["webhooks.deliveries", openDeliveries],
    queryFn: () =>
      trpc.webhooks.recentDeliveries.query({ webhookId: openDeliveries!, limit: 50 }),
    enabled: openDeliveries !== null,
    refetchInterval: 10_000,
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  };

  const toggleEvent = (v: string) =>
    setEvents((prev) => (prev.includes(v) ? prev.filter((e) => e !== v) : [...prev, v]));

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/issue"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Issuer Portal
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Webhook size={16} className="text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Issuer / Webhooks
        </span>
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Webhook Subscriptions
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Register an HTTPS endpoint to receive signed, real-time notifications for indexed
          events on{" "}
          <span className="font-mono text-foreground">
            {sec.data?.symbol ?? (mint ? truncateAddress(mint) : "this series")}
          </span>
          . Each POST carries an <code>X-DinoSecurities-Signature</code> HMAC-SHA256 header and a
          timestamp — reject events older than 5 minutes to block replay.
        </p>
      </div>

      {revealed && (
        <div className="border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-primary mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground mb-1">
              Signing secret for webhook #{revealed.id}
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              Copy now. This value will never be shown again — rotate to generate a new one.
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-background border border-border px-2 py-1 flex-1 truncate">
                {revealed.secret}
              </code>
              <button
                onClick={() => copy(revealed.secret)}
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

      <div className="border border-border p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Add webhook
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-backend.example.com/dinosecurities"
            className="bg-background border border-border px-3 py-2 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleEvent(opt.value)}
                className={`text-[10px] uppercase tracking-widest px-2 py-1 border transition-colors ${
                  events.includes(opt.value)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={!url || events.length === 0 || create.isPending}
            className="self-start flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Register endpoint
          </button>
        </div>
      </div>

      {hooks.isLoading ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Loading webhooks…
        </div>
      ) : !hooks.data || hooks.data.length === 0 ? (
        <div className="border border-border p-12 text-center flex flex-col items-center gap-2">
          <Webhook size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No webhooks registered</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Register an HTTPS endpoint above to start receiving signed event notifications for
            this series.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {hooks.data.map((h) => (
            <div key={h.id} className="border border-border">
              <div className="p-4 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                      #{h.id}
                    </span>
                    {h.active ? (
                      <span className="text-[9px] uppercase tracking-widest font-semibold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground bg-secondary/30 border border-border px-1.5 py-0.5">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-mono text-foreground truncate">{h.url}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {h.eventsSubscribed.map((ev) => (
                      <span
                        key={ev}
                        className="text-[9px] uppercase tracking-widest bg-secondary/30 border border-border px-1.5 py-0.5 text-muted-foreground"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                    secret: {h.secretMasked}
                    {h.lastRotatedAt && (
                      <span> · rotated {new Date(h.lastRotatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => rotate.mutate(h.id)}
                    disabled={rotate.isPending}
                    className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Rotate
                  </button>
                  <button
                    onClick={() => toggle.mutate({ id: h.id, active: !h.active })}
                    className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary flex items-center gap-1"
                  >
                    <Power size={10} /> {h.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() =>
                      setOpenDeliveries((cur) => (cur === h.id ? null : h.id))
                    }
                    className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:bg-secondary"
                  >
                    {openDeliveries === h.id ? "Hide" : "Deliveries"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this webhook? In-flight retries will stop.")) {
                        remove.mutate(h.id);
                      }
                    }}
                    className="text-[10px] uppercase tracking-widest border border-red-400/30 text-red-400 px-2 py-1 hover:bg-red-400/10 flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>

              {openDeliveries === h.id && (
                <div className="border-t border-border p-4 bg-secondary/10">
                  {deliveries.isLoading ? (
                    <div className="text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin inline mr-1" /> Loading…
                    </div>
                  ) : !deliveries.data || deliveries.data.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No deliveries yet.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-muted-foreground">
                          <th className="text-left py-1 pr-2">Event</th>
                          <th className="text-left py-1 pr-2">Tx</th>
                          <th className="text-left py-1 pr-2">Attempt</th>
                          <th className="text-left py-1 pr-2">HTTP</th>
                          <th className="text-left py-1 pr-2">When</th>
                          <th className="text-right py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.data.map((d) => (
                          <tr key={d.id} className="border-t border-border/30">
                            <td className="py-1 pr-2 font-mono">{d.eventType}</td>
                            <td className="py-1 pr-2 font-mono text-muted-foreground">
                              {d.txSignature ? truncateAddress(d.txSignature) : "—"}
                            </td>
                            <td className="py-1 pr-2">{d.attempt}</td>
                            <td className="py-1 pr-2">{d.responseStatus ?? "—"}</td>
                            <td className="py-1 pr-2 text-muted-foreground">
                              {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                            </td>
                            <td className="py-1 text-right">
                              {d.status === "delivered" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-primary">
                                  <CheckCircle2 size={10} /> Delivered
                                </span>
                              ) : d.status === "failed" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-red-400" title={d.error ?? undefined}>
                                  <XCircle size={10} /> Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-amber-400">
                                  <Loader2 size={10} className="animate-spin" /> Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IssuerWebhooks;
