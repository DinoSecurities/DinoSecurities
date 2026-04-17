import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import type { HolderRow } from "@/hooks/useHoldersForMint";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// world-atlas countries-110m.json uses ISO 3166-1 numeric IDs, not alpha-2.
// This maps numeric → alpha-2 so we can match holder jurisdiction codes.
const NUM_TO_ISO2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","016":"AS","020":"AD","024":"AO","028":"AG","031":"AZ","032":"AR","036":"AU",
  "040":"AT","044":"BS","048":"BH","050":"BD","051":"AM","052":"BB","056":"BE","060":"BM","064":"BT","068":"BO",
  "070":"BA","072":"BW","076":"BR","084":"BZ","090":"SB","092":"VG","096":"BN","100":"BG","104":"MM","108":"BI",
  "112":"BY","116":"KH","120":"CM","124":"CA","132":"CV","140":"CF","144":"LK","148":"TD","152":"CL","156":"CN",
  "158":"TW","170":"CO","174":"KM","178":"CG","180":"CD","188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ",
  "204":"BJ","208":"DK","212":"DM","214":"DO","218":"EC","222":"SV","226":"GQ","231":"ET","232":"ER","233":"EE",
  "234":"FO","242":"FJ","246":"FI","250":"FR","254":"GF","258":"PF","262":"DJ","266":"GA","268":"GE","270":"GM",
  "275":"PS","276":"DE","288":"GH","296":"KI","300":"GR","304":"GL","308":"GD","312":"GP","316":"GU","320":"GT",
  "324":"GN","328":"GY","332":"HT","336":"VA","340":"HN","344":"HK","348":"HU","352":"IS","356":"IN","360":"ID",
  "364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT","384":"CI","388":"JM","392":"JP","398":"KZ","400":"JO",
  "404":"KE","408":"KP","410":"KR","414":"KW","417":"KG","418":"LA","422":"LB","426":"LS","428":"LV","430":"LR",
  "434":"LY","438":"LI","440":"LT","442":"LU","450":"MG","454":"MW","458":"MY","462":"MV","466":"ML","470":"MT",
  "478":"MR","480":"MU","484":"MX","492":"MC","496":"MN","498":"MD","504":"MA","508":"MZ","512":"OM","516":"NA",
  "520":"NR","524":"NP","528":"NL","540":"NC","554":"NZ","558":"NI","562":"NE","566":"NG","578":"NO","586":"PK",
  "591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","616":"PL","620":"PT","630":"PR","634":"QA","642":"RO",
  "643":"RU","646":"RW","682":"SA","686":"SN","688":"RS","694":"SL","702":"SG","703":"SK","704":"VN","705":"SI",
  "706":"SO","710":"ZA","716":"ZW","724":"ES","728":"SS","729":"SD","740":"SR","748":"SZ","752":"SE","756":"CH",
  "760":"SY","762":"TJ","764":"TH","768":"TG","776":"TO","780":"TT","784":"AE","788":"TN","792":"TR","795":"TM",
  "800":"UG","804":"UA","807":"MK","818":"EG","826":"GB","834":"TZ","840":"US","854":"BF","858":"UY","860":"UZ",
  "862":"VE","887":"YE","894":"ZM",
};

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
                  const iso = geo.properties.ISO_A2 || geo.properties.iso_a2 || NUM_TO_ISO2[geo.id] || "";
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
