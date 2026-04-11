import { useState } from "react";
import { Shield, User, Bell, Moon, Globe, Key, Check } from "lucide-react";

const Settings = () => {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications" | "preferences">("profile");
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ displayName: "DinoUser", email: "user@dinosecurities.io" });
  const [notifications, setNotifications] = useState({ settlements: true, governance: true, transfers: true, marketing: false });

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
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-emerald-400 font-semibold">Verified</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Level</span><span className="text-foreground">Accredited</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span className="text-foreground">Dec 2026</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="text-foreground">Persona</span></div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-9 border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
          {activeTab === "profile" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Profile Information</span>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/20 border border-primary/40 flex items-center justify-center text-xl font-bold text-primary">DU</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">DinoUser</div>
                  <div className="text-xs text-muted-foreground font-mono">7xKp...mN4q</div>
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
