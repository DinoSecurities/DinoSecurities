import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ArrowLeft, Code, Globe, Palette } from "lucide-react";
import { toast } from "sonner";
import { useIndexedSecurities } from "@/hooks/useIndexedSecurities";

const EmbedDocs = () => {
  const securities = useIndexedSecurities();
  const [symbol, setSymbol] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState("#8b5cf6");
  const [copied, setCopied] = useState<"iframe" | "link" | null>(null);

  const effectiveSymbol = (symbol || securities.data?.[0]?.symbol || "DINOMT").toUpperCase();

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (theme === "light") p.set("theme", "light");
    if (accent && accent.toLowerCase() !== "#8b5cf6") p.set("accent", accent);
    const qs = p.toString();
    return `https://www.dinosecurities.com/embed/${effectiveSymbol}${qs ? `?${qs}` : ""}`;
  }, [effectiveSymbol, theme, accent]);

  const iframeSnippet = `<iframe
  src="${url}"
  width="420"
  height="520"
  style="border:0; border-radius:8px; max-width:100%;"
  loading="lazy"
  title="${effectiveSymbol} — DinoSecurities">
</iframe>`;

  const copy = async (text: string, key: "iframe" | "link") => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={12} /> Back to home
        </Link>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Code size={18} className="text-primary" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              DinoSecurities / Embed Widget
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[0.95] mb-4">
            Embed a <span className="text-muted-foreground">security on your site.</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Paste one iframe on your corporate website, investor deck, or newsletter. Visitors see
            live series stats (supply, regulation, circulating, status) and hit an Invest button
            that opens the full flow on DinoSecurities in a new tab. No API keys, no build step.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Series
              </label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Ticker (e.g. DINOMT)"
                className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm font-mono focus:outline-none focus:border-primary/50"
              />
              {(securities.data?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(securities.data ?? []).slice(0, 6).map((s) => (
                    <button
                      key={s.mintAddress}
                      onClick={() => setSymbol(s.symbol)}
                      className="text-[10px] uppercase tracking-widest font-semibold border border-border hover:border-primary/50 hover:text-primary text-muted-foreground px-2 py-1 transition-colors"
                    >
                      {s.symbol}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                <Globe size={11} /> Theme
              </label>
              <div className="flex gap-2 mt-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-widest font-semibold border transition-colors ${
                      theme === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                <Palette size={11} /> Accent
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-14 bg-secondary border border-border"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="flex-1 bg-secondary border border-border px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Preview + Snippet */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Preview
                </span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline"
                >
                  Open in new tab
                </a>
              </div>
              <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-4 flex justify-center">
                <iframe
                  key={url}
                  src={url}
                  width={420}
                  height={520}
                  style={{ border: 0, borderRadius: 8, maxWidth: "100%" }}
                  loading="lazy"
                  title="DinoSecurities embed preview"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  iframe snippet
                </span>
                <button
                  onClick={() => copy(iframeSnippet, "iframe")}
                  className="text-[10px] uppercase tracking-widest font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  {copied === "iframe" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <pre className="border border-border bg-background/80 p-4 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
{iframeSnippet}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Direct link
                </span>
                <button
                  onClick={() => copy(url, "link")}
                  className="text-[10px] uppercase tracking-widest font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  {copied === "link" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <pre className="border border-border bg-background/80 p-3 text-xs font-mono text-muted-foreground break-all">
{url}
              </pre>
            </div>

            <div className="border border-border/50 bg-muted/10 p-4 flex flex-col gap-2 text-[11px] text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Responsive.</strong> Set <code>max-width:100%</code> on the
                iframe to collapse gracefully on mobile.
              </p>
              <p>
                <strong className="text-foreground">Safe.</strong> The widget never navigates your parent
                window — all CTAs open in a new tab. It never asks visitors for a wallet or
                signature; clicks route into the DinoSecurities flow.
              </p>
              <p>
                <strong className="text-foreground">Live.</strong> Stats are pulled from the same
                Helius-indexed state the main platform uses — every embed reflects the current
                on-chain supply and status within seconds of mainnet updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedDocs;
