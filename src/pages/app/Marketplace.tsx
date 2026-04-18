import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, Grid3X3, List, Loader2, Inbox, Clock } from "lucide-react";
import { useIndexedSecurities, type IndexedSecurity } from "@/hooks/useIndexedSecurities";
import { useDinoTier } from "@/hooks/useDinoBalance";
import { trpc } from "@/lib/trpc";

type ViewMode = "grid" | "list";
type SortKey = "name" | "supply" | "type";
type FilterType = "all" | "Equity" | "Debt" | "FundInterest" | "LlcMembership";

const TYPE_COLORS: Record<string, string> = {
  Equity: "bg-primary/20 border-primary/40 text-primary",
  Debt: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  FundInterest: "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
  LlcMembership: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

const Marketplace = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: securities = [], isLoading } = useIndexedSecurities();
  const { tier } = useDinoTier();

  // Mints with a scheduled public listing still in the future. Non-Gold
  // callers don't see them in the main marketplace; Gold sees the full
  // roster plus a "Upcoming" affordance linking to /marketplace/upcoming.
  const previewing = useQuery({
    queryKey: ["issuerAccess.currentlyPreviewing"],
    queryFn: () => trpc.issuerAccess.currentlyPreviewing.query(),
    staleTime: 60_000,
  });
  const previewSet = useMemo(
    () => new Set((previewing.data ?? []).map((p) => p.mint)),
    [previewing.data],
  );
  const isGold = tier.id >= 3;

  const filtered: IndexedSecurity[] = securities
    .filter((s) => {
      if (!isGold && previewSet.has(s.mintAddress)) return false;
      if (filterType !== "all" && s.securityType !== filterType) return false;
      if (
        searchQuery &&
        !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "supply": return b.currentSupply - a.currentSupply;
        case "type": return a.securityType.localeCompare(b.securityType);
        default: return a.name.localeCompare(b.name);
      }
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Marketplace</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading…" : `${filtered.length} securities indexed`}
          </p>
          {isGold && previewing.data && previewing.data.length > 0 && (
            <Link
              to="/app/marketplace/upcoming"
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              <Clock size={11} /> {previewing.data.length} upcoming · Gold preview →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary border border-border px-3 py-1.5 gap-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
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

      {filterOpen && (
        <div className="flex flex-wrap gap-4 p-4 border border-border bg-secondary/30">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</span>
            <div className="flex gap-1">
              {(["all", "Equity", "Debt", "FundInterest", "LlcMembership"] as const).map((t) => (
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
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Sort</span>
            <div className="flex gap-1">
              {([["name", "Name"], ["supply", "Supply"], ["type", "Type"]] as const).map(([key, label]) => (
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

      {isLoading ? (
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading on-chain securities…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border p-16 flex flex-col items-center text-center gap-2">
          <Inbox size={32} className="text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No securities indexed yet</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Once an issuer creates a series via the Issuer Portal, it appears here within seconds via Helius indexing.
          </p>
          <Link to="/app/issue/create" className="text-xs uppercase tracking-widest text-primary mt-3 hover:underline">
            Create the first one →
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Link
              key={s.mintAddress}
              to={`/app/marketplace/${s.mintAddress}`}
              className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-6 hover:bg-secondary/30 transition-all duration-300 hover:-translate-y-0.5 group"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center text-xs font-bold border ${TYPE_COLORS[s.securityType] ?? "bg-secondary border-border text-muted-foreground"}`}>
                    {s.symbol[0] ?? "?"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{s.securityType}</div>
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 ${s.status === "active" ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"}`}>{s.status}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4 truncate">{s.name}</div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Supply</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.currentSupply.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Cap</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.maxSupply.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Reg</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5">{s.transferRestrictions}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Supply</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Cap</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Restriction</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.mintAddress} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="p-4">
                    <Link to={`/app/marketplace/${s.mintAddress}`} className="flex items-center gap-3 group">
                      <div className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold border shrink-0 ${TYPE_COLORS[s.securityType] ?? "bg-secondary border-border text-muted-foreground"}`}>{s.symbol[0] ?? "?"}</div>
                      <div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{s.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="p-4 text-right"><span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">{s.securityType}</span></td>
                  <td className="p-4 text-right font-mono text-foreground">{s.currentSupply.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono text-muted-foreground hidden md:table-cell">{s.maxSupply.toLocaleString()}</td>
                  <td className="p-4 text-right hidden lg:table-cell"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.transferRestrictions}</span></td>
                  <td className="p-4 text-right"><span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 ${s.status === "active" ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"}`}>{s.status}</span></td>
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
