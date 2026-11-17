import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChefHat,
  Crown,
  ExternalLink,
  LayoutGrid,
  Menu,
  Smartphone,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppRole, useAppStore } from "@/store/useAppStore";
import { ROLE_TO_PATH } from "@/components/DemoPresenterBar";

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface InternalPortalLayoutProps {
  portalTitle: string;
  portalSubtitle: string;
  portalRoleBadge: string;
  menuItems: SidebarMenuItem[];
  activeMenuId: string;
  onSelectMenu: (id: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const InternalPortalLayout: React.FC<InternalPortalLayoutProps> = ({
  portalTitle,
  portalSubtitle,
  portalRoleBadge,
  menuItems,
  activeMenuId,
  onSelectMenu,
  headerActions,
  children,
}) => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    activeRole,
    staffName,
    setActiveRestaurantId,
    setStaffAuth,
    setActiveRole,
    setSelectedTableNumber,
  } = useAppStore();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cctvModalOpen, setCctvModalOpen] = useState(false);
  const [cctvTable, setCctvTable] = useState(3);
  const [cctvGuests, setCctvGuests] = useState(4);
  const [cctvBusy, setCctvBusy] = useState(false);

  const { data: restaurants = [] } = useQuery<any[]>({
    queryKey: ["restaurants"],
    queryFn: () => apiFetch("/api/restaurants"),
  });

  const currentRestaurant =
    restaurants.find((r) => r.restaurant_id === activeRestaurantId) || restaurants[0];

  const handlePortalSwitch = async (role: AppRole, restId = activeRestaurantId) => {
    const targetPath = ROLE_TO_PATH[role] || "/customer";
    window.history.pushState({}, "", targetPath);
    setMobileSidebarOpen(false);

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
    } catch {
      setActiveRole(role);
    }
  };

  const handleTenantChange = async (newRestId: string) => {
    setActiveRestaurantId(newRestId);
    setSelectedTableNumber(1);
    if (activeRole !== "customer") {
      await handlePortalSwitch(activeRole, newRestId);
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
      setCctvModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCctvBusy(false);
    }
  };

  const allPortals: { id: AppRole; label: string; path: string; icon: React.ReactNode }[] = [
    {
      id: "super_admin",
      label: "Super Admin HQ",
      path: "/super-admin",
      icon: <Crown className="w-4 h-4" />,
    },
    {
      id: "owner",
      label: "Restaurant Admin",
      path: "/owner",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: "manager",
      label: "Floor Manager",
      path: "/manager",
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: "kitchen",
      label: "Kitchen KDS",
      path: "/kitchen",
      icon: <ChefHat className="w-4 h-4" />,
    },
    {
      id: "customer",
      label: "Customer App",
      path: "/customer",
      icon: <Smartphone className="w-4 h-4" />,
    },
  ];

  const activeMenuObj = menuItems.find((m) => m.id === activeMenuId) || menuItems[0];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#141414] text-white w-64 select-none">
      {/* 1. Brand Logo & Role Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FF6B4A] text-white flex items-center justify-center font-black text-base shadow-lg shadow-[#FF6B4A]/30">
            R
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">
                RetAI OS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#FF6B4A] text-[9px] font-extrabold uppercase">
                {portalRoleBadge}
              </span>
            </div>
            <div className="text-[11px] text-stone-400 truncate max-w-[145px]">
              {portalTitle}
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Active Restaurant Tenant Selector */}
      <div className="px-4 py-3.5 border-b border-white/10">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1.5">
          <Store className="w-3 h-3 text-[#FF6B4A]" />
          Active Restaurant Tenant
        </label>
        <select
          value={activeRestaurantId}
          onChange={(e) => handleTenantChange(e.target.value)}
          className="w-full bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
        >
          {restaurants.map((r: any) => (
            <option
              key={r.restaurant_id}
              value={r.restaurant_id}
              className="bg-[#141414] text-white"
            >
              {r.name} (
              {r.billing_model === "profit_share"
                ? `${(r.markup_bps / 100).toFixed(0)}% Share`
                : "AMC"}
              )
            </option>
          ))}
        </select>
      </div>

      {/* 3. Portal Side Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
            Portal Navigation
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = item.id === activeMenuId;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectMenu(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#FF6B4A] text-white shadow-md shadow-[#FF6B4A]/25"
                      : "text-stone-400 hover:text-white hover:bg-white/6"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive
                          ? "bg-white text-[#141414]"
                          : item.badgeColor || "bg-white/10 text-stone-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 4. Quick Hardware / CCTV Simulator Action */}
        <div className="px-2">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#FF6B4A]" />
                CCTV Occupancy Sim
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-stone-300 font-mono">
                sensor
              </span>
            </div>
            <p className="text-[10px] text-stone-400 leading-relaxed">
              Test camera-detected table seating & idle Amber alerts.
            </p>
            <button
              onClick={() => setCctvModalOpen(true)}
              className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-[#FF6B4A] text-white text-[11px] font-bold transition"
            >
              Simulate CCTV Seating
            </button>
          </div>
        </div>

        {/* 5. Switch Role Portal Directory */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
            Switch Role Portal
          </div>
          <div className="space-y-1">
            {allPortals.map((p) => {
              const isCurrentPortal = activeRole === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                    isCurrentPortal
                      ? "bg-white/10 text-white font-bold"
                      : "text-stone-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => handlePortalSwitch(p.id)}
                    className="flex items-center gap-2.5 flex-1 text-left"
                  >
                    <span className={isCurrentPortal ? "text-[#FF6B4A]" : "text-stone-400"}>
                      {p.icon}
                    </span>
                    <span>{p.label}</span>
                  </button>
                  <a
                    href={p.path}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-stone-500 hover:text-white"
                    title={`Open ${p.label} in new tab`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Staff User Footer */}
      <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#FF6B4A]/20 border border-[#FF6B4A]/40 text-[#FF6B4A] flex items-center justify-center font-extrabold text-xs shrink-0">
            {(staffName || "S")[0]}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{staffName}</div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live WebSocket Sync
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#141414] flex">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="fixed inset-y-0 left-0 w-64 z-30">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Right Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#F7F5F2] text-[#141414]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-[#141414]">
                  {activeMenuObj?.label || portalTitle}
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-stone-200/80 text-[11px] font-bold text-stone-600">
                  {currentRestaurant?.name}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">
                {portalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">{headerActions}</div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Simulate CCTV Modal */}
      {cctvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#141414]">
                    Simulate CCTV Occupancy
                  </h3>
                  <p className="text-[11px] text-stone-400">source="cctv"</p>
                </div>
              </div>
              <button
                onClick={() => setCctvModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F7F5F2] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-stone-400 font-bold mb-1">Table</label>
                <select
                  value={cctvTable}
                  onChange={(e) => setCctvTable(Number(e.target.value))}
                  className="w-full bg-[#F7F5F2] rounded-xl px-3 py-2.5 font-bold text-[#141414]"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Table #{n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-stone-400 font-bold mb-1">Guests</label>
                <div className="flex items-center bg-[#F7F5F2] rounded-xl px-3 py-2.5">
                  <Users className="w-3.5 h-3.5 text-stone-400 mr-1.5" />
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cctvGuests}
                    onChange={(e) => setCctvGuests(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-transparent font-bold text-[#141414] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              disabled={cctvBusy}
              onClick={handleSimulateCctv}
              className="w-full py-3 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold transition"
            >
              {cctvBusy
                ? "Triggering..."
                : `Mark Table #${cctvTable} Seated (${cctvGuests} Guests)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
