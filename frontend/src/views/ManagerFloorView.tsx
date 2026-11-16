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
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
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

  const [activeTab, setActiveTab] = useState<
    "floor" | "analytics" | "settlements" | "customers"
  >(activeRole === "owner" ? "analytics" : "floor");

  useEffect(() => {
    if (activeRole === "owner") {
      setActiveTab("analytics");
    } else {
      setActiveTab("floor");
    }
  }, [activeRole]);

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

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
      queryClient.invalidateQueries({ queryKey: ["service-requests", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const emptyCount = tables.filter((t) => t.status === "empty").length;
  const seatedCount = tables.filter((t) => t.status === "seated").length;
  const amberCount = tables.filter((t) => t.status === "amber").length;

  const isOwnerPortal = activeRole === "owner";

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#141414] pb-24">
      {/* Standalone Portal Top Header */}
      <header className="bg-white border-b border-stone-200/80 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#141414] text-white flex items-center justify-center shadow-sm">
              {isOwnerPortal ? (
                <TrendingUp className="w-5 h-5 text-[#FF6B4A]" />
              ) : (
                <LayoutGrid className="w-5 h-5 text-[#FF6B4A]" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                {restaurant?.name || "Restaurant"} •{" "}
                {isOwnerPortal
                  ? "Restaurant Admin Portal (/owner)"
                  : "Floor Manager Portal (/manager)"}
              </div>
              <h1 className="text-xl font-extrabold text-[#141414] tracking-tight">
                {isOwnerPortal ? (
                  <>
                    Owner Analytics <span className="font-light text-stone-400">& Settlements</span>
                  </>
                ) : (
                  <>
                    Live Table Map{" "}
                    <span className="font-light text-stone-400">& Occupancy Radar</span>
                  </>
                )}
              </h1>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 bg-[#F7F5F2] p-1.5 rounded-full border border-stone-200/80 text-xs font-bold flex-wrap">
            <button
              onClick={() => setActiveTab("floor")}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition ${
                activeTab === "floor"
                  ? "bg-[#141414] text-white shadow-xs"
                  : "text-stone-500 hover:text-[#141414]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Table Map ({tables.length})
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition ${
                activeTab === "analytics"
                  ? "bg-[#141414] text-white shadow-xs"
                  : "text-stone-500 hover:text-[#141414]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("customers")}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition ${
                activeTab === "customers"
                  ? "bg-[#141414] text-white shadow-xs"
                  : "text-stone-500 hover:text-[#141414]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Retained Guests
            </button>
            <button
              onClick={() => setActiveTab("settlements")}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition ${
                activeTab === "settlements"
                  ? "bg-[#141414] text-white shadow-xs"
                  : "text-stone-500 hover:text-[#141414]"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Settlement Report
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Live Amber Alert Banner */}
        {lastAmberAlert && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
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
                className="px-4 py-2 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs transition"
              >
                Open Table #{lastAmberAlert.table_number} Menu →
              </button>
              <button
                onClick={() => setLastAmberAlert(null)}
                className="px-3.5 py-2 rounded-full bg-white border border-stone-200 text-xs font-bold text-stone-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 1: LIVE TABLE OCCUPANCY MAP (RED / GREEN / AMBER)            */}
        {/* ================================================================ */}
        {activeTab === "floor" && (
          <div className="space-y-6">
            {/* Occupancy Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-[28px] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.03)] border border-stone-200/60">
              <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                <span className="px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Empty (Red): {emptyCount}
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Seated (Green): {seatedCount}
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  Idle No-Order (Amber): {amberCount}
                </span>
              </div>

              <button
                onClick={() => playAlertChime("amber")}
                className="px-3.5 py-1.5 rounded-full bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#FF6B4A]" />
                Test Manager Chime
              </button>
            </div>

            {/* Active 1-Tap Table Essentials Queue */}
            {serviceRequests.length > 0 && (
              <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-3">
                <div className="text-xs font-extrabold text-[#141414] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#FF6B4A]" />
                  <span>Active 1-Tap Guest Requests ({serviceRequests.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {serviceRequests.map((sr: any) => (
                    <div
                      key={sr.id}
                      className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-stone-200/70 flex items-center justify-between"
                    >
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px] font-extrabold">
                          Table #{sr.table_number}
                        </span>
                        <div className="text-xs font-bold text-[#141414] mt-1">
                          {sr.label}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteServiceReq(sr.id)}
                        className="px-3.5 py-1.5 rounded-full bg-[#FF6B4A] hover:bg-[#141414] text-white text-xs font-bold transition"
                      >
                        Done ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                  ? "border-rose-200/90"
                  : isAmber
                  ? "border-amber-400 ring-2 ring-amber-300/50"
                  : "border-emerald-300";

                return (
                  <div
                    key={t.table_id}
                    className={`bg-white rounded-[32px] p-5 shadow-[0_10px_30px_rgba(20,20,20,0.04)] border-2 flex flex-col justify-between transition ${borderStyle}`}
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
                        <div className="py-7 rounded-2xl bg-rose-50/50 border border-rose-100 text-center text-xs font-medium text-rose-500">
                          Available to seat guests
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-stone-200/60 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-stone-500 font-medium flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-[#141414]" />
                              <strong className="text-[#141414]">
                                {sess?.guest_count} Guests
                              </strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-[#141414] font-bold text-[10px] uppercase">
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
                                Waiting for 1st order
                              </span>
                              {isGreen && sess && (
                                <button
                                  onClick={() => handleForceAmber(sess.session_id)}
                                  className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold transition"
                                >
                                  Trigger Amber 🔔
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
                          className="w-full py-2.5 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
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
                            className="flex-1 py-2.5 rounded-full bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-bold transition"
                          >
                            Open Table
                          </button>
                          <button
                            onClick={() => handleMarkEmpty(t.table_number)}
                            className="px-3.5 py-2.5 rounded-full bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white text-xs font-bold transition flex items-center gap-1"
                            title="Close Session & Return to Red"
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

            {/* Phase 2 CCTV Roadmap Card */}
            <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] text-[10px] font-extrabold uppercase">
                  <Camera className="w-3 h-3" />
                  Phase 2 Hardware Roadmap
                </span>
                <h3 className="text-base font-extrabold text-[#141414]">
                  Overhead CCTV Occupancy Detection & Automated Table Turn SLA
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Connects existing overhead RTSP cameras in Phase 2 to automatically detect seated guest count (`source="cctv"`) and trigger Amber idle alerts if no order is placed within threshold. Use the{" "}
                  <strong className="text-[#141414]">Portal Switcher → Simulate CCTV</strong> control to test this live today.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: OWNER ANALYTICS (BEST SELLERS & PEAK HOURS — SAMPLE DATA) */}
        {/* ================================================================ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Mandatory Sample Data Disclosure */}
            <div className="bg-white rounded-[24px] p-4 border border-stone-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-stone-600">
                <Sparkles className="w-4 h-4 text-[#FF6B4A]" />
                <span>
                  <strong className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px]">
                    Sample data
                  </strong>{" "}
                  Seeded historical records are labeled as Sample data alongside your live orders.
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
              {/* Best Sellers Chart */}
              <div className="bg-white rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141414]">
                      Best-Selling Dishes
                    </h3>
                    <p className="text-xs text-stone-400">Total units ordered across tables</p>
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

              {/* Peak Hours Chart */}
              <div className="bg-white rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141414]">
                      Peak Dining Hours
                    </h3>
                    <p className="text-xs text-stone-400">Hourly order distribution</p>
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
        {/* TAB 3: RETAINED CUSTOMERS & DPDP REGISTRY                        */}
        {/* ================================================================ */}
        {activeTab === "customers" && (
          <div className="bg-white rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-[#141414]">
                  Retained Customers & DPDP Act Consent Registry
                </h3>
                <p className="text-xs text-stone-400">
                  Guests who verified their WhatsApp number for the 5% discount
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                Sample data + Live Guests
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200/80 text-stone-400">
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
        {/* TAB 4: READ-ONLY OWNER SETTLEMENT REPORT                         */}
        {/* ================================================================ */}
        {activeTab === "settlements" && (
          <div className="space-y-5">
            {settlementError ? (
              <div className="bg-white rounded-[32px] p-10 text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                <Lock className="w-8 h-8 text-[#FF6B4A] mx-auto" />
                <h3 className="text-base font-extrabold text-[#141414]">
                  Restaurant Owner Role Required
                </h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">
                  Switch to the <strong>Restaurant Admin Portal (/owner)</strong> via the bottom-right Portal Switcher pill to view the read-only Owner Settlement Report.
                </p>
              </div>
            ) : (
              <>
                {settlements?.summary_paise && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                      <div className="text-xs text-stone-400 font-medium">
                        Gross Customer Collections
                      </div>
                      <div className="text-2xl font-extrabold text-[#141414] mt-1">
                        {formatPaise(settlements.summary_paise.total_gross_paise)}
                      </div>
                    </div>
                    <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                      <div className="text-xs text-stone-400 font-medium">
                        5% Verified Discounts
                      </div>
                      <div className="text-2xl font-extrabold text-[#FF6B4A] mt-1">
                        -{formatPaise(settlements.summary_paise.total_discount_paise)}
                      </div>
                    </div>
                    <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                      <div className="text-xs text-stone-400 font-medium">
                        GST (on Subtotal - Discount)
                      </div>
                      <div className="text-2xl font-extrabold text-[#141414] mt-1">
                        {formatPaise(settlements.summary_paise.total_tax_paise)}
                      </div>
                    </div>
                    <div className="bg-[#141414] text-white rounded-[28px] p-5 shadow-lg">
                      <div className="text-xs text-stone-400 font-medium">
                        Net Restaurant Settlement
                      </div>
                      <div className="text-2xl font-extrabold text-white mt-1">
                        {formatPaise(settlements.summary_paise.total_restaurant_net_paise)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-stone-200/60 space-y-4">
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
                        <tr className="border-b border-stone-200/80 text-stone-400">
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
      </div>
    </div>
  );
};
