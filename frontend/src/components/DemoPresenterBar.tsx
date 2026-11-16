import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChefHat,
  ChevronUp,
  Crown,
  ExternalLink,
  Layers,
  LayoutGrid,
  Smartphone,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppRole, useAppStore } from "@/store/useAppStore";

export const ROLE_TO_PATH: Record<AppRole, string> = {
  customer: "/customer",
  kitchen: "/kitchen",
  manager: "/manager",
  owner: "/owner",
  super_admin: "/super-admin",
  waiter: "/manager",
};

export const PATH_TO_ROLE: Record<string, AppRole> = {
  "/": "customer",
  "/customer": "customer",
  "/menu": "customer",
  "/kitchen": "kitchen",
  "/kds": "kitchen",
  "/manager": "manager",
  "/floor": "manager",
  "/owner": "owner",
  "/admin": "owner",
  "/super-admin": "super_admin",
  "/superadmin": "super_admin",
};

export const DemoPresenterBar: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    activeRole,
    setActiveRestaurantId,
    setStaffAuth,
    setActiveRole,
    setSelectedTableNumber,
  } = useAppStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cctvTable, setCctvTable] = useState<number>(3);
  const [cctvGuests, setCctvGuests] = useState<number>(4);
  const [cctvBusy, setCctvBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: restaurants = [] } = useQuery<any[]>({
    queryKey: ["restaurants"],
    queryFn: () => apiFetch("/api/restaurants"),
  });

  const navigateToPortal = async (role: AppRole, restId = activeRestaurantId) => {
    const targetPath = ROLE_TO_PATH[role] || "/customer";
    window.history.pushState({}, "", targetPath);

    if (role === "customer") {
      setActiveRole("customer");
      setDrawerOpen(false);
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
    } catch {
      setActiveRole(role);
    }
    setDrawerOpen(false);
  };

  const handleTenantSwitch = async (newRestId: string) => {
    setActiveRestaurantId(newRestId);
    setSelectedTableNumber(1);
    if (activeRole !== "customer") {
      await navigateToPortal(activeRole, newRestId);
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
      setToast(`Table #${cctvTable} marked Seated (${cctvGuests} guests via CCTV)`);
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(`Error: ${err.message}`);
    } finally {
      setCctvBusy(false);
    }
  };

  const portals: {
    id: AppRole;
    title: string;
    subtitle: string;
    path: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "customer",
      title: "Customer App",
      subtitle: "Mobile QR & Table WebApp",
      path: "/customer",
      icon: <Smartphone className="w-4 h-4" />,
    },
    {
      id: "kitchen",
      title: "Kitchen Portal (KDS)",
      subtitle: "Live Tickets & Prep Timer",
      path: "/kitchen",
      icon: <ChefHat className="w-4 h-4" />,
    },
    {
      id: "manager",
      title: "Floor Manager Portal",
      subtitle: "Red / Green / Amber Table Map",
      path: "/manager",
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: "owner",
      title: "Restaurant Admin Portal",
      subtitle: "Analytics, Settlements & Menu",
      path: "/owner",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: "super_admin",
      title: "Super Admin Portal",
      subtitle: "Tenants & Profit-Share Engine",
      path: "/super-admin",
      icon: <Crown className="w-4 h-4" />,
    },
  ];

  const currentPortal = portals.find((p) => p.id === activeRole) || portals[0];

  return (
    <>
      {/* Discrete Floating Corner Pill — Never Clutters the Screen */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {toast && (
          <div className="px-4 py-2.5 rounded-2xl bg-[#141414] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-[#FF6B4A]" />
            <span>{toast}</span>
          </div>
        )}

        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#141414] text-white text-xs font-bold shadow-[0_14px_34px_rgba(20,20,20,0.28)] hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
        >
          <span className="w-6 h-6 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </span>
          <span>Portal: {currentPortal.title}</span>
          <ChevronUp
            className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
              drawerOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Clean Orbix-Style Portal Switcher Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FAF8F6] border border-stone-200/80 rounded-[32px] max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#141414]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B4A]">
                  Multi-Portal Architecture
                </span>
                <h3 className="text-xl font-extrabold text-[#141414]">
                  Switch Active Portal or Restaurant
                </h3>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-[#141414]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tenant Switcher */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200/60 space-y-2">
              <div className="text-xs font-bold text-stone-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#FF6B4A]" />
                ACTIVE RESTAURANT TENANT
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {restaurants.map((r: any) => {
                  const active = r.restaurant_id === activeRestaurantId;
                  return (
                    <button
                      key={r.restaurant_id}
                      onClick={() => handleTenantSwitch(r.restaurant_id)}
                      className={`p-3 rounded-xl text-left transition border ${
                        active
                          ? "bg-[#141414] text-white border-[#141414]"
                          : "bg-[#FAF8F6] text-[#141414] border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{r.name}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          active ? "text-[#FF6B4A]" : "text-stone-500"
                        }`}
                      >
                        {r.billing_model === "profit_share"
                          ? `Profit-Share (${(r.markup_bps / 100).toFixed(0)}% Hidden Markup)`
                          : "One-Time + AMC Plan"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5 Dedicated Portals List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-400">SEPARATE ROLE PORTALS</div>
              <div className="space-y-2">
                {portals.map((p) => {
                  const isActive = activeRole === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                        isActive
                          ? "bg-white border-[#FF6B4A] shadow-sm"
                          : "bg-white/70 border-stone-200/70 hover:bg-white"
                      }`}
                    >
                      <button
                        onClick={() => navigateToPortal(p.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isActive
                              ? "bg-[#FF6B4A] text-white"
                              : "bg-[#F3F1ED] text-[#141414]"
                          }`}
                        >
                          {p.icon}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#141414] flex items-center gap-2">
                            <span>{p.title}</span>
                            <code className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#F3F1ED] text-stone-600">
                              {p.path}
                            </code>
                          </div>
                          <div className="text-xs text-stone-400">{p.subtitle}</div>
                        </div>
                      </button>

                      <a
                        href={p.path}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-[#141414]"
                        title={`Open ${p.title} in new tab`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulate CCTV Quick Control */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#141414]">Simulate CCTV Seating</div>
                  <div className="text-[11px] text-stone-400">
                    Marks table occupied (`source="cctv"`)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <select
                  value={cctvTable}
                  onChange={(e) => setCctvTable(Number(e.target.value))}
                  className="bg-[#FAF8F6] border border-stone-200 rounded-xl px-2.5 py-1.5 font-semibold"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Table #{n}
                    </option>
                  ))}
                </select>
                <div className="flex items-center bg-[#FAF8F6] border border-stone-200 rounded-xl px-2 py-1.5">
                  <Users className="w-3.5 h-3.5 text-stone-400 mr-1" />
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cctvGuests}
                    onChange={(e) => setCctvGuests(Math.max(1, Number(e.target.value)))}
                    className="w-8 bg-transparent font-semibold text-center focus:outline-none"
                  />
                </div>
                <button
                  disabled={cctvBusy}
                  onClick={handleSimulateCctv}
                  className="px-3.5 py-1.5 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold transition"
                >
                  {cctvBusy ? "..." : "Trigger"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
