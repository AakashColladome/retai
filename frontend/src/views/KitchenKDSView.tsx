import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
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
      ? { label: "Peak Rush (+8m Auto ETA)", badge: "bg-rose-600 text-white" }
      : pendingCount >= 2
      ? { label: "Moderate Load (+4m Buffer)", badge: "bg-[#222423] text-[#9FE870]" }
      : { label: "Standard Kitchen Load", badge: "bg-[#9FE870] text-[#1E201F]" };

  const sidebarItems: SidebarMenuItem[] = [
    {
      id: "all",
      label: "All Kitchen Tickets",
      icon: <Layers className="w-4 h-4" />,
      badge: activeKitchenOrders.length,
    },
    {
      id: "queued",
      label: "New / Queued",
      icon: <Clock className="w-4 h-4" />,
      badge: queuedCount,
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
      label: "Condiments & Runner",
      icon: <Bell className="w-4 h-4" />,
      badge: serviceRequests.length,
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
      portalTitle="INTELLIGENT KITCHEN KDS"
      portalSubtitle="Dedicated chef & line station display — cooking tickets, repeat chapati priority & prep ETA"
      portalRoleBadge="KITCHEN ONLY"
      menuItems={sidebarItems}
      activeMenuId={activeMenuId}
      onSelectMenu={setActiveMenuId}
      showCctvControl={false}
      heroMetrics={[
        {
          label: "Active Cooking Queue",
          value: activeKitchenOrders.length,
          progressPct: Math.min(100, activeKitchenOrders.length * 20 + 25),
        },
        {
          label: "Ready For Pickup",
          value: readyCount,
          progressPct: Math.min(100, readyCount * 30 + 20),
        },
      ]}
      heroRightStat={{
        leftValue: `${pendingCount} Tickets`,
        leftLabel: "LINE STATION LOAD",
        rightValue: "99.4%",
        rightLabel: "KITCHEN SLA",
      }}
      headerActions={
        <span
          className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 ${crowdState.badge}`}
        >
          <Flame className="w-3.5 h-3.5" />
          {crowdState.label}
        </span>
      }
    >
      <div className="space-y-5">
        {/* Condiment & Runner Requests */}
        {(activeMenuId === "requests" || serviceRequests.length > 0) && (
          <div className="bg-white rounded-[26px] p-5 shadow-2xs border border-stone-200/70 space-y-3.5">
            <div className="text-sm font-bold text-[#1E201F] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#65A30D]" />
              <span>Condiment & Table Runner Queue ({serviceRequests.length})</span>
            </div>
            {serviceRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-3">
                No pending condiment or water requests right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serviceRequests.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="p-3.5 rounded-2xl bg-[#F4F6F4] border border-stone-200/70 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#222423] text-[#9FE870] font-bold text-[10px]">
                        TABLE #{sr.table_number}
                      </span>
                      <div className="text-xs font-semibold text-[#1E201F] mt-1">
                        {sr.label}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteServiceReq(sr.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#222423] hover:bg-[#9FE870] text-white hover:text-[#1E201F] text-xs font-bold transition"
                    >
                      Sent ✓
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
              <div className="text-center py-16 text-stone-400 text-sm">
                Loading kitchen tickets...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-[28px] p-14 text-center space-y-2 border border-stone-200/70">
                <UtensilsCrossed className="w-9 h-9 text-stone-300 mx-auto" />
                <h3 className="text-base font-bold text-[#1E201F]">
                  No Kitchen Tickets in This Stage
                </h3>
                <p className="text-xs text-stone-400">
                  Incoming table orders and 1-tap chapati repeats appear here live.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrders.map((order: any) => {
                  const currentPrep =
                    order.effective_prep_minutes || order.estimated_prep_minutes || 15;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-[26px] p-5 shadow-2xs border border-stone-200/70 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#222423] text-[#9FE870] flex flex-col items-center justify-center">
                              <span className="text-[9px] font-semibold text-stone-400 uppercase leading-none">
                                TABLE
                              </span>
                              <span className="text-lg font-bold leading-tight">
                                #{order.table_number}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-0.5 rounded-full bg-[#9FE870]/25 text-[#222423] text-[10px] font-bold uppercase">
                                  {order.status}
                                </span>
                                {order.occasion && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F6F4] text-[#1E201F] text-[10px] font-semibold uppercase">
                                    🎉 {order.occasion}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-400 mt-1">
                                {order.items.reduce((s: number, i: any) => s + i.qty, 0)}{" "}
                                total items on ticket
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Prep ETA Controller */}
                        <div className="p-3 rounded-2xl bg-[#F4F6F4] border border-stone-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-4 h-4 text-[#65A30D]" />
                            <span className="text-xs font-bold text-[#1E201F]">
                              Prep ETA: {currentPrep}m
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
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-[#1E201F] hover:bg-[#222423] hover:text-white transition"
                            >
                              -2m
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateOrder(order.id, {
                                  manual_prep_override_minutes: currentPrep + 2,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-[#1E201F] hover:bg-[#222423] hover:text-white transition"
                            >
                              +2m
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateOrder(order.id, {
                                  manual_prep_override_minutes: currentPrep + 5,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#222423] text-[#9FE870] text-[11px] font-bold hover:opacity-90 transition"
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
                              className="p-3 rounded-2xl bg-[#F4F6F4] flex items-start justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-[#222423] text-[#9FE870] font-bold text-xs flex items-center justify-center shrink-0">
                                    {item.qty}
                                  </span>
                                  <span className="text-xs font-bold text-[#1E201F]">
                                    {item.name.replace(" (3D View)", "")}
                                  </span>
                                  {item.is_repeat && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#9FE870] text-[#1E201F] text-[9px] font-extrabold flex items-center gap-0.5">
                                      <RefreshCw className="w-2.5 h-2.5" /> REPEAT
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <div className="text-[11px] font-medium text-stone-600 mt-1 pl-8">
                                    Chef Note: {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stage Progression Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 bg-[#F4F6F4] p-1.5 rounded-2xl border border-stone-200/70">
                        {stages.map((st) => {
                          const active = order.status === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={() =>
                                handleUpdateOrder(order.id, { status: st.id })
                              }
                              className={`py-2 rounded-xl text-[11px] font-bold transition ${
                                active
                                  ? "bg-[#222423] text-[#9FE870] shadow-xs"
                                  : "text-stone-500 hover:text-[#1E201F]"
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
