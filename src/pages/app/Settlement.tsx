import { useState } from "react";
import { settlementOrders } from "@/lib/mockData";
import { ArrowUpRight, ArrowDownRight, Clock, Check, AlertCircle, Loader2 } from "lucide-react";

const Settlement = () => {
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "matched" | "settling" | "completed">("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ type: "buy" as "buy" | "sell", security: "", amount: "", price: "" });
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  const filtered = settlementOrders.filter((o) => filterStatus === "all" || o.status === filterStatus);
  const detail = settlementOrders.find((o) => o.id === selectedOrder);

  const handleCreateOrder = () => {
    setOrderSubmitted(true);
    setTimeout(() => {
      setOrderSubmitted(false);
      setNewOrderOpen(false);
      setOrderForm({ type: "buy", security: "", amount: "", price: "" });
    }, 2000);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <Check size={14} className="text-emerald-400" />;
      case "settling": return <Loader2 size={14} className="text-amber-400 animate-spin" />;
      case "matched": return <ArrowUpRight size={14} className="text-primary" />;
      case "failed": return <AlertCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Settlement</h2>
          <p className="text-sm text-muted-foreground mt-1">Atomic DvP settlement orders</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-secondary/60 border border-border p-1">
            {(["all", "pending", "matched", "settling", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                  filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNewOrderOpen(true)}
            className="bg-foreground text-background px-4 py-2 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all"
          >
            + New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Orders table */}
        <div className="lg:col-span-7 border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ID</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Type</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Amount</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total</th>
                <th className="text-center p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelectedOrder(o.id)}
                  className={`border-b border-border/30 hover:bg-secondary/20 transition-colors cursor-pointer ${selectedOrder === o.id ? "bg-secondary/30" : ""}`}
                >
                  <td className="p-4 text-foreground font-mono text-xs">#{o.id}</td>
                  <td className="p-4">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${o.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>{o.type}</span>
                  </td>
                  <td className="p-4 text-foreground font-medium">{o.security}</td>
                  <td className="p-4 text-right text-foreground font-mono text-xs hidden md:table-cell">{o.amount.toLocaleString()}</td>
                  <td className="p-4 text-right text-foreground font-semibold">${o.total.toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {statusIcon(o.status)}
                      <span className={`text-[10px] uppercase tracking-widest font-semibold ${
                        o.status === "completed" ? "text-emerald-400" :
                        o.status === "settling" ? "text-amber-400" :
                        o.status === "matched" ? "text-primary" :
                        "text-muted-foreground"
                      }`}>{o.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Order detail */}
        <div className="lg:col-span-5">
          {detail ? (
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01]">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Order #{detail.id}</span>
                <div className="flex items-center gap-1.5">
                  {statusIcon(detail.status)}
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${
                    detail.status === "completed" ? "text-emerald-400" :
                    detail.status === "settling" ? "text-amber-400" :
                    detail.status === "matched" ? "text-primary" :
                    "text-muted-foreground"
                  }`}>{detail.status}</span>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  ["Type", <span key="t" className={`font-bold ${detail.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>{detail.type.toUpperCase()}</span>],
                  ["Security", detail.security],
                  ["Amount", `${detail.amount.toLocaleString()} tokens`],
                  ["Price", `$${detail.price.toFixed(2)}`],
                  ["Total", `$${detail.total.toLocaleString()}`],
                  ["Counterparty", detail.counterparty],
                  ["Created", new Date(detail.createdAt).toLocaleString()],
                  ...(detail.settledAt ? [["Settled", new Date(detail.settledAt).toLocaleString()]] : []),
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{label as string}</span>
                    <span className="text-xs text-foreground font-medium">{val}</span>
                  </div>
                ))}
              </div>
              {detail.status === "matched" && (
                <div className="p-5 border-t border-border">
                  <button className="w-full bg-primary text-primary-foreground py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all">
                    Execute DvP Settlement
                  </button>
                </div>
              )}
              {detail.status === "completed" && (
                <div className="p-5 border-t border-border text-center">
                  <a href="#" className="text-xs text-primary hover:underline">View on Solscan →</a>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-12 text-center">
              <div className="text-sm text-muted-foreground">Select an order to view details</div>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {newOrderOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-50" onClick={() => { setNewOrderOpen(false); setOrderSubmitted(false); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border z-50 shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">New Settlement Order</span>
              <button onClick={() => { setNewOrderOpen(false); setOrderSubmitted(false); }} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {orderSubmitted ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-primary" />
                </div>
                <div className="text-lg font-semibold text-foreground mb-2">Order Created</div>
                <div className="text-sm text-muted-foreground">Awaiting counterparty match for atomic settlement.</div>
              </div>
            ) : (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex gap-2">
                  {(["buy", "sell"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderForm({ ...orderForm, type: t })}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-semibold transition-all border ${
                        orderForm.type === t
                          ? t === "buy" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-red-500/20 border-red-500/50 text-red-400"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security</label>
                  <select
                    value={orderForm.security}
                    onChange={(e) => setOrderForm({ ...orderForm, security: e.target.value })}
                    className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none"
                  >
                    <option value="">Select security</option>
                    <option value="DINO-VA">DINO-VA</option>
                    <option value="CRF-I">CRF-I</option>
                    <option value="GB-30">GB-30</option>
                    <option value="META-M">META-M</option>
                    <option value="SOLT-E">SOLT-E</option>
                    <option value="HIN-1">HIN-1</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</label>
                    <input type="number" value={orderForm.amount} onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })} placeholder="0" className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Price</label>
                    <input type="number" value={orderForm.price} onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })} placeholder="$0.00" className="w-full mt-2 bg-secondary border border-border px-4 py-3 text-foreground text-sm focus:outline-none" />
                  </div>
                </div>
                <button
                  onClick={handleCreateOrder}
                  disabled={!orderForm.security || !orderForm.amount || !orderForm.price}
                  className="w-full bg-foreground text-background py-3 text-[10px] uppercase tracking-widest font-semibold hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Create Order
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Settlement;
