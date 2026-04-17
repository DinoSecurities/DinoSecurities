import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface SettlementItem {
  symbol: string;
  amount: number;
  price: number;
  signature: string;
  at: string;
}

const WS_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001/trpc")
  .replace("/trpc", "")
  .replace("https://", "wss://")
  .replace("http://", "ws://")
  + "/ws/settlements";

const MAX_ITEMS = 20;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30000;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3600_000)}h ago`;
}

export default function SettlementTicker() {
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const seeded = useRef(false);

  // Seed with recent settlements from the tRPC API
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    trpc.analytics.recentSettlements
      .query({ limit: 10 })
      .then((res) => {
        if (!res?.items?.length) return;
        setItems(
          res.items.map((r: any) => ({
            symbol: r.mint ? r.mint.slice(0, 6) : "---",
            amount: r.tokens ?? 0,
            price: r.usdc ?? 0,
            signature: r.signature ?? "",
            at: r.settledAt ?? new Date().toISOString(),
          })),
        );
      })
      .catch(() => {});
  }, []);

  // WebSocket connection with exponential backoff
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      if (dead) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          retryRef.current = 0;
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "settlement") {
              setItems((prev) => [
                {
                  symbol: data.symbol || "---",
                  amount: data.amount ?? 0,
                  price: data.price ?? 0,
                  signature: data.signature ?? "",
                  at: data.at ?? new Date().toISOString(),
                },
                ...prev,
              ].slice(0, MAX_ITEMS));
            }
          } catch {}
        };

        ws.onclose = () => {
          setConnected(false);
          if (!dead) {
            const delay = Math.min(
              RECONNECT_BASE_MS * Math.pow(2, retryRef.current),
              RECONNECT_CAP_MS,
            );
            retryRef.current++;
            timer = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => ws.close();
      } catch {
        if (!dead) {
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, retryRef.current),
            RECONNECT_CAP_MS,
          );
          retryRef.current++;
          timer = setTimeout(connect, delay);
        }
      }
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, []);

  // Check if data is stale
  const isStale =
    items.length === 0 ||
    (items[0] && Date.now() - new Date(items[0].at).getTime() > STALE_THRESHOLD_MS);

  if (items.length === 0 && !connected) {
    return (
      <div className="w-full border-t border-b border-border/30 py-2.5 overflow-hidden">
        <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
          Live feed · connecting...
        </div>
      </div>
    );
  }

  if (isStale && items.length === 0) {
    return (
      <div className="w-full border-t border-b border-border/30 py-2.5 overflow-hidden">
        <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
          Live feed · awaiting activity
        </div>
      </div>
    );
  }

  // Double the items for seamless infinite scroll
  const doubled = [...items, ...items];

  return (
    <div className="w-full border-t border-b border-border/30 py-2.5 overflow-hidden relative">
      {/* Live indicator */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" : "bg-amber-400"} animate-pulse`} />
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
          Live
        </span>
      </div>

      <motion.div
        className="flex gap-12 pl-16 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: Math.max(items.length * 4, 20),
            ease: "linear",
          },
        }}
      >
        {doubled.map((item, i) => (
          <a
            key={`${item.signature}-${i}`}
            href={item.signature ? `https://explorer.solana.com/tx/${item.signature}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[11px] hover:text-primary transition-colors shrink-0"
          >
            <span className="font-semibold text-foreground/80">{item.symbol}</span>
            <span className="text-muted-foreground/60">×</span>
            <span className="text-foreground/70 font-mono">{item.amount.toLocaleString()}</span>
            <span className="text-muted-foreground/60">@</span>
            <span className="text-foreground/70 font-mono">${item.price.toFixed(2)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/40">{timeAgo(item.at)}</span>
          </a>
        ))}
      </motion.div>
    </div>
  );
}
