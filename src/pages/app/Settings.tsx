import { useState } from "react";
import { Shield, User, Bell, Globe, Key, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";
import { toast } from "sonner";

const Settings = () => {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications" | "preferences">("profile");
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ displayName: "DinoUser", email: "" });
  const [notifications, setNotifications] = useState({ settlements: true, governance: true, transfers: true, marketing: false });

  const kycStatus = useQuery({
    queryKey: ["kycStatus", wallet],
    queryFn: () => trpc.kyc.getStatusForWallet.query({ wallet: wallet! }),
    enabled: !!wallet,
    refetchInterval: 10_000,
  });

  const startKyc = useMutation({
    mutationFn: () => trpc.kyc.initSession.mutate({ wallet: wallet! }),
    onSuccess: (data) => {
      if (data.redirectUrl) {
        toast.success("Opening Didit verification…");
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("KYC provider did not return a redirect URL");
      }
      kycStatus.refetch();
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to start KYC"),
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "security" as const, label: "Security", icon: Key },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "preferences" as const, label: "Preferences", icon: Globe },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="border border-border flex flex-col">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3.5 text-sm border-b border-border/30 last:border-0 transition-colors ${
                  activeTab === tab.id ? "text-foreground bg-primary/10 border-l-2 border-l-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                }`}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* KYC Status */}
          <div className="border border-primary/30 bg-primary/5 p-5 mt-4">
            <div className="flex items-center gap-3 mb-3">
              <Shield size={18} className="text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-foreground font-semibold">KYC Status</span>
            </div>
            {!connected ? (
              <p className="text-xs text-muted-foreground">Connect a wallet to start verification.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={
                      kycStatus.data?.status === "verified" ? "text-emerald-400 font-semibold" :
                      kycStatus.data?.status === "pending" ? "text-amber-400 font-semibold" :
                      kycStatus.data?.status === "rejected" || kycStatus.data?.status === "revoked" ? "text-red-400 font-semibold" :
                      "text-muted-foreground"
                    }>
                      {kycStatus.isLoading ? "…" : (kycStatus.data?.status ?? "none")}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wallet</span><span className="text-foreground font-mono">{truncateAddress(wallet ?? "")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="text-foreground">Didit</span></div>
                </div>
                {(kycStatus.data?.status === "none" || !kycStatus.data) && (
                  <button
                    onClick={() => startKyc.mutate()}
                    disabled={startKyc.isPending || !wallet}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {startKyc.isPending ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    Start verification
                  </button>
                )}
                {kycStatus.data?.status === "pending" && (
                  <>
                    <p className="text-[10px] text-muted-foreground mt-3">
                      Verification in progress. If your Didit tab is still open, finish there and come back.
                    </p>
                    <button
                      onClick={() => startKyc.mutate()}
                      disabled={startKyc.isPending || !wallet}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 border border-primary/50 text-primary text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/10 transition-colors"
                    >
                      {startKyc.isPending ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      Restart verification
                    </button>
                  </>
                )}
                {(kycStatus.data?.status === "rejected" || kycStatus.data?.status === "revoked" || kycStatus.data?.status === "expired") && (
                  <button
                    onClick={() => startKyc.mutate()}
                    disabled={startKyc.isPending || !wallet}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {startKyc.isPending ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    Retry verification
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-9 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          {activeTab === "profile" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Profile Information</span>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/20 border border-primary/40 flex items-center justify-center text-xl font-bold text-primary">
                  {(profile.displayName?.[0] ?? "D").toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{profile.displayName || "Anonymous"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{wallet ? truncateAddress(wallet) : "Not connected"}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Display Name</label>
                  <input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Email</label>
                  <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} className="bg-foreground text-background px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all">
                  {saved ? "Saved ✓" : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security Settings</span>
              <div className="flex flex-col gap-4">
                {[
                  { title: "Connected Wallet", desc: "7xKpR4...mN4q — Phantom", action: "Change" },
                  { title: "Two-Factor Auth", desc: "TOTP authenticator enabled", action: "Configure" },
                  { title: "Session Timeout", desc: "Auto-disconnect after 30 minutes of inactivity", action: "Edit" },
                  { title: "Trusted Devices", desc: "2 devices registered", action: "Manage" },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between p-4 border border-border hover:bg-secondary/20 transition-colors">
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                    <button className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">{item.action}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Notification Preferences</span>
              {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between p-4 border border-border">
                  <div>
                    <div className="text-sm font-medium text-foreground capitalize">{key}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {key === "settlements" && "DvP settlement status updates"}
                      {key === "governance" && "New proposals and voting reminders"}
                      {key === "transfers" && "Token transfer confirmations"}
                      {key === "marketing" && "Product updates and announcements"}
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, [key]: !enabled })}
                    className={`w-11 h-6 rounded-full relative transition-colors ${enabled ? "bg-primary" : "bg-secondary border border-border"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${enabled ? "right-1 bg-primary-foreground" : "left-1 bg-muted-foreground"}`} />
                  </button>
                </div>
              ))}
              <button onClick={handleSave} className="bg-foreground text-background px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all self-start">
                {saved ? "Saved ✓" : "Save Preferences"}
              </button>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">App Preferences</span>
              {[
                { title: "Theme", desc: "Dark mode (system default)", icon: Moon },
                { title: "Language", desc: "English (US)", icon: Globe },
                { title: "Network", desc: "Solana Mainnet-Beta", icon: Shield },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-4 border border-border">
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className="text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  <button className="text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">Change</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
