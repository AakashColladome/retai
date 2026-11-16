import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChefHat,
  Crown,
  LayoutGrid,
  Smartphone,
  Sparkles,
  Store,
  Tablet,
  TrendingUp,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppRole, useAppStore } from "@/store/useAppStore";

export const DemoPresenterBar: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    activeRole,
    customerMode,
    selectedTableNumber,
    setActiveRestaurantId,
    setStaffAuth,
    setActiveRole,
    setCustomerMode,
    setSelectedTableNumber,
  } = useAppStore();

  const [cctvOpen, setCctvOpen] = useState(false);
  const [cctvTable, setCctvTable] = useState<number>(3);
  const [cctvGuests, setCctvGuests] = useState<number>(4);
  const [cctvBusy, setCctvBusy] = useState(false);
  const [cctvToast, setCctvToast] = useState<string | null>(null);

  const { data: restaurants = [] } = useQuery<any[]>({
    queryKey: ["restaurants"],
    queryFn: () => apiFetch("/api/restaurants"),
  });

  const handleRoleSwitch = async (role: AppRole, restId = activeRestaurantId) => {
    if (role === "customer") {
      setActiveRole("customer");
      return;
    }
    try {
      const res = await apiFetch("/api/auth/demo-switch", {
        method: "POST",
        body: JSON.stringify({
          role,
          restaurant_id: restId,
        }),
      });
      setStaffAuth(res.access_token, res.name, role);
      queryClient.invalidateQueries();
    } catch (err) {
      console.error("Failed to switch role:", err);
      setActiveRole(role);
    }
  };

  const handleTenantSwitch = async (newRestId: string) => {
    setActiveRestaurantId(newRestId);
    setSelectedTableNumber(1);
    if (activeRole !== "customer") {
      await handleRoleSwitch(activeRole, newRestId);
    }
    queryClient.invalidateQueries();
  };

  const handleSimulateCctv = async () => {
    setCctvBusy(true);
    try {
      await apiFetch("/api/sessions/start", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          table_number: cctvTable,
          guest_count: cctvGuests,
          source: "cctv",
        }),
      });
      setCctvToast(
        `CCTV Simulated: Table #${cctvTable} marked Seated (Green) with ${cctvGuests} guests. Will turn Amber after threshold if no order is placed.`
      );
      setCctvOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
      setTimeout(() => setCctvToast(null), 5000);
    } catch (err: any) {
      setCctvToast(`Error: ${err.message}`);
    } finally {
      setCctvBusy(false);
    }
  };

  const roles: { id: AppRole; label: string; icon: React.ReactNode }[] = [
    { id: "customer", label: "Customer (Tablet / QR)", icon: <Tablet className="w-3.5 h-3.5" /> },
    { id: "kitchen", label: "Kitchen KDS", icon: <ChefHat className="w-3.5 h-3.5" /> },
    { id: "manager", label: "Manager Floor & Alerts", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: "owner", label: "Owner Analytics & Settlements", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "super_admin", label: "Super Admin", icon: <Crown className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-3 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Brand & Tenant Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            RetAI Presenter Bar
          </span>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <Store className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {restaurants.map((r: any) => {
              const active = r.restaurant_id === activeRestaurantId;
              return (
                <button
                  key={r.restaurant_id}
                  onClick={() => handleTenantSwitch(r.restaurant_id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span>{r.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded ${
                      r.billing_model === "profit_share"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {r.billing_model === "profit_share"
                      ? `Profit-Share (${(r.markup_bps / 100).toFixed(0)}%)`
                      : "One-Time + AMC"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Role View Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 flex-wrap">
          {roles.map((r) => {
            const isActive = activeRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => handleRoleSwitch(r.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {r.icon}
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Customer Hardware/QR Toggle + Simulate CCTV */}
        <div className="flex items-center gap-2">
          {activeRole === "customer" && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setCustomerMode("tablet")}
                className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                  customerMode === "tablet"
                    ? "bg-slate-800 text-orange-400 font-semibold"
                    : "text-slate-400"
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                Tablet Mode
              </button>
              <button
                onClick={() => setCustomerMode("qr")}
                className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                  customerMode === "qr"
                    ? "bg-slate-800 text-emerald-400 font-semibold"
                    : "text-slate-400"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                QR Mode
              </button>
            </div>
          )}

          {/* Simulate CCTV Button */}
          <div className="relative">
            <button
              onClick={() => setCctvOpen((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1.5 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              Simulate CCTV
            </button>

            {cctvOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3.5 z-50 text-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-rose-400" />
                    Simulate CCTV Occupancy
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    source="cctv"
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Marks a table occupied (Green) with N guests. If no order is placed within the threshold (1 min demo), it triggers an Amber alert + Manager chime.
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Table Number</label>
                    <select
                      value={cctvTable}
                      onChange={(e) => setCctvTable(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          Table #{n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Guests Detected</label>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={cctvGuests}
                        onChange={(e) => setCctvGuests(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={cctvBusy}
                  onClick={handleSimulateCctv}
                  className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
                >
                  {cctvBusy ? "Triggering CCTV Event..." : `Mark Table #${cctvTable} Seated (${cctvGuests} Guests)`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {cctvToast && (
        <div className="max-w-7xl mx-auto mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 flex items-center justify-between">
          <span>{cctvToast}</span>
          <button onClick={() => setCctvToast(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}
    </header>
  );
};
