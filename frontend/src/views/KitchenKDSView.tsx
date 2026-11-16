import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChefHat,
  Clock,
  Flame,
  RefreshCw,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const KitchenKDSView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeRestaurantId } = useAppStore();
  const [filterStage, setFilterStage] = useState<string>("all");

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

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
  const filteredOrders =
    filterStage === "all"
      ? activeKitchenOrders
      : activeKitchenOrders.filter((o) => o.status === filterStage);

  const pendingCount = activeKitchenOrders.filter(
    (o) => o.status === "queued" || o.status === "preparing"
  ).length;

  const crowdState =
    pendingCount >= 5
      ? { label: "Peak Rush (+8m Auto ETA)", badge: "bg-rose-500 text-white" }
      : pendingCount >= 2
      ? { label: "Moderate Load (+4m Buffer)", badge: "bg-[#FF6B4A] text-white" }
      : { label: "Standard Load", badge: "bg-emerald-600 text-white" };

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

  const stages = [
    { id: "queued", label: "Queued" },
    { id: "preparing", label: "Preparing" },
    { id: "ready", label: "Ready" },
    { id: "served", label: "Served" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#141414] pb-24">
      {/* Standalone Kitchen Portal Top Navigation */}
      <header className="bg-white border-b border-stone-200/80 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#141414] text-white flex items-center justify-center shadow-sm">
              <ChefHat className="w-5 h-5 text-[#FF6B4A]" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                {restaurant?.name || "Restaurant"} • Kitchen Portal (/kitchen)
              </div>
              <h1 className="text-xl font-extrabold text-[#141414] tracking-tight">
                Kitchen Display System <span className="font-light text-stone-400">& Prep Timer</span>
              </h1>
            </div>
          </div>

          {/* Stage Filter Pills & Crowd Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-[#F7F5F2] p-1 rounded-full border border-stone-200/70 text-xs font-bold">
              <button
                onClick={() => setFilterStage("all")}
                className={`px-3.5 py-1.5 rounded-full transition ${
                  filterStage === "all"
                    ? "bg-[#141414] text-white"
                    : "text-stone-500 hover:text-[#141414]"
                }`}
              >
                All ({activeKitchenOrders.length})
              </button>
              {stages.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setFilterStage(st.id)}
                  className={`px-3.5 py-1.5 rounded-full transition ${
                    filterStage === st.id
                      ? "bg-[#141414] text-white"
                      : "text-stone-500 hover:text-[#141414]"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <span
              className={`px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${crowdState.badge}`}
            >
              <Flame className="w-3.5 h-3.5" />
              {crowdState.label}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Live Table Essentials / Runner Bar */}
        {serviceRequests.length > 0 && (
          <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-3">
            <div className="text-xs font-extrabold text-[#141414] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FF6B4A]" />
              <span>Table Runner & Essentials Queue ({serviceRequests.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceRequests.map((sr: any) => (
                <div
                  key={sr.id}
                  className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-stone-200/70 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white font-extrabold text-[10px]">
                      TABLE #{sr.table_number}
                    </span>
                    <div className="text-xs font-bold text-[#141414] mt-1">{sr.label}</div>
                  </div>
                  <button
                    onClick={() => handleCompleteServiceReq(sr.id)}
                    className="px-3.5 py-1.5 rounded-full bg-[#FF6B4A] hover:bg-[#141414] text-white text-xs font-bold transition"
                  >
                    Mark Sent ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kitchen Order Tickets Grid */}
        {isLoading ? (
          <div className="text-center py-20 text-stone-400 text-sm">
            Loading kitchen tickets...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-[36px] p-14 text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <UtensilsCrossed className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="text-lg font-extrabold text-[#141414]">
              All Kitchen Tickets Cleared
            </h3>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              New orders placed from any Table Tablet or QR code will chime and appear here in real time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order: any) => {
              const currentPrep =
                order.effective_prep_minutes || order.estimated_prep_minutes || 15;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-[32px] p-5 shadow-[0_12px_36px_rgba(20,20,20,0.04)] border border-stone-200/60 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    {/* Ticket Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#141414] text-white flex flex-col items-center justify-center">
                          <span className="text-[9px] font-bold text-stone-400 uppercase leading-none">
                            TABLE
                          </span>
                          <span className="text-lg font-black leading-tight">
                            #{order.table_number}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] text-[10px] font-extrabold uppercase">
                              {order.status}
                            </span>
                            {order.occasion && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#F7F5F2] text-[#141414] text-[10px] font-bold uppercase">
                                🎉 {order.occasion}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-stone-400 mt-1">
                            {order.is_phone_verified
                              ? `VIP Guest • ${order.customer_phone}`
                              : "Guest Diner"}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-stone-400">Total</div>
                        <div className="text-sm font-extrabold text-[#141414]">
                          {formatPaise(order.total_paise)}
                        </div>
                      </div>
                    </div>

                    {/* Manual & Crowd Prep Timer Strip */}
                    <div className="p-3 rounded-2xl bg-[#FAF8F6] border border-stone-200/60 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Timer className="w-4 h-4 text-[#FF6B4A]" />
                        <span className="text-xs font-bold text-[#141414]">
                          Prep ETA: {currentPrep}m
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleUpdateOrder(order.id, {
                              manual_prep_override_minutes: Math.max(2, currentPrep - 2),
                            })
                          }
                          className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-extrabold text-[#141414] hover:bg-[#141414] hover:text-white transition"
                        >
                          -2m
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateOrder(order.id, {
                              manual_prep_override_minutes: currentPrep + 2,
                            })
                          }
                          className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-extrabold text-[#141414] hover:bg-[#141414] hover:text-white transition"
                        >
                          +2m
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateOrder(order.id, {
                              manual_prep_override_minutes: currentPrep + 5,
                            })
                          }
                          className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-extrabold text-[#FF6B4A] hover:bg-[#FF6B4A] hover:text-white transition"
                        >
                          +5m
                        </button>
                      </div>
                    </div>

                    {/* Dishes List */}
                    <div className="space-y-2">
                      {order.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#FAF8F6] flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#141414] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                {item.qty}
                              </span>
                              <span className="text-xs font-extrabold text-[#141414]">
                                {item.name.replace(" (3D View)", "")}
                              </span>
                              {item.is_repeat && (
                                <span className="px-2 py-0.5 rounded-full bg-[#FF6B4A] text-white text-[9px] font-extrabold flex items-center gap-0.5">
                                  <RefreshCw className="w-2.5 h-2.5" /> REPEAT
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] font-semibold text-[#FF6B4A] mt-1 pl-8">
                                Note: {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stage Selector Pill Row */}
                  <div className="grid grid-cols-4 gap-1.5 bg-[#FAF8F6] p-1.5 rounded-full border border-stone-200/70">
                    {stages.map((st) => {
                      const active = order.status === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleUpdateOrder(order.id, { status: st.id })}
                          className={`py-2 rounded-full text-[11px] font-extrabold transition ${
                            active
                              ? "bg-[#141414] text-white shadow-xs"
                              : "text-stone-400 hover:text-[#141414]"
                          }`}
                        >
                          {st.label}
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
    </div>
  );
};
