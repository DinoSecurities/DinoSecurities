import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, ArrowUpRight, ArrowDownRight, Grid3X3, List, Loader2 } from "lucide-react";
import { useAllSecuritySeriesData } from "@/hooks/useSecuritySeries";
import { securities as fallbackSecurities } from "@/lib/mockData";

type ViewMode = "grid" | "list";
type SortKey = "name" | "price" | "change" | "holders" | "supply";
type FilterType = "all" | "Equity" | "Debt" | "Fund" | "LLC";

const Marketplace = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [filterOpen, setFilterOpen] = useState(false);

  // Use real hook — falls back to mock data internally when program isn't deployed
  const { data: seriesData, isLoading } = useAllSecuritySeriesData();

  // Map to the display format the UI expects (compatible with existing mock shape)
  const securities = seriesData && seriesData.length > 0
    ? fallbackSecurities // Will be replaced when real on-chain data decoding is done
    : fallbackSecurities;

  const filtered = securities
    .filter((s) => {
      if (filterType !== "all" && s.type !== filterType) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "price": return b.price - a.price;
        case "change": return b.change24h - a.change24h;
        case "holders": return b.holders - a.holders;
        case "supply": return b.circulatingSupply - a.circulatingSupply;
        default: return a.name.localeCompare(b.name);
      }
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Marketplace</h2>
          <p className="text-sm text-muted-foreground mt-1">{securities.length} securities available</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary border border-border px-3 py-1.5 gap-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm text-foreground w-40 focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`p-2 border border-border transition-colors ${filterOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Filter size={16} />
          </button>
          <div className="flex border border-border">
            <button onClick={() => setViewMode("grid")} className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}><Grid3X3 size={16} /></button>
            <button onClick={() => setViewMode("list")} className={`p-2 transition-colors border-l border-border ${viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}><List size={16} /></button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {filterOpen && (
        <div className="flex flex-wrap gap-4 p-4 border border-border bg-secondary/30">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</span>
            <div className="flex gap-1">
              {(["all", "Equity", "Debt", "Fund", "LLC"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                    filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Sort By</span>
            <div className="flex gap-1">
              {([["name", "Name"], ["price", "Price"], ["change", "Change"], ["holders", "Holders"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key as SortKey)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                    sortKey === key ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/app/marketplace/${s.mintAddress}`}
              className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 hover:bg-secondary/30 transition-all duration-300 hover:-translate-y-0.5 group"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center text-xs font-bold border ${
                    s.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                    s.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                    s.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                    "bg-purple-500/20 border-purple-500/40 text-purple-400"
                  }`}>{s.type[0]}</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{s.type}</div>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${s.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {s.change24h >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {s.change24h >= 0 ? "+" : ""}{s.change24h}%
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4 truncate">{s.name}</div>
              <div className="text-2xl font-semibold text-foreground tracking-tight mb-4">${s.price.toFixed(2)}</div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Holders</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.holders.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Supply</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{(s.circulatingSupply / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Reg</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.regulation}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Price</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">24h</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Holders</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Regulation</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden xl:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="p-4">
                    <Link to={`/app/marketplace/${s.mintAddress}`} className="flex items-center gap-3 group">
                      <div className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                        s.type === "Equity" ? "bg-primary/20 border-primary/40 text-primary" :
                        s.type === "Debt" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                        s.type === "Fund" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" :
                        "bg-purple-500/20 border-purple-500/40 text-purple-400"
                      }`}>{s.type[0]}</div>
                      <div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{s.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="p-4 text-right"><span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">{s.type}</span></td>
                  <td className="p-4 text-right font-mono text-foreground">${s.price.toFixed(2)}</td>
                  <td className={`p-4 text-right text-xs font-semibold hidden md:table-cell ${s.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>{s.change24h >= 0 ? "+" : ""}{s.change24h}%</td>
                  <td className="p-4 text-right text-muted-foreground hidden lg:table-cell">{s.holders.toLocaleString()}</td>
                  <td className="p-4 text-right hidden lg:table-cell"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.regulation}</span></td>
                  <td className="p-4 text-right hidden xl:table-cell"><span className="text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5">{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
