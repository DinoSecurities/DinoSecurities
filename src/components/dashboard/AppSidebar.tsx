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
  FileStack,
} from "lucide-react";
import WalletStatus from "@/components/wallet/WalletStatus";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, disabled: false },
  { to: "/app/portfolio", label: "Portfolio", icon: Briefcase, disabled: false },
  { to: "/app/marketplace", label: "Marketplace", icon: Store, disabled: false },
  { to: "/app/governance", label: "Governance", icon: Vote, disabled: false },
  { to: "/app/settlement", label: "Settlement", icon: ArrowLeftRight, disabled: false },
  { to: "/app/issue", label: "Issuer Portal", icon: FileStack, disabled: false },
  { to: "/app/settings", label: "Settings", icon: Settings, disabled: false },
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

          if (item.disabled) {
            return (
              <div
                key={item.to}
                title="Coming soon"
                className="flex items-center gap-3 px-3 py-2.5 text-sm border-l-2 border-transparent ml-0 pl-[10px] text-muted-foreground/40 cursor-not-allowed"
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && (
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{item.label}</span>
                    <span className="text-[8px] uppercase tracking-widest bg-muted/30 border border-border px-1.5 py-0.5 text-muted-foreground/60">Soon</span>
                  </div>
                )}
              </div>
            );
          }

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
        {!collapsed && <WalletStatus />}
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
