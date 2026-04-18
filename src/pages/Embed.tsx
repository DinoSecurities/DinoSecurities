import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ShieldCheck, Loader2 } from "lucide-react";
import { useSecurityBySymbol } from "@/hooks/useSecurityBySymbol";
import { truncateAddress } from "@/lib/solana";
import { trpc } from "@/lib/trpc";

/**
 * Embeddable issuer widget. Rendered at /embed/:symbol and designed to
 * be iframed on an issuer's own corporate site. Intentionally minimal:
 *   - No navbar, no sidebar, no wallet connect.
 *   - Self-contained layout that looks reasonable at 380×520.
 *   - Invest CTA opens DinoSecurities in a new tab (never navigates the
 *     parent window → sidesteps cross-origin hell + feels safer).
 *
 * Query params:
 *   - ?accent=#HEX   override the primary accent (URL-encoded hex).
 *   - ?theme=light|dark (default dark).
 *
 * Headers set in vercel.json allow this route to be framed by any origin.
 */
const Embed = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [params] = useSearchParams();
  const accent = params.get("accent");
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const sec = useSecurityBySymbol(symbol);

  // Resolve the issuer's $DINO tier → look up their branding overrides
  // so the embed renders with the issuer's accent, optional logo, and
  // (Gold-tier) no "Powered by DinoSecurities" footer. All queries
  // short-circuit when the series isn't loaded yet.
  const issuerTier = useQuery({
    queryKey: ["dino.issuerTierForSeries", sec.data?.mintAddress],
    queryFn: () =>
      trpc.dino.issuerTierForSeries.query({ mint: sec.data!.mintAddress }),
    enabled: !!sec.data?.mintAddress,
    staleTime: 5 * 60_000,
  });
  const issuerWallet = issuerTier.data?.issuerWallet ?? null;
  const branding = useQuery({
    queryKey: ["issuerAccess.branding", issuerWallet],
    queryFn: () => trpc.issuerAccess.branding.query({ issuerWallet: issuerWallet! }),
    enabled: !!issuerWallet && (issuerTier.data?.tier.id ?? 0) >= 1,
    staleTime: 5 * 60_000,
  });

  // Signal "noindex" to search engines — the widget is meant to be embedded
  // on third-party sites, not crawled as a canonical page.
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => void document.head.removeChild(m);
  }, []);

  const bg = theme === "light" ? "#ffffff" : "#0a0a0f";
  const fg = theme === "light" ? "#0a0a0f" : "#fafafc";
  const muted = theme === "light" ? "#6b6b7a" : "#9997b0";
  const border = theme === "light" ? "#e3e3e8" : "#222227";
  // Precedence: URL override > issuer branding > default. Issuers who
  // want a consistent embedded look set their accent once via /app/issue
  // and every iframed widget picks it up automatically; the URL param
  // is still honored for one-off overrides on specific pages.
  const brandingAccent = branding.data?.accentColor ?? null;
  const primary =
    accent && /^#[0-9a-fA-F]{6}$/.test(accent)
      ? accent
      : brandingAccent && /^#[0-9a-fA-F]{6}$/.test(brandingAccent)
      ? brandingAccent
      : "#8b5cf6";
  const issuerLogoUri = branding.data?.logoUri ?? null;
  const hideFooter = branding.data?.hideEmbedFooter ?? false;

  const pct = useMemo(() => {
    if (!sec.data) return 0;
    const max = Number(sec.data.maxSupply);
    const cur = Number(sec.data.currentSupply);
    return max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0;
  }, [sec.data]);

  const marketplaceUrl = sec.data
    ? `https://www.dinosecurities.com/app/marketplace/${sec.data.mintAddress}?buy=1`
    : "https://www.dinosecurities.com/";

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: bg,
        color: fg,
        fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="mx-auto flex max-w-[420px] flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {issuerLogoUri ? (
              <img
                src={issuerLogoUri}
                alt=""
                className="h-5 w-5 object-contain"
                style={{ filter: theme === "dark" ? "none" : "none" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span
                className="inline-block h-2 w-2"
                style={{ backgroundColor: primary, boxShadow: `0 0 10px ${primary}` }}
              />
            )}
            {!hideFooter && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: muted }}>
                Powered by DinoSecurities
              </span>
            )}
          </div>
          {!hideFooter && (
            <a
              href="https://www.dinosecurities.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest font-semibold opacity-70 hover:opacity-100"
              style={{ color: muted }}
            >
              Learn →
            </a>
          )}
        </div>

        {sec.isLoading && (
          <div className="flex items-center justify-center py-12" style={{ color: muted }}>
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-xs">Loading series…</span>
          </div>
        )}

        {!sec.isLoading && !sec.data && (
          <div className="py-8 text-center">
            <div className="text-lg font-semibold mb-1" style={{ color: fg }}>
              Series not found
            </div>
            <div className="text-xs" style={{ color: muted }}>
              No security indexed under <span className="font-mono">{symbol}</span>
            </div>
          </div>
        )}

        {sec.data && (
          <>
            {/* Headline */}
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-semibold tracking-tight" style={{ color: fg }}>
                  {sec.data.symbol}
                </h2>
                <span
                  className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5"
                  style={{
                    color: sec.data.status === "active" ? "#10b981" : "#f59e0b",
                    backgroundColor:
                      sec.data.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                    border: `1px solid ${sec.data.status === "active" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                  }}
                >
                  {sec.data.status}
                </span>
              </div>
              <div className="text-sm mt-0.5" style={{ color: muted }}>
                {sec.data.name}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Security Type" value={sec.data.securityType} fg={fg} muted={muted} border={border} />
              <Stat label="Regulation" value={sec.data.transferRestrictions} fg={fg} muted={muted} border={border} />
              <Stat label="Max Supply" value={Number(sec.data.maxSupply).toLocaleString()} fg={fg} muted={muted} border={border} />
              <Stat label="Circulating" value={Number(sec.data.currentSupply).toLocaleString()} fg={fg} muted={muted} border={border} />
            </div>

            {/* Supply bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: muted }}>
                  Supply utilization
                </span>
                <span className="text-[10px] font-semibold" style={{ color: muted }}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 w-full" style={{ backgroundColor: border }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: primary }}
                />
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2 mt-2">
              <a
                href={marketplaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest"
                style={{ backgroundColor: primary, color: "#ffffff" }}
              >
                Invest <ArrowUpRight size={14} />
              </a>
              <a
                href={`https://www.dinosecurities.com/app/marketplace/${sec.data.mintAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest border"
                style={{ color: fg, borderColor: border }}
              >
                View series →
              </a>
            </div>

            {/* Compliance footnote */}
            <div
              className="flex items-start gap-2 p-3 text-[10px] leading-relaxed"
              style={{ color: muted, border: `1px solid ${border}` }}
            >
              <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: primary }} />
              <span>
                Every transfer enforces KYC, accreditation, and jurisdiction on-chain
                via Token-2022 transfer hooks. Mint{" "}
                <span className="font-mono">{truncateAddress(sec.data.mintAddress)}</span>.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function Stat({
  label, value, fg, muted, border,
}: { label: string; value: string; fg: string; muted: string; border: string }) {
  return (
    <div className="p-3 flex flex-col gap-1" style={{ border: `1px solid ${border}` }}>
      <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: muted }}>
        {label}
      </span>
      <span className="text-xs font-semibold" style={{ color: fg }}>
        {value}
      </span>
    </div>
  );
}

export default Embed;
