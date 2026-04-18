import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paintbrush, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useDinoTier } from "@/hooks/useDinoBalance";

/**
 * Issuer branding panel for the Issuer Portal. Three tier-gated
 * settings: accent color (Bronze), logo URI (Silver), hide embed
 * footer (Gold). Below-tier settings surface the gate inline so the
 * issuer sees exactly which tier unlocks each slot.
 */
export default function IssuerBrandingPanel() {
  const qc = useQueryClient();
  const { tier } = useDinoTier();

  const mine = useQuery({
    queryKey: ["issuerAccess.myBranding"],
    queryFn: () => trpc.issuerAccess.myBranding.query(),
  });

  const [accentColor, setAccentColor] = useState("");
  const [logoUri, setLogoUri] = useState("");
  const [hideEmbedFooter, setHideEmbedFooter] = useState(false);

  useEffect(() => {
    if (mine.data) {
      setAccentColor(mine.data.accentColor ?? "");
      setLogoUri(mine.data.logoUri ?? "");
      setHideEmbedFooter(mine.data.hideEmbedFooter);
    }
  }, [mine.data]);

  const save = useMutation({
    mutationFn: () =>
      trpc.issuerAccess.updateBranding.mutate({
        accentColor: accentColor.trim() || null,
        logoUri: logoUri.trim() || null,
        hideEmbedFooter,
      }),
    onSuccess: () => {
      toast.success("Branding saved.");
      qc.invalidateQueries({ queryKey: ["issuerAccess.myBranding"] });
      qc.invalidateQueries({ queryKey: ["issuerAccess.branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAccent = tier.id >= 1;
  const canLogo = tier.id >= 2;
  const canHideFooter = tier.id >= 3;

  return (
    <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Paintbrush size={14} className="text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-foreground font-semibold">
          Branding
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          — applies to your embed widget
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Accent color */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Accent color
            </label>
            <span
              className={`text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 ${
                canAccent
                  ? "text-primary bg-primary/10 border border-primary/30"
                  : "text-muted-foreground bg-secondary/30 border border-border"
              }`}
            >
              {canAccent ? "Unlocked (Bronze)" : "Bronze required"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled={!canAccent}
              value={accentColor || "#8b5cf6"}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-12 bg-background border border-border"
            />
            <input
              type="text"
              disabled={!canAccent}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#8b5cf6"
              className="flex-1 bg-background border border-border px-3 py-2 text-sm font-mono disabled:opacity-40"
            />
          </div>
        </div>

        {/* Logo URI */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Logo URL
            </label>
            <span
              className={`text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 ${
                canLogo
                  ? "text-primary bg-primary/10 border border-primary/30"
                  : "text-muted-foreground bg-secondary/30 border border-border"
              }`}
            >
              {canLogo ? "Unlocked (Silver)" : "Silver required"}
            </span>
          </div>
          <input
            type="text"
            disabled={!canLogo}
            value={logoUri}
            onChange={(e) => setLogoUri(e.target.value)}
            placeholder="https://yourdomain.com/logo.png  or  ar://…"
            className="w-full bg-background border border-border px-3 py-2 text-sm font-mono disabled:opacity-40"
          />
        </div>

        {/* Hide footer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Hide "Powered by DinoSecurities" footer
            </label>
            <span
              className={`text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 ${
                canHideFooter
                  ? "text-primary bg-primary/10 border border-primary/30"
                  : "text-muted-foreground bg-secondary/30 border border-border"
              }`}
            >
              {canHideFooter ? "Unlocked (Gold)" : "Gold required"}
            </span>
          </div>
          <button
            disabled={!canHideFooter}
            onClick={() => setHideEmbedFooter((v) => !v)}
            className={`flex items-center gap-2 text-xs border px-3 py-2 disabled:opacity-40 transition-colors ${
              hideEmbedFooter
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {hideEmbedFooter ? <EyeOff size={12} /> : <Eye size={12} />}
            {hideEmbedFooter ? "Footer hidden on your embed" : "Footer visible on your embed"}
          </button>
        </div>

        <div className="pt-3 border-t border-border/50 flex justify-end">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/30 disabled:opacity-40"
          >
            {save.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save branding
          </button>
        </div>
      </div>
    </div>
  );
}
