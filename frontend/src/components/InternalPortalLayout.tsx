import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Atom,
  Bell,
  Camera,
  ChefHat,
  Crown,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
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

export interface HeroKpiMetric {
  label: string;
  value: string | number;
  sublabel?: string;
  progressPct?: number;
}

interface InternalPortalLayoutProps {
  portalTitle: string;
  portalSubtitle: string;
  portalRoleBadge: string;
  menuItems: SidebarMenuItem[];
  activeMenuId: string;
  onSelectMenu: (id: string) => void;
  heroMetrics?: [HeroKpiMetric, HeroKpiMetric];
  heroRightStat?: {
    leftValue: string;
    leftLabel: string;
    rightValue: string;
    rightLabel: string;
  };
  headerActions?: React.ReactNode;
  showCctvControl?: boolean;
  children: React.ReactNode;
}

export const InternalPortalLayout: React.FC<InternalPortalLayoutProps> = ({
  portalTitle,
  portalSubtitle,
  portalRoleBadge,
  menuItems,
  activeMenuId,
  onSelectMenu,
  heroMetrics,
  heroRightStat,
  headerActions,
  showCctvControl = false,
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
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [cctvModalOpen, setCctvModalOpen] = useState(false);
  const [cctvTable, setCctvTable] = useState(3);
  const [cctvGuests, setCctvGuests] = useState(4);
  const [cctvBusy, setCctvBusy] = useState(false);

  // Only owner, manager, and super_admin can see CCTV simulation — NEVER kitchen!
  const canUseCctv =
    showCctvControl &&
    (activeRole === "owner" ||
      activeRole === "manager" ||
      activeRole === "super_admin");

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
    setRoleDrawerOpen(false);

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

  const defaultHeroMetrics: [HeroKpiMetric, HeroKpiMetric] = heroMetrics || [
    {
      label: "Active Operations",
      value: menuItems[0]?.badge ?? "Live",
      sublabel: "Real-Time Sync",
      progressPct: 76,
    },
    {
      label: "Service Velocity",
      value: "98.4%",
      sublabel: "SLA Compliance",
      progressPct: 88,
    },
  ];

  const defaultRightStat = heroRightStat || {
    leftValue: currentRestaurant?.name?.split(" ")[0] || "Active",
    leftLabel: "ACTIVE TENANT",
    rightValue: "99.8%",
    rightLabel: "SYSTEM HEALTH",
  };

  return (
    <div className="min-h-screen bg-[#E5E8E5] text-[#1E201F] p-2 sm:p-4 font-sans">
      {/* Main Framed Dashboard Container (Exact match to Intelligent Eco System Reference) */}
      <div className="max-w-[1520px] mx-auto bg-[#F4F6F4] rounded-[34px] p-3 sm:p-4 shadow-[0_24px_70px_rgba(0,0,0,0.08)] border border-white flex gap-4 min-h-[calc(100vh-2rem)]">
        {/* 1. SLIM FLOATING DARK CHARCOAL VERTICAL PILL RAIL + SIDE MENU */}
        <aside className="hidden lg:flex flex-col items-center justify-between w-[72px] bg-[#222423] rounded-[28px] py-5 shrink-0 text-white shadow-xl select-none">
          {/* Top Glowing Lime-Green Emblem */}
          <div className="flex flex-col items-center gap-6">
            <div
              className="w-11 h-11 rounded-2xl bg-white/8 flex items-center justify-center text-[#9FE870] shadow-inner"
              title="RetAI Intelligent Hospitality OS"
            >
              <Atom className="w-6 h-6" />
            </div>

            {/* Vertical Icon Stack */}
            <nav className="flex flex-col items-center gap-2.5">
              {menuItems.map((item) => {
                const isActive = item.id === activeMenuId;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectMenu(item.id)}
                    className={`group relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-white/16 text-[#9FE870] shadow-sm ring-1 ring-white/15"
                        : "text-stone-400 hover:text-white hover:bg-white/8"
                    }`}
                  >
                    {item.icon}
                    {item.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full bg-[#9FE870] text-[#1E201F] text-[9px] font-extrabold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    {/* Hover Tooltip */}
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 z-50 px-3 py-1.5 rounded-xl bg-[#222423] text-white text-xs font-semibold whitespace-nowrap shadow-xl border border-white/10">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Controls: CCTV (only for authorized roles), Portal Switcher & Staff Avatar */}
          <div className="flex flex-col items-center gap-3">
            {canUseCctv && (
              <button
                onClick={() => setCctvModalOpen(true)}
                className="w-10 h-10 rounded-2xl text-stone-400 hover:text-[#9FE870] hover:bg-white/8 flex items-center justify-center transition"
                title="Simulate CCTV Occupancy"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setRoleDrawerOpen((v) => !v)}
              className="w-10 h-10 rounded-2xl text-stone-400 hover:text-white hover:bg-white/8 flex items-center justify-center transition"
              title="Switch Role Portal / Tenant"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => handlePortalSwitch("customer")}
              className="w-10 h-10 rounded-2xl text-stone-400 hover:text-white hover:bg-white/8 flex items-center justify-center transition"
              title="Open Customer App"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Staff Avatar Square */}
            <div
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9FE870] to-emerald-600 text-[#1E201F] font-extrabold text-sm flex items-center justify-center shadow-md mt-1"
              title={staffName}
            >
              {(staffName || "A")[0]}
            </div>
          </div>
        </aside>

        {/* 2. MAIN WORKSPACE AREA */}
        <div className="flex-1 flex flex-col min-w-0 space-y-4">
          {/* SAGE-SILVER GLASSMORPHIC HERO BANNER (Matches Reference Screenshot) */}
          <div className="rounded-[28px] bg-gradient-to-br from-[#D7E0D7] via-[#E4ECE4] to-[#D5DFD5] p-5 sm:p-7 border border-white/90 shadow-xs relative overflow-hidden">
            {/* Decorative Subtle Eco/Architectural Circles */}
            <div className="pointer-events-none absolute -right-12 -top-12 w-72 h-72 rounded-full bg-white/25 blur-2xl" />
            <div className="pointer-events-none absolute right-1/3 bottom-0 w-48 h-48 rounded-full bg-[#9FE870]/15 blur-xl" />

            {/* Hero Top Bar */}
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#525A55] mb-1.5">
                  <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className="lg:hidden p-1.5 rounded-lg bg-white/70 text-[#222423]"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#222423] text-[#9FE870] text-[10px] font-bold uppercase tracking-wider">
                    {portalRoleBadge}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-normal tracking-wide text-[#1E201F] uppercase">
                  {portalTitle}
                </h1>
                <p className="text-xs text-[#545D57] mt-1 max-w-xl">
                  {portalSubtitle}
                </p>
              </div>

              {/* Top-Right Search / Tenant Selector Pill + Notification Bell */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-2xs border border-white">
                  <Store className="w-3.5 h-3.5 text-stone-400" />
                  <select
                    value={activeRestaurantId}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-[#1E201F] focus:outline-none cursor-pointer"
                  >
                    {restaurants.map((r: any) => (
                      <option key={r.restaurant_id} value={r.restaurant_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {headerActions}

                <button
                  onClick={() => setRoleDrawerOpen(true)}
                  className="w-10 h-10 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#1E201F] hover:bg-[#222423] hover:text-[#9FE870] transition"
                  title="Portal & Role Settings"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hero Bottom Row: 2 Glassmorphic Mini Cards + Right Load/Health Pill */}
            <div className="relative z-10 mt-6 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3.5">
                {defaultHeroMetrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="w-44 sm:w-48 rounded-[22px] bg-white/65 backdrop-blur-md p-4 border border-white/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-medium text-[#4A524D] leading-tight">
                        {m.label}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#1E201F] shadow-2xs">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-[#1E201F]">
                      {m.value}
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#222423] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-[#9FE870]"
                        style={{ width: `${m.progressPct ?? 75}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Frosted Status Pill */}
              <div className="rounded-[22px] bg-white/60 backdrop-blur-md px-5 py-3.5 border border-white/80 flex items-center gap-6 shadow-2xs">
                <div>
                  <div className="text-lg font-bold text-[#1E201F]">
                    {defaultRightStat.leftValue}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#545D57]">
                    {defaultRightStat.leftLabel}
                  </div>
                </div>
                <div className="h-8 w-px bg-stone-300/80" />
                <div>
                  <div className="text-lg font-bold text-[#1E201F]">
                    {defaultRightStat.rightValue}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#545D57]">
                    {defaultRightStat.rightLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clean Section Sub-Menu Bar (Labeled navigation for fast switching) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-white rounded-[22px] p-1.5 border border-stone-200/60 shadow-2xs">
            <div className="flex items-center gap-1">
              {menuItems.map((item) => {
                const isActive = item.id === activeMenuId;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectMenu(item.id)}
                    className={`px-4 py-2 rounded-[16px] text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-[#222423] text-[#9FE870] shadow-xs"
                        : "text-stone-500 hover:text-[#1E201F] hover:bg-[#F4F6F4]"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? "bg-[#9FE870] text-[#1E201F]"
                            : "bg-[#F4F6F4] text-stone-600"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {canUseCctv && (
              <button
                onClick={() => setCctvModalOpen(true)}
                className="px-3.5 py-2 rounded-[16px] bg-[#F4F6F4] hover:bg-[#222423] text-[#1E201F] hover:text-[#9FE870] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Simulate CCTV</span>
              </button>
            )}
          </div>

          {/* Main Portal Body */}
          <div className="flex-1">{children}</div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 bg-[#222423] text-white h-full p-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-[#9FE870] flex items-center justify-center">
                    <Atom className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-sm">RetAI OS</span>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              </div>
              <nav className="space-y-1.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectMenu(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                      item.id === activeMenuId
                        ? "bg-[#9FE870] text-[#1E201F]"
                        : "text-stone-300 hover:bg-white/8"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span className="px-2 py-0.5 rounded-full bg-black/20 text-[10px]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Role Portal Directory Modal */}
      {roleDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Role Navigation
                </span>
                <h3 className="text-base font-bold text-[#1E201F]">
                  Switch Active Portal
                </h3>
              </div>
              <button
                onClick={() => setRoleDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F4F6F4] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  id: "super_admin",
                  label: "Super Admin Portal (/super-admin)",
                  sub: "Onboarding & Confidential Platform Markup",
                  icon: <Crown className="w-4 h-4" />,
                },
                {
                  id: "owner",
                  label: "Restaurant Admin Portal (/owner)",
                  sub: "2D Floor Map, Washroom Pins, Discounts & RBAC",
                  icon: <TrendingUp className="w-4 h-4" />,
                },
                {
                  id: "manager",
                  label: "Floor Manager Portal (/manager)",
                  sub: "Live Table Occupancy & Service Requests",
                  icon: <LayoutGrid className="w-4 h-4" />,
                },
                {
                  id: "kitchen",
                  label: "Kitchen KDS Portal (/kitchen)",
                  sub: "Cooking Queue, Repeat Chapati Priority & Prep ETA",
                  icon: <ChefHat className="w-4 h-4" />,
                },
                {
                  id: "customer",
                  label: "Customer App (/customer)",
                  sub: "QR / Table Ordering, 1-Tap Repeat & Google Review Bill",
                  icon: <Smartphone className="w-4 h-4" />,
                },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePortalSwitch(p.id as AppRole)}
                  className={`w-full p-3.5 rounded-2xl border flex items-center gap-3 text-left transition ${
                    activeRole === p.id
                      ? "bg-[#222423] text-white border-[#222423]"
                      : "bg-[#F4F6F4] text-[#1E201F] border-stone-200/70 hover:bg-stone-200/60"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      activeRole === p.id
                        ? "bg-[#9FE870] text-[#1E201F]"
                        : "bg-white text-[#1E201F]"
                    }`}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <div className="font-bold">{p.label}</div>
                    <div
                      className={`text-[11px] ${
                        activeRole === p.id ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      {p.sub}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Simulate CCTV Modal (Only rendered for Owner, Manager & Super Admin) */}
      {canUseCctv && cctvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#222423] text-[#9FE870] flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E201F]">
                    Simulate CCTV Occupancy
                  </h3>
                  <p className="text-[11px] text-stone-400">source="cctv"</p>
                </div>
              </div>
              <button
                onClick={() => setCctvModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F4F6F4] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-stone-400 font-semibold mb-1">Table</label>
                <select
                  value={cctvTable}
                  onChange={(e) => setCctvTable(Number(e.target.value))}
                  className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2.5 font-semibold text-[#1E201F]"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Table #{n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-stone-400 font-semibold mb-1">Guests</label>
                <div className="flex items-center bg-[#F4F6F4] rounded-xl px-3 py-2.5">
                  <Users className="w-3.5 h-3.5 text-stone-400 mr-1.5" />
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cctvGuests}
                    onChange={(e) => setCctvGuests(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-transparent font-semibold text-[#1E201F] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              disabled={cctvBusy}
              onClick={handleSimulateCctv}
              className="w-full py-3 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] text-xs font-bold transition"
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
