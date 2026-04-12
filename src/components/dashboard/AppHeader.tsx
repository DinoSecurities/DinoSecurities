import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Menu,
  Bell,
  Search,
  X,
  LayoutDashboard,
  Briefcase,
  Store,
  Vote,
  ArrowLeftRight,
  Settings,
  Shield,
  FileStack,
} from "lucide-react";
import WalletButton from "@/components/wallet/WalletButton";
import NetworkBadge from "@/components/wallet/NetworkBadge";

const mobileNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/app/marketplace", label: "Marketplace", icon: Store },
  { to: "/app/governance", label: "Governance", icon: Vote },
  { to: "/app/settlement", label: "Settlement", icon: ArrowLeftRight },
  { to: "/app/issue", label: "Issuer Portal", icon: FileStack },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

const AppHeader = ({ collapsed, onToggle }: Props) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const { connected } = useWallet();

  const notifications = [
    { id: 1, title: "Settlement Completed", desc: "DvP order #1847 settled successfully", time: "2m ago", unread: true },
    { id: 2, title: "New Proposal", desc: "Vote on Series A dividend distribution", time: "1h ago", unread: true },
    { id: 3, title: "KYC Approved", desc: "Your identity verification is complete", time: "3h ago", unread: false },
    { id: 4, title: "Transfer Received", desc: "500 DINO-EQ tokens received", time: "1d ago", unread: false },
  ];

  const pageName = (() => {
    if (location.pathname === "/app") return "Dashboard";
    if (location.pathname.includes("portfolio")) return "Portfolio";
    if (location.pathname.includes("marketplace")) return "Marketplace";
    if (location.pathname.includes("governance")) return "Governance";
    if (location.pathname.includes("settlement")) return "Settlement";
    if (location.pathname.includes("settings")) return "Settings";
    return "Dashboard";
  })();

  return (
    <>
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shrink-0 relative z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <div className="md:hidden flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <span className="text-sm font-bold text-foreground">Dino</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">{pageName}</h1>
            <div className="h-4 w-px bg-border" />
            <NetworkBadge />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-2 bg-secondary border border-border px-3 py-1.5">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search securities, proposals..."
                className="bg-transparent text-sm text-foreground w-40 md:w-64 focus:outline-none placeholder:text-muted-foreground/50"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Search size={18} />
            </button>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border shadow-2xl z-50">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-foreground">Notifications</span>
                    <span className="text-[10px] text-primary font-semibold">2 new</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setNotifOpen(false)}
                        className={`w-full text-left p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors ${n.unread ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {n.unread && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                          {!n.unread && <div className="w-1.5 h-1.5 shrink-0" />}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{n.desc}</div>
                            <div className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="w-full p-3 text-xs text-primary hover:bg-secondary/50 text-center font-semibold uppercase tracking-widest transition-colors"
                  >
                    View All
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Wallet button — real Solana wallet connection */}
          <div className="hidden sm:block ml-1">
            {connected ? (
              <WalletButton compact />
            ) : (
              <WalletButton />
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border z-50 flex flex-col md:hidden">
            <div className="h-16 flex items-center justify-between px-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">DinoSecurities</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
              {mobileNav.map((item) => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isActive ? "text-foreground bg-primary/10 border-l-2 border-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-border p-4">
              <WalletButton />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AppHeader;
