import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Layers,
  RefreshCw,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import {
  InternalPortalLayout,
  SidebarMenuItem,
} from "@/components/InternalPortalLayout";
import { apiFetch } from "@/lib/api";
import { formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const KitchenKDSView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeRestaurantId } = useAppStore();
  const [activeMenuId, setActiveMenuId] = useState<string>("all");

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
  const queuedCount = activeKitchenOrders.filter((o) => o.status === "queued").length;
  const preparingCount = activeKitchenOrders.filter(
    (o) => o.status === "preparing"
  ).length;
  const readyCount = activeKitchenOrders.filter((o) => o.status === "ready").length;
  const pendingCount = queuedCount + preparingCount;

  const crowdState =
    pendingCount >= 5
      ? { label: "Peak Rush (+8m Auto ETA)", badge: "bg-rose-500 text-white" }
      : pendingCount >= 2
      ? { label: "Moderate Load (+4m Buffer)", badge: "bg-[#FF6B4A] text-white" }
      : { label: "Standard Kitchen Load", badge: "bg-emerald-600 text-white" };

  const sidebarItems: SidebarMenuItem[] = [
    {
      id: "all",
      label: "All Active Tickets",
      icon: <Layers className="w-4 h-4" />,
      badge: activeKitchenOrders.length,
    },
    {
      id: "queued",
      label: "New / Queued",
      icon: <Clock className="w-4 h-4" />,
      badge: queuedCount,
      badgeColor: queuedCount > 0 ? "bg-rose-500 text-white" : undefined,
    },
    {
      id: "preparing",
      label: "Cooking on Line",
      icon: <Flame className="w-4 h-4" />,
      badge: preparingCount,
    },
    {
      id: "ready",
      label: "Ready for Pickup",
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: readyCount,
    },
    {
      id: "requests",
      label: "Runner & Condiments",
      icon: <Bell className="w-4 h-4" />,
      badge: serviceRequests.length,
      badgeColor: serviceRequests.length > 0 ? "bg-[#FF6B4A] text-white" : undefined,
    },
  ];

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
      queryClient.invalidateQueries({
        queryKey: ["service-requests", activeRestaurantId],
      });
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

  const filteredOrders =
    activeMenuId === "all" || activeMenuId === "requests"
      ? activeKitchenOrders
      : activeKitchenOrders.filter((o) => o.status === activeMenuId);

  return (
    <InternalPortalLayout
      portalTitle="Kitchen Display System"
      portalSubtitle="Live WebSocket ticket queue, crowd-based prep timer & manual chef overrides"
      portalRoleBadge="KITCHEN KDS"
      menuItems={sidebarItems}
      activeMenuId={activeMenuId}
      onSelectMenu={setActiveMenuId}
      headerActions={
        <span
          className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${crowdState.badge}`}
        >
          <Flame className="w-3.5 h-3.5" />
          {crowdState.label}
        </span>
      }
    >
      <div className="space-y-6">
        {/* Runner & Condiments View */}
        {(activeMenuId === "requests" || serviceRequests.length > 0) && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-[#141414] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FF6B4A]" />
                <span>Live Table Runner & Condiment Requests ({serviceRequests.length})</span>
              </div>
            </div>
            {serviceRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-4">
                No pending table runner or condiment requests right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {serviceRequests.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="p-4 rounded-2xl bg-[#FAF8F6] border border-stone-200/80 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white font-extrabold text-[10px]">
                        TABLE #{sr.table_number}
                      </span>
                      <div className="text-xs font-bold text-[#141414] mt-1.5">
                        {sr.label}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteServiceReq(sr.id)}
                      className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#141414] text-white text-xs font-bold transition"
                    >
                      Mark Sent ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Kitchen Order Tickets Grid */}
        {activeMenuId !== "requests" && (
          <>
            {isLoading ? (
              <div className="text-center py-20 text-stone-400 text-sm">
                Loading kitchen tickets...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-14 text-center space-y-3 border border-stone-200/80">
                <UtensilsCrossed className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-base font-extrabold text-[#141414]">
                  No Tickets in This Stage
                </h3>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Orders placed from the Customer App appear here immediately over WebSocket.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredOrders.map((order: any) => {
                  const currentPrep =
                    order.effective_prep_minutes || order.estimated_prep_minutes || 15;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-4">
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
                                  ? `VIP Verified • ${order.customer_phone}`
                                  : "Walk-in Guest"}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[11px] text-stone-400">Bill</div>
                            <div className="text-sm font-extrabold text-[#141414]">
                              {formatPaise(order.total_paise)}
                            </div>
                          </div>
                        </div>

                        {/* Prep ETA Controller */}
                        <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-stone-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-4 h-4 text-[#FF6B4A]" />
                            <span className="text-xs font-extrabold text-[#141414]">
                              ETA: {currentPrep}m
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleUpdateOrder(order.id, {
                                  manual_prep_override_minutes: Math.max(
                                    2,
                                    currentPrep - 2
                                  ),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-[#141414] hover:bg-[#141414] hover:text-white transition"
                            >
                              -2m
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateOrder(order.id, {
                                  manual_prep_override_minutes: currentPrep + 2,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-[#141414] hover:bg-[#141414] hover:text-white transition"
                            >
                              +2m
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateOrder(order.id, {
                                  manual_prep_override_minutes: currentPrep + 5,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-[#FF6B4A] hover:bg-[#FF6B4A] hover:text-white transition"
                            >
                              +5m
                            </button>
                          </div>
                        </div>

                        {/* Ordered Dishes */}
                        <div className="space-y-2">
                          {order.items.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 rounded-2xl bg-[#FAF8F6] border border-stone-200/50 flex items-start justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-[#141414] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
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
                                    Chef Note: {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stage Progression Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 bg-[#FAF8F6] p-1.5 rounded-2xl border border-stone-200/70">
                        {stages.map((st) => {
                          const active = order.status === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={() =>
                                handleUpdateOrder(order.id, { status: st.id })
                              }
                              className={`py-2 rounded-xl text-[11px] font-extrabold transition ${
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
          </>
        )}
      </div>
    </InternalPortalLayout>
  );
};
