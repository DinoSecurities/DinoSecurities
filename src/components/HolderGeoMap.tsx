import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import type { HolderRow } from "@/hooks/useHoldersForMint";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/**
 * Minimum count threshold — any country with fewer than this number of holders
 * is bucketed as "<5 holders" to avoid de-anonymization in sparse regions.
 */
const ANONYMIZATION_THRESHOLD = 5;

interface HolderGeoMapProps {
  holders: HolderRow[];
  className?: string;
}

/**
 * World heatmap colored by how many whitelisted holders are registered per
 * jurisdiction. Hover for country name + count. No wallet addresses, no names,
 * no balances — just aggregate counts per ISO-3166 alpha-2 country code.
 */
export default function HolderGeoMap({ holders, className = "" }: HolderGeoMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  const { data, max } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of holders) {
      if (h.isRevoked) continue;
      const j = (h.jurisdiction ?? "").toUpperCase().trim();
      if (!j || j === "--") continue;
      counts[j] = (counts[j] || 0) + 1;
    }
    const maxVal = Math.max(...Object.values(counts), 1);
    return { data: counts, max: maxVal };
  }, [holders]);

  const totalCountries = Object.keys(data).length;

  if (totalCountries === 0) {
    return (
      <div className={`border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-8 text-center ${className}`}>
        <div className="text-sm font-medium text-foreground mb-1">Holder Geography</div>
        <p className="text-xs text-muted-foreground">
          No jurisdiction data yet. Holders appear on the map after whitelisting with a jurisdiction code.
        </p>
      </div>
    );
  }

  return (
    <div className={`border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] overflow-hidden relative ${className}`}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Holder Geography
        </span>
        <span className="text-[10px] text-muted-foreground">
          {totalCountries} {totalCountries === 1 ? "country" : "countries"}
        </span>
      </div>

      <div className="relative" style={{ aspectRatio: "2 / 1" }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 120, center: [0, 30] }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.ISO_A2 || geo.properties.iso_a2 || "";
                  const count = data[iso] ?? 0;
                  const opacity = count > 0 ? 0.15 + (count / max) * 0.85 : 0;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={
                        count > 0
                          ? `rgba(139, 92, 246, ${opacity})`
                          : "hsl(0, 0%, 15%)"
                      }
                      stroke="hsl(0, 0%, 20%)"
                      strokeWidth={0.5}
                      onMouseEnter={(e) => {
                        const name = geo.properties.NAME || geo.properties.name || iso;
                        setTooltip({
                          name,
                          count,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: count > 0 ? "rgba(139, 92, 246, 0.9)" : "hsl(0, 0%, 20%)" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-4 flex-wrap">
        {Object.entries(data)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([iso, count]) => (
            <div key={iso} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  backgroundColor: `rgba(139, 92, 246, ${0.15 + (count / max) * 0.85})`,
                }}
              />
              <span className="text-[10px] text-muted-foreground font-mono">
                {iso}: {count < ANONYMIZATION_THRESHOLD ? `<${ANONYMIZATION_THRESHOLD}` : count}
              </span>
            </div>
          ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[200] bg-card border border-border shadow-xl px-3 py-2 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          <div className="text-xs font-semibold text-foreground">{tooltip.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {tooltip.count === 0
              ? "No holders"
              : tooltip.count < ANONYMIZATION_THRESHOLD
                ? `<${ANONYMIZATION_THRESHOLD} holders`
                : `${tooltip.count} holders`}
          </div>
        </div>
      )}
    </div>
  );
}
