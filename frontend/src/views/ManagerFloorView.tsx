import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  LayoutGrid,
  Lock,
  Sparkles,
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

  const [activeTab, setActiveTab] = useState<"floor" | "analytics" | "settlements">(
    activeRole === "owner" ? "analytics" : "floor"
  );

  // Fetch Tables with Occupancy Status (empty=Red, seated=Green, amber=Amber)
  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 3000,
  });

  // Fetch Service Requests
  const { data: serviceRequests = [] } = useQuery<any[]>({
    queryKey: ["service-requests", activeRestaurantId],
    queryFn: () => apiFetch(`/api/service-requests/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  // Fetch Owner Analytics
  const { data: analytics } = useQuery<any>({
    queryKey: ["analytics", activeRestaurantId],
    queryFn: () => apiFetch(`/api/analytics/${activeRestaurantId}`),
    enabled: activeTab === "analytics",
  });

  // Fetch Read-Only Settlement Report (Owner / Super Admin)
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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Live WebSocket Amber Alert Banner */}
      {lastAmberAlert && (
        <div className="p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-100 flex flex-wrap items-center justify-between gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>AMBER TABLE ALERT — TABLE #{lastAmberAlert.table_number}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold uppercase">
                  Source: {lastAmberAlert.source}
                </span>
              </div>
              <p className="text-xs text-amber-200">{lastAmberAlert.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedTableNumber(lastAmberAlert.table_number);
                setActiveRole("customer");
                setLastAmberAlert(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs"
            >
              Open Table #{lastAmberAlert.table_number} Menu to Place First Order →
            </button>
            <button
              onClick={() => setLastAmberAlert(null)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 text-slate-300 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar: Live Table Map | Owner Analytics | Read-Only Settlement Report */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("floor")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === "floor"
                ? "bg-orange-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Live Table Occupancy Map
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === "analytics"
                ? "bg-orange-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Owner Analytics (Best Sellers, Peak Hours, Retention)
          </button>

          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === "settlements"
                ? "bg-orange-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Owner Settlement Report (Read-Only)
          </button>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Empty (Red): {emptyCount}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Seated (Green): {seatedCount}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            Idle No-Order (Amber): {amberCount}
          </span>
        </div>
      </div>

      {/* TAB 1: LIVE TABLE OCCUPANCY MAP (RED / GREEN / AMBER) */}
      {activeTab === "floor" && (
        <div className="space-y-6">
          {/* Active Service Requests Queue */}
          {serviceRequests.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                Active 1-Tap Table Requests ({serviceRequests.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serviceRequests.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-bold">
                        Table #{sr.table_number}
                      </span>
                      <div className="text-xs font-semibold text-white mt-1">{sr.label}</div>
                    </div>
                    <button
                      onClick={() => handleCompleteServiceReq(sr.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Done ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Radar Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tables.map((t: any) => {
              const isRed = t.status === "empty";
              const isGreen = t.status === "seated";
              const isAmber = t.status === "amber";
              const sess = t.session;
              const hasOrders = t.active_orders && t.active_orders.length > 0;

              const cardStyle = isRed
                ? "bg-rose-950/25 border-rose-500/50 hover:border-rose-400"
                : isAmber
                ? "bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40"
                : "bg-emerald-950/30 border-emerald-500/60 hover:border-emerald-400";

              const badgeStyle = isRed
                ? "bg-rose-500 text-white"
                : isAmber
                ? "bg-amber-400 text-slate-950 animate-pulse"
                : "bg-emerald-500 text-slate-950";

              return (
                <div
                  key={t.table_id}
                  className={`rounded-2xl border-2 p-4 flex flex-col justify-between transition ${cardStyle}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-lg font-black text-white">
                          Table #{t.table_number}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {t.zone} • Cap: {t.capacity}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${badgeStyle}`}
                      >
                        {isRed ? "EMPTY (RED)" : isAmber ? "AMBER IDLE" : "SEATED (GREEN)"}
                      </span>
                    </div>

                    {isRed ? (
                      <div className="py-6 text-center text-xs text-rose-300/80">
                        No active session • Ready to seat guests
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-300" />
                            Guests: <strong className="text-white">{sess?.guest_count}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-orange-300 font-bold text-[10px] uppercase">
                            via {sess?.source}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Seated Duration:</span>
                          <span className="font-mono text-slate-200">
                            {sess?.seconds_seated || 0}s
                            {!sess?.first_order_at &&
                              ` / ${sess?.amber_threshold_seconds || 60}s threshold`}
                          </span>
                        </div>

                        {sess?.is_phone_verified ? (
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            ✓ Verified: {sess.customer_phone} (5% Off + DPDP)
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">Guest Mode (Unverified)</div>
                        )}

                        {hasOrders ? (
                          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-emerald-300 font-bold uppercase text-[11px]">
                              Order: {t.active_orders[0].status}
                            </span>
                            <span className="font-extrabold text-white">
                              {formatPaise(t.active_orders[0].total_paise)}
                            </span>
                          </div>
                        ) : (
                          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-amber-300 font-semibold text-[11px]">
                              No order placed yet
                            </span>
                            {isGreen && sess && (
                              <button
                                onClick={() => handleForceAmber(sess.session_id)}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold"
                                title="Trigger Amber Alert + Chime immediately for demo"
                              >
                                Test Amber Chime 🔔
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Table Action Buttons */}
                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center gap-2">
                    {isRed ? (
                      <button
                        onClick={() => handleMarkSeated(t.table_number, t.capacity)}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Mark Seated ({t.capacity} Guests)
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTableNumber(t.table_number);
                            setActiveRole("customer");
                          }}
                          className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold border border-slate-700"
                        >
                          Open Table View
                        </button>
                        <button
                          onClick={() => handleMarkEmpty(t.table_number)}
                          className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition flex items-center gap-1"
                          title="Close Session & Return Table to Red (Empty)"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Mark Empty
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phase 2 Roadmap: AI Vision CCTV Occupancy Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold uppercase">
                <Camera className="w-3 h-3" />
                Phase 2 Hardware Roadmap
              </div>
              <h3 className="text-base font-bold text-white">
                Automated Overhead CCTV Occupancy & Turn-Time Vision
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                In Phase 2, existing restaurant RTSP security cameras connect to our edge vision worker to automatically detect guest seating count (`source="cctv"`) and table clearing without manual intervention. Use the{" "}
                <strong className="text-rose-300">"Simulate CCTV"</strong> button in the Presenter Bar above to preview this workflow live today.
              </p>
            </div>
            <button
              onClick={() => playAlertChime("amber")}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4" />
              Preview Manager Chime
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: OWNER ANALYTICS (BEST SELLERS, PEAK HOURS, RETAINED CUSTOMERS) */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Mandatory Sample Data Disclosure Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>
                Badge: <strong className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold">Sample data</strong> — Historical charts & initial retention records include seeded sample data alongside your live demo orders.
              </span>
            </div>
            {analytics?.summary && (
              <div className="text-slate-300">
                Live Orders: <strong>{analytics.summary.live_orders_count}</strong> • Sample Orders:{" "}
                <strong>{analytics.summary.sample_orders_count}</strong>
              </div>
            )}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Best Sellers */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Best-Selling Dishes (Units Ordered)</h3>
                  <p className="text-xs text-slate-400">Ranked by total dish volume across tables</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={150}
                      stroke="#cbd5e1"
                      fontSize={11}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="orders" fill="#ea580c" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Peak Hours */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Peak Dining Hours (Orders by Hour)</h3>
                  <p className="text-xs text-slate-400">Hourly kitchen load & table velocity</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  Sample data
                </span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.peak_hours || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="orders" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Retained & DPDP-Consented Customers CRM Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">
                  Retained Customers & DPDP Consent Registry
                </h3>
                <p className="text-xs text-slate-400">
                  Verified guests who opted in via the 5% mobile discount & DPDP consent checkbox
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                Sample data + Live Verified Guests
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">WhatsApp Phone</th>
                    <th className="py-2.5 px-3">DPDP Consent</th>
                    <th className="py-2.5 px-3">Visits</th>
                    <th className="py-2.5 px-3">Total Spend</th>
                    <th className="py-2.5 px-3">Favorite Dishes</th>
                    <th className="py-2.5 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {(analytics?.retained_customers || []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-950/60">
                      <td className="py-2.5 px-3 font-bold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{c.phone}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          ✓ Consented
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-orange-400">{c.visit_count}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {formatPaise(c.total_spent_paise)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {c.favorite_items?.slice(0, 2).join(", ") || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {c.is_sample_data ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                            Sample data
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                            Live Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: READ-ONLY OWNER SETTLEMENT REPORT */}
      {activeTab === "settlements" && (
        <div className="space-y-5">
          {settlementError ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <Lock className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-white">
                Owner Role Required for Settlement Report
              </h3>
              <p className="text-xs text-slate-400">
                The Settlement Report is restricted to the <strong>owner</strong> (and{" "}
                <strong>super_admin</strong>) role. Click <strong>"Owner Analytics & Settlements"</strong> in the Presenter Bar above to view with Owner JWT credentials.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white">
                      {settlements?.restaurant_name} — Read-Only Settlement Report
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> Read-Only Ledger
                    </span>
                    {settlements?.has_sample_data && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        Sample data included
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All figures computed server-side in integer paise • GST computed strictly on (Subtotal - Discount)
                  </p>
                </div>
              </div>

              {/* Summary Cards */}
              {settlements?.summary_paise && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Total Gross Customer Collections</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {formatPaise(settlements.summary_paise.total_gross_paise)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">5% Verified Mobile Discounts</div>
                    <div className="text-2xl font-black text-amber-400 mt-1">
                      -{formatPaise(settlements.summary_paise.total_discount_paise)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">GST Collected (on Subtotal - Discount)</div>
                    <div className="text-2xl font-black text-indigo-400 mt-1">
                      {formatPaise(settlements.summary_paise.total_tax_paise)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
                    <div className="text-xs text-emerald-300 font-semibold">
                      Net Restaurant Payout Settled
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      {formatPaise(settlements.summary_paise.total_restaurant_net_paise)}
                    </div>
                  </div>
                </div>
              )}

              {/* Read-Only Ledger Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Base Food Value</th>
                      <th className="py-2.5 px-3">5% Discount</th>
                      <th className="py-2.5 px-3">GST (on Sub-Disc)</th>
                      <th className="py-2.5 px-3">Gross Paid</th>
                      <th className="py-2.5 px-3">Restaurant Net Payout</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {(settlements?.entries || []).map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-950/60">
                        <td className="py-2.5 px-3 font-bold text-white">Table #{e.table_number}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {formatPaise(e.subtotal_base_paise)}
                        </td>
                        <td className="py-2.5 px-3 text-amber-400">
                          -{formatPaise(e.customer_discount_paise)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{formatPaise(e.tax_paise)}</td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {formatPaise(e.gross_bill_paise)}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-emerald-400">
                          {formatPaise(e.restaurant_net_paise)}
                        </td>
                        <td className="py-2.5 px-3 uppercase font-mono text-slate-300">
                          {e.payment_method}
                        </td>
                        <td className="py-2.5 px-3 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            Settled
                          </span>
                          {e.is_sample_data && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                              Sample data
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
