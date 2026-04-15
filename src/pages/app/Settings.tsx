import { useEffect, useState } from "react";
import { Shield, User, Key, ExternalLink, Loader2, Copy, LogOut } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { truncateAddress } from "@/lib/solana";
import { toast } from "sonner";

const NETWORK_LABEL = (() => {
  const n = import.meta.env.VITE_SOLANA_NETWORK;
  if (n === "mainnet-beta") return "Solana Mainnet";
  if (n === "devnet") return "Solana Devnet";
  return `Solana ${n ?? "unknown"}`;
})();

const Settings = () => {
  const { publicKey, connected, disconnect, wallet: adapterWallet } = useWallet();
  const wallet = publicKey?.toBase58();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ displayName: "", email: "" });

  // Per-wallet local preferences. We have no user-profile backend yet, so
  // these live in localStorage keyed by the connected wallet pubkey.
  useEffect(() => {
    if (!wallet) return;
    try {
      const raw = localStorage.getItem(`dino:profile:${wallet}`);
      if (raw) setProfile(JSON.parse(raw));
      else setProfile({ displayName: "", email: "" });
    } catch {
      setProfile({ displayName: "", email: "" });
    }
  }, [wallet]);

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

  const handleSaveProfile = () => {
    if (!wallet) return;
    localStorage.setItem(`dino:profile:${wallet}`, JSON.stringify(profile));
    // Notify other components in the same tab (navbar) to re-read the profile.
    window.dispatchEvent(new Event("dino:profile-updated"));
    setSaved(true);
    toast.success("Saved locally");
    setTimeout(() => setSaved(false), 2000);
  };

  const copyAddress = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    toast.success("Address copied");
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "security" as const, label: "Security", icon: Key },
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
                      kycStatus.data?.status === "rejected" || kycStatus.data?.status === "revoked" || kycStatus.data?.status === "expired" ? "text-red-400 font-semibold" :
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
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Profile Information</span>
                <p className="text-[10px] text-muted-foreground mt-1">Stored in your browser only — never sent to our servers.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/15 border border-primary/40 flex items-center justify-center text-2xl font-semibold text-primary">
                  {(profile.displayName?.[0] ?? "D").toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{profile.displayName || "Anonymous"}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{truncateAddress(wallet ?? "")}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Display Name</label>
                  <input
                    value={profile.displayName}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                    placeholder="DinoUser"
                    className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Email <span className="opacity-60">(optional)</span></label>
                  <input
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={handleSaveProfile}
                  disabled={!wallet}
                  className="bg-foreground text-background px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {saved ? "Saved ✓" : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="p-6 flex flex-col gap-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security Settings</span>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 border border-border">
                  <div>
                    <div className="text-sm font-medium text-foreground">Connected Wallet</div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {wallet ? truncateAddress(wallet) : "Not connected"}
                      {adapterWallet?.adapter.name ? ` — ${adapterWallet.adapter.name}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {wallet && (
                      <button onClick={copyAddress} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary font-semibold hover:underline">
                        <Copy size={12} /> Copy
                      </button>
                    )}
                    {connected && (
                      <button onClick={() => disconnect()} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-red-400 font-semibold hover:underline">
                        <LogOut size={12} /> Disconnect
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-border">
                  <div>
                    <div className="text-sm font-medium text-foreground">Network</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{NETWORK_LABEL}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/20 border border-border">
                  <Shield size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    Authentication is handled by your Solana wallet. There is no password, email login, 2FA, or stored session on our servers — your wallet signature IS the login. To revoke access, disconnect in your wallet.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
