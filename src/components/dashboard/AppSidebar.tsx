import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Store,
  Vote,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  Shield,
  ExternalLink,
} from "lucide-react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/app/marketplace", label: "Marketplace", icon: Store },
  { to: "/app/governance", label: "Governance", icon: Vote },
  { to: "/app/settlement", label: "Settlement", icon: ArrowLeftRight },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: Props) => {
  const location = useLocation();

  return (
    <aside
      className={`hidden md:flex flex-col h-full border-r border-border bg-card transition-all duration-300 shrink-0 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border shrink-0">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-wide text-foreground truncate">
              DinoSecurities
            </span>
          )}
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 group relative ${
                isActive
                  ? "text-foreground bg-primary/10 border-l-2 border-primary ml-0 pl-[10px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 border-l-2 border-transparent ml-0 pl-[10px]"
              }`}
            >
              <item.icon size={18} className={`shrink-0 ${isActive ? "text-primary" : ""}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse + Wallet */}
      <div className="border-t border-border p-3 flex flex-col gap-2 shrink-0">
        {!collapsed && (
          <div className="px-3 py-3 bg-secondary/60 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px] shadow-primary" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Wallet
              </span>
            </div>
            <div className="text-xs text-foreground font-mono truncate">7xKp...mN4q</div>
            <div className="text-[10px] text-muted-foreground mt-1">Solana Mainnet</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex items-center justify-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
