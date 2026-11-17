import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  FileSpreadsheet,
  LayoutGrid,
  Lock,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  Utensils,
  Volume2,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  InternalPortalLayout,
  SidebarMenuItem,
} from "@/components/InternalPortalLayout";
import { apiFetch } from "@/lib/api";
import { formatPaise, playAlertChime } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const ManagerFloorView: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    activeRole,
    lastAmberAlert,
    setLastAmberAlert,
    setSelectedTableNumber,
    setActiveRole,
  } = useAppStore();

  const isOwnerPortal = activeRole === "owner";

  const [activeTab, setActiveTab] = useState<string>(
    isOwnerPortal ? "analytics" : "floor"
  );

  // Add Menu Item State (for Owner/Manager Menu Manager tab)
  const [newDishName, setNewDishName] = useState("");
  const [newDishCategory, setNewDishCategory] = useState("Main Course Handi");
  const [newDishPriceRupees, setNewDishPriceRupees] = useState("280");
  const [newDishPrep, setNewDishPrep] = useState("12");
  const [newDishDesc, setNewDishDesc] = useState(
    "Prepared fresh with house-ground spices and farm ingredients."
  );
  const [dishBusy, setDishBusy] = useState(false);

  useEffect(() => {
    setActiveTab(activeRole === "owner" ? "analytics" : "floor");
  }, [activeRole]);

  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 3000,
  });

  const { data: serviceRequests = [] } = useQuery<any[]>({
    queryKey: ["service-requests", activeRestaurantId],
    queryFn: () => apiFetch(`/api/service-requests/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  const { data: menuData } = useQuery<any>({
    queryKey: ["menu", activeRestaurantId],
    queryFn: () => apiFetch(`/api/menu/${activeRestaurantId}`),
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["analytics", activeRestaurantId],
    queryFn: () => apiFetch(`/api/analytics/${activeRestaurantId}`),
    enabled: activeTab === "analytics" || activeTab === "customers",
  });

  const { data: settlements, error: settlementError } = useQuery<any>({
    queryKey: ["settlements", activeRestaurantId],
    queryFn: () => apiFetch(`/api/settlements/${activeRestaurantId}`),
    enabled: activeTab === "settlements",
  });

  const emptyCount = tables.filter((t) => t.status === "empty").length;
  const seatedCount = tables.filter((t) => t.status === "seated").length;
  const amberCount = tables.filter((t) => t.status === "amber").length;

  const sidebarItems: SidebarMenuItem[] = isOwnerPortal
    ? [
        {
          id: "analytics",
          label: "Executive Analytics",
          icon: <BarChart3 className="w-4 h-4" />,
        },
        {
          id: "settlements",
          label: "Settlement Report",
          icon: <FileSpreadsheet className="w-4 h-4" />,
          badge: "Read-Only",
        },
        {
          id: "menu",
          label: "Menu & Dish Catalog",
          icon: <Utensils className="w-4 h-4" />,
          badge: menuData?.items?.length || 0,
        },
        {
          id: "customers",
          label: "Retained Guests (DPDP)",
          icon: <Users className="w-4 h-4" />,
          badge: analytics?.retained_customers?.length,
        },
        {
          id: "floor",
          label: "Live Floor Map",
          icon: <LayoutGrid className="w-4 h-4" />,
          badge: amberCount > 0 ? `${amberCount} Amber` : seatedCount,
          badgeColor: amberCount > 0 ? "bg-amber-400 text-[#141414]" : undefined,
        },
      ]
    : [
        {
          id: "floor",
          label: "Live Table Map",
          icon: <LayoutGrid className="w-4 h-4" />,
          badge: amberCount > 0 ? `${amberCount} Amber` : `${seatedCount} Seated`,
          badgeColor: amberCount > 0 ? "bg-amber-400 text-[#141414]" : undefined,
        },
        {
          id: "requests",
          label: "1-Tap Guest Requests",
          icon: <Bell className="w-4 h-4" />,
          badge: serviceRequests.length,
          badgeColor:
            serviceRequests.length > 0 ? "bg-[#FF6B4A] text-white" : undefined,
        },
        {
          id: "menu",
          label: "Menu & Dish Manager",
          icon: <Utensils className="w-4 h-4" />,
          badge: menuData?.items?.length || 0,
        },
        {
          id: "analytics",
          label: "Floor Analytics",
          icon: <BarChart3 className="w-4 h-4" />,
        },
        {
          id: "cctv",
          label: "CCTV Vision Roadmap",
          icon: <Camera className="w-4 h-4" />,
          badge: "Phase 2",
        },
      ];

  const handleMarkSeated = async (tableNumber: number, guests = 2) => {
    try {
      await apiFetch("/api/sessions/start", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          table_number: tableNumber,
          guest_count: guests,
          source: "manager",
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkEmpty = async (tableNumber: number) => {
    try {
      await apiFetch(`/api/tables/${activeRestaurantId}/${tableNumber}/mark-empty`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleForceAmber = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/force-amber`, {
        method: "POST",
      });
      playAlertChime("amber");
      setLastAmberAlert({
        table_number: res.table_number,
        guest_count: res.guest_count,
        source: res.source,
        message: res.message,
        timestamp: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
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

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim()) return;
    setDishBusy(true);
    try {
      const paise = Math.max(100, Math.round(Number(newDishPriceRupees) * 100));
      await apiFetch(`/api/menu/${activeRestaurantId}`, {
        method: "POST",
        body: JSON.stringify({
          name: newDishName,
          category: newDishCategory,
          description: newDishDesc,
          ingredients: ["Fresh Spices", "Chef Special"],
          base_price_paise: paise,
          prep_time_minutes: Number(newDishPrep) || 12,
          is_veg: true,
          spice_level: "medium",
          image_url: "/images/dishes/paneer-butter-masala.svg",
        }),
      });
      setNewDishName("");
      queryClient.invalidateQueries({ queryKey: ["menu", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDishBusy(false);
    }
  };

  return (
    <InternalPortalLayout
      portalTitle={isOwnerPortal ? "Restaurant Admin Portal" : "Floor Manager Portal"}
      portalSubtitle={
        isOwnerPortal
          ? "Executive analytics, read-only settlements, menu pricing & DPDP customer retention"
          : "Live Red / Green / Amber table occupancy radar, guest service requests & floor alerts"
      }
      portalRoleBadge={isOwnerPortal ? "OWNER ADMIN" : "MANAGER"}
      menuItems={sidebarItems}
      activeMenuId={activeTab}
      onSelectMenu={setActiveTab}
      headerActions={
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Empty: {emptyCount}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Seated: {seatedCount}
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              Amber: {amberCount}
            </span>
          </div>
          <button
            onClick={() => playAlertChime("amber")}
            className="px-3.5 py-1.5 rounded-xl bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#FF6B4A]" />
            Chime
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Live Amber Alert Banner */}
        {lastAmberAlert && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-[#141414] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-black text-[#141414] flex items-center gap-2">
                  <span>AMBER IDLE ALERT — TABLE #{lastAmberAlert.table_number}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px] font-bold uppercase">
                    Source: {lastAmberAlert.source}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5">{lastAmberAlert.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedTableNumber(lastAmberAlert.table_number);
                  window.history.pushState({}, "", "/customer");
                  setActiveRole("customer");
                  setLastAmberAlert(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs transition"
              >
                Open Table #{lastAmberAlert.table_number} Menu →
              </button>
              <button
                onClick={() => setLastAmberAlert(null)}
                className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 1: LIVE TABLE OCCUPANCY MAP (RED / GREEN / AMBER)           */}
        {/* ================================================================ */}
        {activeTab === "floor" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {tables.map((t: any) => {
              const isRed = t.status === "empty";
              const isGreen = t.status === "seated";
              const isAmber = t.status === "amber";
              const sess = t.session;
              const hasOrders = t.active_orders && t.active_orders.length > 0;

              const statusPill = isRed
                ? "bg-rose-500 text-white"
                : isAmber
                ? "bg-amber-400 text-[#141414] animate-pulse"
                : "bg-emerald-600 text-white";

              const borderStyle = isRed
                ? "border-stone-200/90"
                : isAmber
                ? "border-amber-400 ring-2 ring-amber-300/40"
                : "border-emerald-400";

              return (
                <div
                  key={t.table_id}
                  className={`bg-white rounded-3xl p-5 shadow-xs border-2 flex flex-col justify-between transition ${borderStyle}`}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#141414]">
                          Table #{t.table_number}
                        </h3>
                        <div className="text-[11px] font-medium text-stone-400">
                          {t.zone} • {t.capacity} Seats
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusPill}`}
                      >
                        {isRed ? "Empty • Red" : isAmber ? "Amber • Idle" : "Seated • Green"}
                      </span>
                    </div>

                    {isRed ? (
                      <div className="py-8 rounded-2xl bg-[#FAF8F6] border border-stone-200/50 text-center text-xs font-medium text-stone-400">
                        Available to seat guests
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-stone-200/70 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 font-medium flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#141414]" />
                            <strong className="text-[#141414]">
                              {sess?.guest_count} Guests
                            </strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-[#141414] font-bold text-[10px] uppercase">
                            {sess?.source}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">Seated Time</span>
                          <span className="font-mono font-bold text-[#141414]">
                            {sess?.seconds_seated || 0}s
                            {!sess?.first_order_at &&
                              ` / ${sess?.amber_threshold_seconds || 60}s`}
                          </span>
                        </div>

                        {sess?.is_phone_verified ? (
                          <div className="text-[11px] font-bold text-emerald-700">
                            ✓ Verified: {sess.customer_phone} (5% Off)
                          </div>
                        ) : (
                          <div className="text-[11px] text-stone-400">Guest Session</div>
                        )}

                        {hasOrders ? (
                          <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between">
                            <span className="text-emerald-700 font-extrabold uppercase text-[11px]">
                              {t.active_orders[0].status}
                            </span>
                            <span className="font-extrabold text-[#141414]">
                              {formatPaise(t.active_orders[0].total_paise)}
                            </span>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between">
                            <span className="text-amber-700 font-bold text-[11px]">
                              No order yet
                            </span>
                            {isGreen && sess && (
                              <button
                                onClick={() => handleForceAmber(sess.session_id)}
                                className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold transition"
                              >
                                Test Amber 🔔
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3.5 mt-3.5 border-t border-stone-100 flex items-center gap-2">
                    {isRed ? (
                      <button
                        onClick={() => handleMarkSeated(t.table_number, t.capacity)}
                        className="w-full py-2.5 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Mark Seated ({t.capacity} Guests)
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTableNumber(t.table_number);
                            window.history.pushState({}, "", "/customer");
                            setActiveRole("customer");
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-bold transition"
                        >
                          Open Table
                        </button>
                        <button
                          onClick={() => handleMarkEmpty(t.table_number)}
                          className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Empty
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 2: 1-TAP GUEST SERVICE REQUESTS                             */}
        {/* ================================================================ */}
        {activeTab === "requests" && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <h3 className="text-base font-extrabold text-[#141414]">
              Active 1-Tap Table Requests ({serviceRequests.length})
            </h3>
            {serviceRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-8 text-center">
                All table requests for water, cutlery, and napkins have been fulfilled!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceRequests.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="p-4 rounded-2xl bg-[#FAF8F6] border border-stone-200/80 flex items-center justify-between"
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px] font-extrabold">
                        Table #{sr.table_number}
                      </span>
                      <div className="text-xs font-bold text-[#141414] mt-1.5">
                        {sr.label}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteServiceReq(sr.id)}
                      className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#141414] text-white text-xs font-bold transition"
                    >
                      Done ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 3: MENU & DISH CATALOG MANAGER                              */}
        {/* ================================================================ */}
        {activeTab === "menu" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Add New Dish Form */}
            <form
              onSubmit={handleAddMenuItem}
              className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4 h-fit text-xs"
            >
              <h3 className="text-base font-extrabold text-[#141414] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#FF6B4A]" />
                Add Dish to Menu
              </h3>
              <div>
                <label className="block text-stone-400 font-bold mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder="e.g. Kadai Paneer Handi"
                  className="w-full bg-[#F7F5F2] rounded-xl px-3.5 py-2.5 font-bold text-[#141414]"
                />
              </div>
              <div>
                <label className="block text-stone-400 font-bold mb-1">Category</label>
                <input
                  type="text"
                  value={newDishCategory}
                  onChange={(e) => setNewDishCategory(e.target.value)}
                  className="w-full bg-[#F7F5F2] rounded-xl px-3.5 py-2.5 font-bold text-[#141414]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 font-bold mb-1">
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={newDishPriceRupees}
                    onChange={(e) => setNewDishPriceRupees(e.target.value)}
                    className="w-full bg-[#F7F5F2] rounded-xl px-3.5 py-2.5 font-bold text-[#141414]"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 font-bold mb-1">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={newDishPrep}
                    onChange={(e) => setNewDishPrep(e.target.value)}
                    className="w-full bg-[#F7F5F2] rounded-xl px-3.5 py-2.5 font-bold text-[#141414]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-stone-400 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDishDesc}
                  onChange={(e) => setNewDishDesc(e.target.value)}
                  className="w-full bg-[#F7F5F2] rounded-xl px-3.5 py-2 font-medium text-[#141414]"
                />
              </div>
              <button
                type="submit"
                disabled={dishBusy}
                className="w-full py-3 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold transition"
              >
                {dishBusy ? "Adding Dish..." : "Add Dish to Live Catalog"}
              </button>
            </form>

            {/* Right 2 Cols: Current Menu Items Table */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#141414]">
                  Active Menu Catalog ({menuData?.items?.length || 0} Dishes)
                </h3>
                <span className="text-xs text-stone-400">
                  Prices computed server-side in integer paise
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400">
                      <th className="py-3 px-2">Dish</th>
                      <th className="py-3 px-2">Category</th>
                      <th className="py-3 px-2">Base Price</th>
                      <th className="py-3 px-2">Customer Display Price</th>
                      <th className="py-3 px-2">Prep</th>
                      <th className="py-3 px-2">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(menuData?.items || []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#FAF8F6]">
                        <td className="py-2.5 px-2 flex items-center gap-2.5 font-extrabold text-[#141414]">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 object-contain shrink-0"
                          />
                          <span>{item.name.replace(" (3D View)", "")}</span>
                        </td>
                        <td className="py-2.5 px-2 text-stone-500">{item.category}</td>
                        <td className="py-2.5 px-2 font-semibold text-stone-600">
                          {formatPaise(item.base_price_paise)}
                        </td>
                        <td className="py-2.5 px-2 font-extrabold text-[#FF6B4A]">
                          {formatPaise(item.display_price_paise)}
                        </td>
                        <td className="py-2.5 px-2 text-stone-500">
                          {item.prep_time_minutes}m
                        </td>
                        <td className="py-2.5 px-2 font-bold text-[#141414]">
                          {item.total_orders_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 4: EXECUTIVE ANALYTICS (SAMPLE DATA LABELED)                */}
        {/* ================================================================ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-stone-600">
                <Sparkles className="w-4 h-4 text-[#FF6B4A]" />
                <span>
                  <strong className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px]">
                    Sample data
                  </strong>{" "}
                  Seeded historical metrics are badged as Sample data alongside your live orders.
                </span>
              </div>
              {analytics?.summary && (
                <div className="text-xs font-bold text-[#141414]">
                  Live Orders: {analytics.summary.live_orders_count} • Sample Orders:{" "}
                  {analytics.summary.sample_orders_count}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141414]">
                      Best-Selling Dishes
                    </h3>
                    <p className="text-xs text-stone-400">Units ordered across tables</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                    Sample data
                  </span>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.best_sellers || []}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1EFEA" />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={145}
                        stroke="#141414"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E5E7EB",
                          borderRadius: "16px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="orders" fill="#FF6B4A" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141414]">
                      Peak Dining Hours
                    </h3>
                    <p className="text-xs text-stone-400">Hourly order volume</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                    Sample data
                  </span>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.peak_hours || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1EFEA" />
                      <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={11} />
                      <YAxis stroke="#9CA3AF" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E5E7EB",
                          borderRadius: "16px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="orders" fill="#141414" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 5: RETAINED CUSTOMERS & DPDP REGISTRY                       */}
        {/* ================================================================ */}
        {activeTab === "customers" && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-[#141414]">
                  Retained Customers & DPDP Act Consent Registry
                </h3>
                <p className="text-xs text-stone-400">
                  Verified guests who opted in via the 5% mobile discount
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                Sample data + Live Guests
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400">
                    <th className="py-3 px-3">Guest Name</th>
                    <th className="py-3 px-3">WhatsApp Phone</th>
                    <th className="py-3 px-3">DPDP Consent</th>
                    <th className="py-3 px-3">Visits</th>
                    <th className="py-3 px-3">Total Spend</th>
                    <th className="py-3 px-3">Favorites</th>
                    <th className="py-3 px-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(analytics?.retained_customers || []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#FAF8F6]">
                      <td className="py-3 px-3 font-extrabold text-[#141414]">{c.name}</td>
                      <td className="py-3 px-3 font-mono text-stone-600">{c.phone}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
                          ✓ DPDP Consented
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#FF6B4A]">
                        {c.visit_count}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#141414]">
                        {formatPaise(c.total_spent_paise)}
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {c.favorite_items?.slice(0, 2).join(", ") || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.is_sample_data
                              ? "bg-[#F7F5F2] text-stone-500"
                              : "bg-[#141414] text-white"
                          }`}
                        >
                          {c.is_sample_data ? "Sample data" : "Live Verified"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 6: READ-ONLY OWNER SETTLEMENT REPORT                        */}
        {/* ================================================================ */}
        {activeTab === "settlements" && (
          <div className="space-y-5">
            {settlementError ? (
              <div className="bg-white rounded-3xl p-10 text-center space-y-3 border border-stone-200/80">
                <Lock className="w-8 h-8 text-[#FF6B4A] mx-auto" />
                <h3 className="text-base font-extrabold text-[#141414]">
                  Restaurant Owner Role Required
                </h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">
                  Switch to <strong>Restaurant Admin (/owner)</strong> in the left sidebar under "Switch Role Portal" to view the read-only Owner Settlement Report.
                </p>
              </div>
            ) : (
              <>
                {settlements?.summary_paise && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-3xl p-5 border border-stone-200/80">
                      <div className="text-xs text-stone-400 font-medium">
                        Gross Customer Collections
                      </div>
                      <div className="text-2xl font-extrabold text-[#141414] mt-1">
                        {formatPaise(settlements.summary_paise.total_gross_paise)}
                      </div>
                    </div>
                    <div className="bg-white rounded-3xl p-5 border border-stone-200/80">
                      <div className="text-xs text-stone-400 font-medium">
                        5% Verified Discounts
                      </div>
                      <div className="text-2xl font-extrabold text-[#FF6B4A] mt-1">
                        -{formatPaise(settlements.summary_paise.total_discount_paise)}
                      </div>
                    </div>
                    <div className="bg-white rounded-3xl p-5 border border-stone-200/80">
                      <div className="text-xs text-stone-400 font-medium">
                        GST (on Subtotal - Discount)
                      </div>
                      <div className="text-2xl font-extrabold text-[#141414] mt-1">
                        {formatPaise(settlements.summary_paise.total_tax_paise)}
                      </div>
                    </div>
                    <div className="bg-[#141414] text-white rounded-3xl p-5 shadow-lg">
                      <div className="text-xs text-stone-400 font-medium">
                        Net Restaurant Settlement
                      </div>
                      <div className="text-2xl font-extrabold text-white mt-1">
                        {formatPaise(settlements.summary_paise.total_restaurant_net_paise)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-[#141414] flex items-center gap-2">
                        <span>Read-Only Settlement Ledger</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F7F5F2] text-stone-500 text-[10px] font-bold">
                          Read-Only
                        </span>
                      </h3>
                      <p className="text-xs text-stone-400">
                        All amounts computed server-side in integer paise
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                      Sample data included
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400">
                          <th className="py-3 px-3">Table</th>
                          <th className="py-3 px-3">Base Food Value</th>
                          <th className="py-3 px-3">5% Discount</th>
                          <th className="py-3 px-3">GST</th>
                          <th className="py-3 px-3">Gross Paid</th>
                          <th className="py-3 px-3">Net Restaurant Payout</th>
                          <th className="py-3 px-3">Method</th>
                          <th className="py-3 px-3">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {(settlements?.entries || []).map((e: any) => (
                          <tr key={e.id} className="hover:bg-[#FAF8F6]">
                            <td className="py-3 px-3 font-extrabold text-[#141414]">
                              Table #{e.table_number}
                            </td>
                            <td className="py-3 px-3 text-stone-600">
                              {formatPaise(e.subtotal_base_paise)}
                            </td>
                            <td className="py-3 px-3 text-[#FF6B4A] font-semibold">
                              -{formatPaise(e.customer_discount_paise)}
                            </td>
                            <td className="py-3 px-3 text-stone-600">
                              {formatPaise(e.tax_paise)}
                            </td>
                            <td className="py-3 px-3 font-bold text-[#141414]">
                              {formatPaise(e.gross_bill_paise)}
                            </td>
                            <td className="py-3 px-3 font-extrabold text-emerald-700">
                              {formatPaise(e.restaurant_net_paise)}
                            </td>
                            <td className="py-3 px-3 uppercase font-mono text-stone-500">
                              {e.payment_method}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.is_sample_data
                                    ? "bg-[#F7F5F2] text-stone-500"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {e.is_sample_data ? "Sample data" : "Live Settled"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 7: PHASE 2 CCTV VISION ROADMAP                              */}
        {/* ================================================================ */}
        {activeTab === "cctv" && (
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-stone-200/80 space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] text-xs font-extrabold uppercase">
              <Camera className="w-3.5 h-3.5" />
              Phase 2 Hardware Vision Roadmap
            </span>
            <h3 className="text-xl font-extrabold text-[#141414]">
              Automated Overhead CCTV Occupancy & Table Turn SLA
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed max-w-2xl">
              In Phase 2, existing overhead RTSP cameras connect to our edge worker to automatically detect guest seating count (`source="cctv"`) and trigger Amber idle alerts if no order is placed within threshold. Use the{" "}
              <strong className="text-[#141414]">Simulate CCTV Seating</strong> button in the left sidebar to test this workflow live today.
            </p>
          </div>
        )}
      </div>
    </InternalPortalLayout>
  );
};
