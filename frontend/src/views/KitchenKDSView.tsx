import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Plus,
  RefreshCw,
  Sparkles,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const KitchenKDSView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeRestaurantId } = useAppStore();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["orders", activeRestaurantId],
    queryFn: () => apiFetch(`/api/orders/${activeRestaurantId}?active_only=true`),
    refetchInterval: 3000,
  });

  const { data: serviceRequests = [] } = useQuery<any[]>({
    queryKey: ["service-requests", activeRestaurantId],
    queryFn: () => apiFetch(`/api/service-requests/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  const activeKitchenOrders = orders.filter((o) => o.status !== "paid");
  const pendingCount = activeKitchenOrders.filter(
    (o) => o.status === "queued" || o.status === "preparing"
  ).length;

  const crowdState =
    pendingCount >= 5
      ? { label: "Peak Rush Load (+8m Auto Buffer)", color: "text-rose-400 bg-rose-500/15 border-rose-500/30" }
      : pendingCount >= 2
      ? { label: "Moderate Kitchen Load (+4m Buffer)", color: "text-amber-300 bg-amber-500/15 border-amber-500/30" }
      : { label: "Normal Kitchen Load (Standard Prep)", color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" };

  const handleUpdateOrder = async (
    orderId: string,
    payload: { status?: string; manual_prep_override_minutes?: number }
  ) => {
    try {
      await apiFetch(`/api/orders/${orderId}/kitchen`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      queryClient.invalidateQueries({ queryKey: ["orders", activeRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
    } catch (err: any) {
      alert(`Kitchen update failed: ${err.message}`);
    }
  };

  const handleCompleteServiceReq = async (reqId: string) => {
    try {
      await apiFetch(`/api/service-requests/${reqId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      queryClient.invalidateQueries({ queryKey: ["service-requests", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const stages: { id: string; label: string; badge: string }[] = [
    { id: "queued", label: "Queued", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
    { id: "preparing", label: "Preparing", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    { id: "ready", label: "Ready for Pickup", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    { id: "served", label: "Served at Table", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* KDS Top Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-orange-400">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">
              Live Kitchen Display System (KDS) & Crowd Prep Engine
            </h1>
            <p className="text-xs text-slate-400">
              Real-time WebSocket ticket board • Adjust prep times manually or let crowd-load auto-calculate ETA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${crowdState.color}`}>
            <Flame className="w-4 h-4" />
            {crowdState.label}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
            Active Tickets: <strong className="text-white">{activeKitchenOrders.length}</strong>
          </span>
        </div>
      </div>

      {/* Quick Runner / Kitchen Condiment Service Requests */}
      {serviceRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2.5">
          <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Live Table Essentials & Runner Requests ({serviceRequests.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {serviceRequests.map((sr: any) => (
              <div
                key={sr.id}
                className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                    TABLE #{sr.table_number}
                  </span>
                  <div className="text-xs font-bold text-white mt-1">{sr.label}</div>
                </div>
                <button
                  onClick={() => handleCompleteServiceReq(sr.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Mark Sent ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Kitchen Order Tickets Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading live kitchen tickets...</div>
      ) : activeKitchenOrders.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <UtensilsCrossed className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Active Kitchen Tickets Right Now</h3>
          <p className="text-xs text-slate-400">
            Place a new order from the Customer (Tablet / QR) view and watch it appear here with a live chime!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeKitchenOrders.map((order: any) => {
            const currentPrep = order.effective_prep_minutes || order.estimated_prep_minutes || 15;
            const currentStage = stages.find((s) => s.id === order.status) || stages[0];

            return (
              <div
                key={order.id}
                className="rounded-2xl bg-slate-900 border-2 border-slate-800 flex flex-col justify-between overflow-hidden shadow-xl"
              >
                {/* Ticket Top Bar */}
                <div>
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-black text-base">
                        TABLE #{order.table_number}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border ${currentStage.badge}`}
                          >
                            {currentStage.label.toUpperCase()}
                          </span>
                          {order.occasion && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold uppercase">
                              🎉 {order.occasion}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {order.is_phone_verified
                            ? `Verified Guest (${order.customer_phone})`
                            : "Walk-in Guest"}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Bill Value</div>
                      <div className="text-sm font-bold text-emerald-400">
                        {formatPaise(order.total_paise)}
                      </div>
                    </div>
                  </div>

                  {/* Prep Time Controller (AI Crowd Estimate + Manual Chef Override) */}
                  <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-300">Prep ETA:</span>
                      <span className="text-sm font-extrabold text-amber-300">
                        {currentPrep} mins
                      </span>
                      {order.manual_prep_override_minutes && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          Manual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          handleUpdateOrder(order.id, {
                            manual_prep_override_minutes: Math.max(2, currentPrep - 2),
                          })
                        }
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
                      >
                        -2m
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateOrder(order.id, {
                            manual_prep_override_minutes: currentPrep + 2,
                          })
                        }
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700"
                      >
                        +2m
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateOrder(order.id, {
                            manual_prep_override_minutes: currentPrep + 5,
                          })
                        }
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-orange-400 border border-slate-700"
                      >
                        +5m
                      </button>
                    </div>
                  </div>

                  {/* Line Items List */}
                  <div className="p-4 space-y-2.5">
                    {order.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-extrabold text-xs">
                              {item.qty}x
                            </span>
                            <span className="text-xs font-bold text-white">
                              {item.name.replace(" (3D View)", "")}
                            </span>
                            {item.is_repeat && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-0.5">
                                <RefreshCw className="w-2.5 h-2.5" /> REPEAT
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-amber-300 mt-1 font-medium">
                              Chef Note: {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage Progression Buttons */}
                <div className="p-3.5 bg-slate-950 border-t border-slate-800 grid grid-cols-4 gap-1.5">
                  {stages.map((st) => {
                    const active = order.status === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => handleUpdateOrder(order.id, { status: st.id })}
                        className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition text-center ${
                          active
                            ? "bg-orange-600 text-white shadow"
                            : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        {st.label.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
