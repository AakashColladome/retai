import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  Check,
  Compass,
  FileSpreadsheet,
  LayoutGrid,
  Lock,
  MapPin,
  Percent,
  Plus,
  Save,
  ShieldCheck,
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

  // Add Menu Item State
  const [newDishName, setNewDishName] = useState("");
  const [newDishCategory, setNewDishCategory] = useState("Tandoori Breads");
  const [newDishPriceRupees, setNewDishPriceRupees] = useState("35");
  const [newDishPrep, setNewDishPrep] = useState("4");
  const [newDishDesc, setNewDishDesc] = useState(
    "Soft whole-wheat tawa chapati brushed with pure desi ghee."
  );
  const [dishBusy, setDishBusy] = useState(false);

  // 2D Floor & Washroom Builder State
  const [newTableNumber, setNewTableNumber] = useState<number>(9);
  const [newTableZone, setNewTableZone] = useState("AC Family Hall");
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableX, setNewTableX] = useState(74);
  const [newTableY, setNewTableY] = useState(50);
  const [restroomDir, setRestroomDir] = useState("");
  const [handwashDir, setHandwashDir] = useState("");
  const [washroomX, setWashroomX] = useState(86);
  const [washroomY, setWashroomY] = useState(16);
  const [handwashX, setHandwashX] = useState(72);
  const [handwashY, setHandwashY] = useState(16);
  const [floorSaveMsg, setFloorSaveMsg] = useState<string | null>(null);

  // Configurable Discounts State (Owner & Manager)
  const [phoneDiscPct, setPhoneDiscPct] = useState<number>(5);
  const [reviewDiscPct, setReviewDiscPct] = useState<number>(2);
  const [discSaveMsg, setDiscSaveMsg] = useState<string | null>(null);

  // RBAC Matrix State (Owner Admin)
  const [rbacMatrix, setRbacMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [rbacSaveMsg, setRbacSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(activeRole === "owner" ? "analytics" : "floor");
  }, [activeRole]);

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  useEffect(() => {
    if (restaurant) {
      setPhoneDiscPct((restaurant.phone_discount_bps ?? 500) / 100);
      setReviewDiscPct((restaurant.google_review_discount_bps ?? 200) / 100);
      setRestroomDir(restaurant.facilities_info?.restroom_directions || "");
      setHandwashDir(restaurant.facilities_info?.handwash_station || "");
      const wPin = (restaurant.floor_pins || []).find(
        (p: any) => p.pin_type === "washroom"
      );
      const hPin = (restaurant.floor_pins || []).find(
        (p: any) => p.pin_type === "handwash"
      );
      if (wPin) {
        setWashroomX(wPin.x_pct);
        setWashroomY(wPin.y_pct);
      }
      if (hPin) {
        setHandwashX(hPin.x_pct);
        setHandwashY(hPin.y_pct);
      }
      if (restaurant.rbac_permissions) {
        setRbacMatrix(restaurant.rbac_permissions);
      }
    }
  }, [restaurant]);

  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (tables.length > 0) {
      const maxNum = Math.max(...tables.map((t: any) => t.table_number));
      setNewTableNumber(maxNum + 1);
    }
  }, [tables.length]);

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
          label: "Executive Dashboard",
          icon: <BarChart3 className="w-4 h-4" />,
        },
        {
          id: "floor_setup",
          label: "2D Floor & Washroom Map",
          icon: <Compass className="w-4 h-4" />,
          badge: `${tables.length}T`,
        },
        {
          id: "discounts",
          label: "Discounts & Google Review %",
          icon: <Percent className="w-4 h-4" />,
          badge: `${phoneDiscPct}%+${reviewDiscPct}%`,
        },
        {
          id: "rbac",
          label: "RBAC Staff Permissions",
          icon: <ShieldCheck className="w-4 h-4" />,
        },
        {
          id: "menu",
          label: "Menu & Dish Manager",
          icon: <Utensils className="w-4 h-4" />,
          badge: menuData?.items?.length || 0,
        },
        {
          id: "settlements",
          label: "Settlement Report",
          icon: <FileSpreadsheet className="w-4 h-4" />,
        },
        {
          id: "customers",
          label: "Retained Guests (DPDP)",
          icon: <Users className="w-4 h-4" />,
        },
      ]
    : [
        {
          id: "floor",
          label: "Live Table Occupancy",
          icon: <LayoutGrid className="w-4 h-4" />,
          badge: amberCount > 0 ? `${amberCount}!` : seatedCount,
        },
        {
          id: "floor_setup",
          label: "2D Floor & Washroom Map",
          icon: <Compass className="w-4 h-4" />,
        },
        {
          id: "discounts",
          label: "Discounts & Google Review %",
          icon: <Percent className="w-4 h-4" />,
        },
        {
          id: "requests",
          label: "1-Tap Guest Requests",
          icon: <Bell className="w-4 h-4" />,
          badge: serviceRequests.length,
        },
        {
          id: "menu",
          label: "Menu & Dish Manager",
          icon: <Utensils className="w-4 h-4" />,
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

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/tables/${activeRestaurantId}`, {
        method: "POST",
        body: JSON.stringify({
          table_number: newTableNumber,
          zone: newTableZone,
          capacity: newTableCap,
          x_pct: newTableX,
          y_pct: newTableY,
        }),
      });
      setFloorSaveMsg(`Added Table #${newTableNumber} to 2D Floor Map with auto QR token!`);
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
      setTimeout(() => setFloorSaveMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveFloorFacilities = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/restaurants/${activeRestaurantId}/floor-layout`, {
        method: "PATCH",
        body: JSON.stringify({
          facilities_info: {
            ...restaurant?.facilities_info,
            restroom_directions: restroomDir,
            handwash_station: handwashDir,
          },
          floor_pins: [
            {
              pin_type: "washroom",
              label: "Gents & Ladies Washroom",
              x_pct: washroomX,
              y_pct: washroomY,
            },
            {
              pin_type: "handwash",
              label: "Warm Water Handwash",
              x_pct: handwashX,
              y_pct: handwashY,
            },
            {
              pin_type: "kitchen",
              label: "Live Kitchen & Tandoor",
              x_pct: 86,
              y_pct: 78,
            },
            {
              pin_type: "entrance",
              label: "Main Welcome Gate",
              x_pct: 14,
              y_pct: 84,
            },
          ],
        }),
      });
      setFloorSaveMsg(
        "Saved 2D Washroom & Handwash coordinates! Customer QR map updated live."
      );
      queryClient.invalidateQueries({ queryKey: ["restaurant", activeRestaurantId] });
      setTimeout(() => setFloorSaveMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveDiscounts = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/restaurants/${activeRestaurantId}/discounts`, {
        method: "PATCH",
        body: JSON.stringify({
          phone_discount_bps: Math.round(phoneDiscPct * 100),
          google_review_discount_bps: Math.round(reviewDiscPct * 100),
        }),
      });
      setDiscSaveMsg(
        `Updated Live: Mobile OTP = ${phoneDiscPct}% Off • Google Review = +${reviewDiscPct}% Off!`
      );
      queryClient.invalidateQueries({ queryKey: ["restaurant", activeRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["menu", activeRestaurantId] });
      setTimeout(() => setDiscSaveMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleRbac = (roleKey: string, permKey: string) => {
    setRbacMatrix((prev) => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || {}),
        [permKey]: !prev[roleKey]?.[permKey],
      },
    }));
  };

  const handleSaveRbac = async () => {
    try {
      await apiFetch(`/api/restaurants/${activeRestaurantId}/rbac`, {
        method: "PATCH",
        body: JSON.stringify({ rbac_permissions: rbacMatrix }),
      });
      setRbacSaveMsg("Saved Department RBAC View/Edit permissions!");
      queryClient.invalidateQueries({ queryKey: ["restaurant", activeRestaurantId] });
      setTimeout(() => setRbacSaveMsg(null), 4000);
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
          ingredients: ["Whole Wheat", "Pure Desi Ghee"],
          base_price_paise: paise,
          prep_time_minutes: Number(newDishPrep) || 5,
          is_veg: true,
          spice_level: "mild",
          image_url: "/images/dishes/butter-naan.svg",
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
      portalTitle={
        isOwnerPortal ? "INTELLIGENT RESTAURANT ADMIN" : "INTELLIGENT FLOOR COMMAND"
      }
      portalSubtitle={
        isOwnerPortal
          ? "Next-gen infrastructure for floor mapping, washroom routing, RBAC permissions & discount automation"
          : "Real-time table occupancy radar, 2D floor & washroom setup, and guest discount rules"
      }
      portalRoleBadge={isOwnerPortal ? "OWNER ADMIN" : "FLOOR MANAGER"}
      menuItems={sidebarItems}
      activeMenuId={activeTab}
      onSelectMenu={setActiveTab}
      showCctvControl={true}
      heroMetrics={[
        {
          label: "Occupied Tables",
          value: `${seatedCount + amberCount} / ${tables.length}`,
          progressPct:
            tables.length > 0
              ? Math.round(((seatedCount + amberCount) / tables.length) * 100)
              : 50,
        },
        {
          label: "Guest Discount Rule",
          value: `${phoneDiscPct}% + ${reviewDiscPct}%`,
          progressPct: 82,
        },
      ]}
      heroRightStat={{
        leftValue: `${seatedCount} Seated`,
        leftLabel: "CURRENT FLOOR LOAD",
        rightValue: `${amberCount} Amber`,
        rightLabel: "IDLE ALERTS",
      }}
      headerActions={
        <button
          onClick={() => playAlertChime("amber")}
          className="px-3.5 py-2 rounded-full bg-white shadow-2xs text-xs font-semibold text-[#1E201F] hover:bg-[#222423] hover:text-[#9FE870] transition flex items-center gap-1.5"
        >
          <Volume2 className="w-3.5 h-3.5" />
          Chime
        </button>
      }
    >
      <div className="space-y-5">
        {/* Live Amber Alert Banner */}
        {lastAmberAlert && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-[26px] p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-[#1E201F] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1E201F] flex items-center gap-2">
                  <span>AMBER IDLE ALERT — TABLE #{lastAmberAlert.table_number}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#222423] text-[#9FE870] text-[10px] font-bold uppercase">
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
                className="px-4 py-2 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] font-bold text-xs transition"
              >
                Open Table #{lastAmberAlert.table_number} Menu →
              </button>
              <button
                onClick={() => setLastAmberAlert(null)}
                className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 1: EXECUTIVE ANALYTICS (Exact Match to Eco System Reference) */}
        {/* ================================================================ */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            {/* Row of 3 Compact KPI Pill Cards (Matches CO2 / Yield / Water row in Reference) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-[24px] p-5 shadow-2xs border border-stone-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#F4F6F4] flex items-center justify-center text-xs font-bold text-stone-500">
                    ORD
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#1E201F]">
                      {analytics?.summary?.total_orders_count ?? 8}
                    </div>
                    <div className="text-xs text-stone-400">Total Table Orders</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#9FE870]/25 text-[#222423] text-[10px] font-bold">
                  Sample data
                </span>
              </div>

              <div className="bg-white rounded-[24px] p-5 shadow-2xs border border-stone-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#F4F6F4] flex items-center justify-center text-xs font-bold text-stone-500">
                    VIP
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#1E201F]">
                      {analytics?.summary?.total_customers_count ?? 3}
                    </div>
                    <div className="text-xs text-stone-400">DPDP Retained Guests</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#9FE870]/25 text-[#222423] text-[10px] font-bold">
                  +{phoneDiscPct}% Rule
                </span>
              </div>

              <div className="bg-white rounded-[24px] p-5 shadow-2xs border border-stone-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#F4F6F4] flex items-center justify-center text-xs font-bold text-stone-500">
                    REV
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#1E201F]">
                      +{reviewDiscPct}%
                    </div>
                    <div className="text-xs text-stone-400">
                      Google Review Bonus Off
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#222423] text-[#9FE870] text-[10px] font-bold">
                  Active
                </span>
              </div>
            </div>

            {/* Bottom Charts Grid (Lime-Green #9FE870 & Charcoal #222423) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#1E201F]">
                      Weekly Order Velocity
                    </h3>
                    <p className="text-xs text-stone-400">
                      Overview of orders processed across all dining zones
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F4F6F4] border border-stone-200 text-[11px] font-semibold text-stone-600">
                    Sample data • Week &gt;
                  </span>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.peak_hours || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECEFEC" />
                      <XAxis dataKey="hour" stroke="#88928C" fontSize={11} />
                      <YAxis stroke="#88928C" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222423",
                          color: "#FFFFFF",
                          borderRadius: "14px",
                          border: "none",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="orders" fill="#9FE870" radius={[8, 8, 8, 8]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#1E201F]">
                      Top Dish Efficiency
                    </h3>
                    <p className="text-xs text-stone-400">
                      Most ordered dishes across tables
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F4F6F4] border border-stone-200 text-[11px] font-semibold text-stone-600">
                    Sample data
                  </span>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.best_sellers || []}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECEFEC" />
                      <XAxis type="number" stroke="#88928C" fontSize={11} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={135}
                        stroke="#1E201F"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222423",
                          color: "#FFFFFF",
                          borderRadius: "14px",
                          border: "none",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="orders" fill="#222423" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: 2D FLOOR, TABLE & WASHROOM MAP BUILDER (Answers how!)     */}
        {/* ================================================================ */}
        {activeTab === "floor_setup" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Interactive 2D Visual Floor Map with Tables & Washroom Pins */}
            <div className="lg:col-span-7 bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#1E201F]">
                    Interactive 2D Floor Plan & Facility Locator
                  </h3>
                  <p className="text-xs text-stone-400">
                    Shows exact coordinates of Tables (#1–#{tables.length}), Washrooms, Handwash & Kitchen. Customers see this map when they scan their Table QR!
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#222423] text-[#9FE870] text-[10px] font-bold">
                  Live Spatial Map
                </span>
              </div>

              {/* 2D Architectural Blueprint Canvas */}
              <div className="relative h-[420px] rounded-[24px] bg-[#EEF2EE] border-2 border-dashed border-stone-300 overflow-hidden select-none">
                {/* Grid lines */}
                <div
                  className="absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Zone Labels */}
                <div className="absolute top-3 left-4 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Dining Zones & Table Coordinates
                </div>

                {/* Washroom Pin */}
                <div
                  style={{ left: `${washroomX}%`, top: `${washroomY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                >
                  <div className="px-3 py-1.5 rounded-2xl bg-indigo-600 text-white text-[11px] font-bold shadow-lg flex items-center gap-1 whitespace-nowrap">
                    <span>🚻 Washroom</span>
                  </div>
                </div>

                {/* Handwash Pin */}
                <div
                  style={{ left: `${handwashX}%`, top: `${handwashY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                >
                  <div className="px-3 py-1.5 rounded-2xl bg-sky-600 text-white text-[11px] font-bold shadow-lg flex items-center gap-1 whitespace-nowrap">
                    <span>🧼 Handwash</span>
                  </div>
                </div>

                {/* Kitchen Pin */}
                <div
                  style={{ left: "86%", top: "78%" }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="px-3 py-1.5 rounded-2xl bg-[#222423] text-[#9FE870] text-[11px] font-bold shadow-lg whitespace-nowrap">
                    🔥 Kitchen KDS
                  </div>
                </div>

                {/* Entrance Pin */}
                <div
                  style={{ left: "14%", top: "86%" }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="px-3 py-1.5 rounded-2xl bg-stone-700 text-white text-[11px] font-bold shadow-md whitespace-nowrap">
                    🚪 Main Entry
                  </div>
                </div>

                {/* Table Nodes on the 2D Map */}
                {tables.map((t: any) => {
                  const isRed = t.status === "empty";
                  const isAmber = t.status === "amber";
                  const nodeBg = isRed
                    ? "bg-rose-500 text-white border-white"
                    : isAmber
                    ? "bg-amber-400 text-[#1E201F] border-[#1E201F] animate-pulse"
                    : "bg-[#9FE870] text-[#1E201F] border-[#222423]";

                  return (
                    <div
                      key={t.table_id}
                      style={{ left: `${t.x_pct}%`, top: `${t.y_pct}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl border-2 shadow-lg flex flex-col items-center justify-center cursor-pointer transition hover:scale-105 ${nodeBg}`}
                      title={`Table #${t.table_number} (${t.zone}) • Capacity: ${t.capacity}`}
                    >
                      <span className="text-xs font-extrabold">T#{t.table_number}</span>
                      <span className="text-[9px] font-semibold opacity-80">
                        {t.capacity} Seats
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Add Table + Set Washroom Coordinates & Text */}
            <div className="lg:col-span-5 space-y-4">
              {floorSaveMsg && (
                <div className="p-3.5 rounded-2xl bg-[#9FE870]/30 border border-[#65A30D] text-xs font-bold text-[#1E201F]">
                  {floorSaveMsg}
                </div>
              )}

              {/* Add Table Card */}
              <form
                onSubmit={handleAddTable}
                className="bg-white rounded-[28px] p-5 shadow-2xs border border-stone-200/60 space-y-3.5 text-xs"
              >
                <h4 className="text-sm font-bold text-[#1E201F] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#65A30D]" />
                  1. Add Table & Place on Floor Map
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Table #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(Number(e.target.value))}
                      className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Seats
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={newTableCap}
                      onChange={(e) => setNewTableCap(Number(e.target.value))}
                      className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Zone
                    </label>
                    <input
                      type="text"
                      value={newTableZone}
                      onChange={(e) => setNewTableZone(e.target.value)}
                      className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Map X Position ({newTableX}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={85}
                      value={newTableX}
                      onChange={(e) => setNewTableX(Number(e.target.value))}
                      className="w-full accent-[#222423]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Map Y Position ({newTableY}%)
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={85}
                      value={newTableY}
                      onChange={(e) => setNewTableY(Number(e.target.value))}
                      className="w-full accent-[#222423]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] font-bold transition"
                >
                  + Add Table #{newTableNumber} & Generate Table QR
                </button>
              </form>

              {/* Configure Washroom & Handwash Pin Location Card */}
              <form
                onSubmit={handleSaveFloorFacilities}
                className="bg-white rounded-[28px] p-5 shadow-2xs border border-stone-200/60 space-y-3.5 text-xs"
              >
                <h4 className="text-sm font-bold text-[#1E201F] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  2. Set Washroom & Handwash Location
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Washroom Pin X ({washroomX}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={92}
                      value={washroomX}
                      onChange={(e) => setWashroomX(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 font-semibold mb-1">
                      Washroom Pin Y ({washroomY}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={washroomY}
                      onChange={(e) => setWashroomY(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    Washroom Walking Directions (Shown to Customer)
                  </label>
                  <input
                    type="text"
                    value={restroomDir}
                    onChange={(e) => setRestroomDir(e.target.value)}
                    className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    Handwash Basin Directions
                  </label>
                  <input
                    type="text"
                    value={handwashDir}
                    onChange={(e) => setHandwashDir(e.target.value)}
                    className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2 font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Floor & Washroom Map
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: CONFIGURABLE DISCOUNTS (Mobile % + Google Review %)       */}
        {/* ================================================================ */}
        {activeTab === "discounts" && (
          <form
            onSubmit={handleSaveDiscounts}
            className="bg-white rounded-[28px] p-6 sm:p-8 shadow-2xs border border-stone-200/60 max-w-2xl space-y-6"
          >
            <div>
              <span className="px-3 py-1 rounded-full bg-[#9FE870]/30 text-[#1E201F] text-[10px] font-bold uppercase">
                Owner & Manager Controlled
              </span>
              <h3 className="text-lg font-bold text-[#1E201F] mt-2">
                Customer Retention & Google Review Discount Rules
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Decide the exact discount percentages offered to guests for Mobile OTP Verification and for completing a Google Review on the Final Billing Screen.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F4F6F4] border border-stone-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E201F]">
                    1. Mobile Number + DPDP Verification Discount (%)
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#222423] text-[#9FE870] text-xs font-bold">
                    {phoneDiscPct}% OFF
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={phoneDiscPct}
                  onChange={(e) => setPhoneDiscPct(Number(e.target.value))}
                  className="w-full accent-[#222423]"
                />
                <p className="text-[11px] text-stone-500">
                  Applied automatically when the customer verifies their WhatsApp number at table entry.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F4F6F4] border border-stone-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E201F]">
                    2. Google Review Reward Discount on Billing Screen (%)
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#9FE870] text-[#1E201F] text-xs font-bold">
                    +{reviewDiscPct}% EXTRA OFF
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={reviewDiscPct}
                  onChange={(e) => setReviewDiscPct(Number(e.target.value))}
                  className="w-full accent-[#65A30D]"
                />
                <p className="text-[11px] text-stone-500">
                  Unlocked when the customer clicks "Complete Lunch/Dinner" and submits a Google Review before paying. Combined max discount:{" "}
                  <strong>{phoneDiscPct + reviewDiscPct}%</strong>.
                </p>
              </div>
            </div>

            {discSaveMsg && (
              <div className="p-3.5 rounded-2xl bg-[#9FE870]/30 border border-[#65A30D] text-xs font-bold text-[#1E201F]">
                {discSaveMsg}
              </div>
            )}

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] text-xs font-bold transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Discount Percentages Live
            </button>
          </form>
        )}

        {/* ================================================================ */}
        {/* TAB 4: RBAC DEPARTMENT PERMISSIONS MATRIX (Owner Admin)          */}
        {/* ================================================================ */}
        {activeTab === "rbac" && (
          <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-2xs border border-stone-200/60 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-[#1E201F]">
                  Department Role-Based Access Control (RBAC)
                </h3>
                <p className="text-xs text-stone-400">
                  Grant or restrict View & Edit permissions per staff department (`Floor Manager`, `Kitchen KDS`, `Waiter / Runner`).
                </p>
              </div>
              <button
                onClick={handleSaveRbac}
                className="px-5 py-2.5 rounded-xl bg-[#222423] text-[#9FE870] text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save RBAC Matrix
              </button>
            </div>

            {rbacSaveMsg && (
              <div className="p-3 rounded-xl bg-[#9FE870]/30 text-[#1E201F] text-xs font-bold">
                {rbacSaveMsg}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400">
                    <th className="py-3 px-3">Permission Module</th>
                    <th className="py-3 px-3 text-center">Floor Manager</th>
                    <th className="py-3 px-3 text-center">Kitchen KDS</th>
                    <th className="py-3 px-3 text-center">Waiter / Runner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[
                    { key: "floor_map_view", label: "2D Floor & Occupancy Map (View)" },
                    { key: "floor_map_edit", label: "2D Floor & Washroom Pins (Edit)" },
                    { key: "menu_view", label: "Menu Catalog (View)" },
                    { key: "menu_edit", label: "Menu Dishes & Prices (Edit)" },
                    { key: "discounts_edit", label: "Mobile & Google Review Discount % (Edit)" },
                    { key: "orders_view", label: "Live Table Orders & KDS (View/Edit)" },
                    { key: "analytics_view", label: "Executive Analytics (View)" },
                    { key: "settlements_view", label: "Read-Only Settlement Ledger (View)" },
                  ].map((perm) => (
                    <tr key={perm.key} className="hover:bg-[#F4F6F4]/60">
                      <td className="py-3 px-3 font-semibold text-[#1E201F]">
                        {perm.label}
                      </td>
                      {["manager", "kitchen", "waiter"].map((roleKey) => {
                        const checked = !!rbacMatrix?.[roleKey]?.[perm.key];
                        return (
                          <td key={roleKey} className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRbac(roleKey, perm.key)}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition ${
                                checked
                                  ? "bg-[#222423] text-[#9FE870]"
                                  : "bg-[#F4F6F4] text-stone-300 border border-stone-200"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: LIVE TABLE OCCUPANCY CARDS (RED / GREEN / AMBER)          */}
        {/* ================================================================ */}
        {activeTab === "floor" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((t: any) => {
              const isRed = t.status === "empty";
              const isGreen = t.status === "seated";
              const isAmber = t.status === "amber";
              const sess = t.session;
              const hasOrders = t.active_orders && t.active_orders.length > 0;

              const statusPill = isRed
                ? "bg-rose-500 text-white"
                : isAmber
                ? "bg-amber-400 text-[#1E201F] animate-pulse"
                : "bg-[#9FE870] text-[#1E201F]";

              const borderStyle = isRed
                ? "border-stone-200/80"
                : isAmber
                ? "border-amber-400 ring-2 ring-amber-300/40"
                : "border-[#9FE870]";

              return (
                <div
                  key={t.table_id}
                  className={`bg-white rounded-[26px] p-5 shadow-2xs border-2 flex flex-col justify-between transition ${borderStyle}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#1E201F]">
                          Table #{t.table_number}
                        </h3>
                        <div className="text-[11px] text-stone-400">
                          {t.zone} • {t.capacity} Seats
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusPill}`}
                      >
                        {isRed ? "Empty • Red" : isAmber ? "Amber • Idle" : "Seated • Green"}
                      </span>
                    </div>

                    {isRed ? (
                      <div className="py-7 rounded-2xl bg-[#F4F6F4] text-center text-xs text-stone-400">
                        Available to seat guests
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-[#F4F6F4] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#1E201F]" />
                            <strong className="text-[#1E201F]">
                              {sess?.guest_count} Guests
                            </strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white text-[#1E201F] font-bold text-[10px] uppercase">
                            {sess?.source}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">Seated Time</span>
                          <span className="font-mono font-bold text-[#1E201F]">
                            {sess?.seconds_seated || 0}s
                          </span>
                        </div>

                        {hasOrders ? (
                          <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between">
                            <span className="text-[#65A30D] font-bold uppercase text-[11px]">
                              {t.active_orders[0].status}
                            </span>
                            <span className="font-bold text-[#1E201F]">
                              {formatPaise(t.active_orders[0].total_paise)}
                            </span>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between">
                            <span className="text-amber-700 font-semibold text-[11px]">
                              No order yet
                            </span>
                            {isGreen && sess && (
                              <button
                                onClick={() => handleForceAmber(sess.session_id)}
                                className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold"
                              >
                                Test Amber 🔔
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-stone-100 flex items-center gap-2">
                    {isRed ? (
                      <button
                        onClick={() => handleMarkSeated(t.table_number, t.capacity)}
                        className="w-full py-2.5 rounded-xl bg-[#222423] text-[#9FE870] text-xs font-bold flex items-center justify-center gap-1.5 transition"
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
                          className="flex-1 py-2 rounded-xl bg-[#F4F6F4] hover:bg-[#222423] text-[#1E201F] hover:text-white text-xs font-bold transition"
                        >
                          Open Table
                        </button>
                        <button
                          onClick={() => handleMarkEmpty(t.table_number)}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white text-xs font-bold transition flex items-center gap-1"
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
        {/* TAB 6: 1-TAP GUEST REQUESTS                                      */}
        {/* ================================================================ */}
        {activeTab === "requests" && (
          <div className="bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
            <h3 className="text-base font-bold text-[#1E201F]">
              Active 1-Tap Guest Requests ({serviceRequests.length})
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
                    className="p-4 rounded-2xl bg-[#F4F6F4] flex items-center justify-between"
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#222423] text-[#9FE870] text-[10px] font-bold">
                        Table #{sr.table_number}
                      </span>
                      <div className="text-xs font-semibold text-[#1E201F] mt-1.5">
                        {sr.label}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteServiceReq(sr.id)}
                      className="px-4 py-2 rounded-xl bg-[#222423] text-[#9FE870] text-xs font-bold"
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
        {/* TAB 7: MENU & DISH CATALOG (No Platform Markup Shown!)           */}
        {/* ================================================================ */}
        {activeTab === "menu" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <form
              onSubmit={handleAddMenuItem}
              className="bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-3.5 h-fit text-xs"
            >
              <h3 className="text-base font-bold text-[#1E201F] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#65A30D]" />
                Add Dish / Bread to Menu
              </h3>
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Dish Name
                </label>
                <input
                  type="text"
                  required
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder="e.g. Garam Tawa Chapati"
                  className="w-full bg-[#F4F6F4] rounded-xl px-3.5 py-2.5 font-semibold"
                />
              </div>
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newDishCategory}
                  onChange={(e) => setNewDishCategory(e.target.value)}
                  className="w-full bg-[#F4F6F4] rounded-xl px-3.5 py-2.5 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    Restaurant Price (₹)
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={newDishPriceRupees}
                    onChange={(e) => setNewDishPriceRupees(e.target.value)}
                    className="w-full bg-[#F4F6F4] rounded-xl px-3.5 py-2.5 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={newDishPrep}
                    onChange={(e) => setNewDishPrep(e.target.value)}
                    className="w-full bg-[#F4F6F4] rounded-xl px-3.5 py-2.5 font-semibold"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={dishBusy}
                className="w-full py-3 rounded-xl bg-[#222423] text-[#9FE870] font-bold transition"
              >
                {dishBusy ? "Adding..." : "Add Dish to Menu"}
              </button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
              <h3 className="text-base font-bold text-[#1E201F]">
                Restaurant Menu Catalog ({menuData?.items?.length || 0} Dishes)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400">
                      <th className="py-3 px-2">Dish</th>
                      <th className="py-3 px-2">Category</th>
                      <th className="py-3 px-2">Restaurant Price</th>
                      <th className="py-3 px-2">Prep</th>
                      <th className="py-3 px-2">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(menuData?.items || []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#F4F6F4]/60">
                        <td className="py-2.5 px-2 flex items-center gap-2.5 font-bold text-[#1E201F]">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-9 h-9 object-contain shrink-0"
                          />
                          <span>{item.name.replace(" (3D View)", "")}</span>
                        </td>
                        <td className="py-2.5 px-2 text-stone-500">{item.category}</td>
                        <td className="py-2.5 px-2 font-bold text-[#1E201F]">
                          {formatPaise(item.base_price_paise || item.display_price_paise)}
                        </td>
                        <td className="py-2.5 px-2 text-stone-500">
                          {item.prep_time_minutes}m
                        </td>
                        <td className="py-2.5 px-2 font-bold text-[#1E201F]">
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
        {/* TAB 8: RETAINED CUSTOMERS & DPDP REGISTRY                        */}
        {/* ================================================================ */}
        {activeTab === "customers" && (
          <div className="bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
            <h3 className="text-base font-bold text-[#1E201F]">
              Retained Customers & DPDP Consent Registry
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400">
                    <th className="py-3 px-3">Guest Name</th>
                    <th className="py-3 px-3">WhatsApp Phone</th>
                    <th className="py-3 px-3">DPDP Consent</th>
                    <th className="py-3 px-3">Visits</th>
                    <th className="py-3 px-3">Total Spend</th>
                    <th className="py-3 px-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(analytics?.retained_customers || []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#F4F6F4]/60">
                      <td className="py-3 px-3 font-bold text-[#1E201F]">{c.name}</td>
                      <td className="py-3 px-3 font-mono text-stone-600">{c.phone}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#9FE870]/30 text-[#1E201F] text-[10px] font-bold">
                          ✓ Consented
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#1E201F]">
                        {c.visit_count}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#1E201F]">
                        {formatPaise(c.total_spent_paise)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F4F6F4] text-stone-600 text-[10px] font-semibold">
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
        {/* TAB 9: READ-ONLY OWNER SETTLEMENT REPORT (Zero Platform Markup!) */}
        {/* ================================================================ */}
        {activeTab === "settlements" && (
          <div className="space-y-4">
            {settlementError ? (
              <div className="bg-white rounded-[28px] p-10 text-center space-y-2 border border-stone-200/60">
                <Lock className="w-8 h-8 text-stone-400 mx-auto" />
                <h3 className="text-base font-bold text-[#1E201F]">
                  Owner Role Required
                </h3>
                <p className="text-xs text-stone-400">
                  Switch to Restaurant Admin (/owner) to view the read-only settlement report.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#1E201F]">
                      Restaurant Net Settlement Ledger (Read-Only)
                    </h3>
                    <p className="text-xs text-stone-400">
                      Shows restaurant base food value, customer discounts, GST, and net payout
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F4F6F4] text-stone-600 text-[10px] font-bold">
                    Sample data included
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-400">
                        <th className="py-3 px-3">Table</th>
                        <th className="py-3 px-3">Order Food Value</th>
                        <th className="py-3 px-3">Guest Discounts</th>
                        <th className="py-3 px-3">GST Collected</th>
                        <th className="py-3 px-3">Net Restaurant Payout</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(settlements?.entries || []).map((e: any) => (
                        <tr key={e.id} className="hover:bg-[#F4F6F4]/60">
                          <td className="py-3 px-3 font-bold text-[#1E201F]">
                            Table #{e.table_number}
                          </td>
                          <td className="py-3 px-3 text-stone-600">
                            {formatPaise(e.subtotal_base_paise)}
                          </td>
                          <td className="py-3 px-3 text-amber-700 font-semibold">
                            -{formatPaise(e.customer_discount_paise)}
                          </td>
                          <td className="py-3 px-3 text-stone-600">
                            {formatPaise(e.tax_paise)}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#65A30D]">
                            {formatPaise(e.restaurant_net_paise)}
                          </td>
                          <td className="py-3 px-3 uppercase font-mono text-stone-500">
                            {e.payment_method}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#9FE870]/30 text-[#1E201F] text-[10px] font-bold">
                              {e.is_sample_data ? "Sample data" : "Settled"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </InternalPortalLayout>
  );
};
