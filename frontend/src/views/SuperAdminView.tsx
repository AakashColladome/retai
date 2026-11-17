import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Palette,
  Percent,
  Plus,
  Save,
  Sliders,
  Wallet,
} from "lucide-react";
import {
  InternalPortalLayout,
  SidebarMenuItem,
} from "@/components/InternalPortalLayout";
import { apiFetch } from "@/lib/api";
import { applyTenantThemeVars, formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const SuperAdminView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeRestaurantId, setActiveRestaurantId } = useAppStore();
  const [activeMenuId, setActiveMenuId] = useState<string>("overview");

  const { data: overview } = useQuery<any>({
    queryKey: ["super-admin-overview"],
    queryFn: () => apiFetch("/api/super-admin/overview"),
    refetchInterval: 4000,
  });

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  const [nameInput, setNameInput] = useState("");
  const [taglineInput, setTaglineInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF6B4A");
  const [accentColor, setAccentColor] = useState("#141414");
  const [bgColor, setBgColor] = useState("#F7F5F2");
  const [billingModel, setBillingModel] = useState<"one_time_amc" | "profit_share">(
    "profit_share"
  );
  const [markupBps, setMarkupBps] = useState<number>(800);
  const [amberThreshold, setAmberThreshold] = useState<number>(60);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [newSlug, setNewSlug] = useState("royal-haveli-restro");
  const [newName, setNewName] = useState("Royal Haveli Heritage Restro");
  const [newTagline, setNewTagline] = useState(
    "Fine Rajasthani Thali & Courtyard Dining"
  );
  const [newPrimary, setNewPrimary] = useState("#FF6B4A");
  const [newAccent, setNewAccent] = useState("#141414");
  const [newModel, setNewModel] = useState<"one_time_amc" | "profit_share">(
    "profit_share"
  );
  const [newMarkupBps, setNewMarkupBps] = useState(1000);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setNameInput(restaurant.name || "");
      setTaglineInput(restaurant.tagline || "");
      setPrimaryColor(restaurant.theme?.primary_color || "#FF6B4A");
      setAccentColor(restaurant.theme?.accent_color || "#141414");
      setBgColor(restaurant.theme?.bg_color || "#F7F5F2");
      setBillingModel(restaurant.billing_model || "profit_share");
      setMarkupBps(restaurant.markup_bps ?? 800);
      setAmberThreshold(restaurant.amber_threshold_seconds ?? 60);
    }
  }, [restaurant]);

  const sidebarItems: SidebarMenuItem[] = [
    {
      id: "overview",
      label: "Platform Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: overview?.tenants?.length || 2,
    },
    {
      id: "config",
      label: "Branding & Profit-Share",
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: "ledger",
      label: "Global Paise Ledger",
      icon: <FileSpreadsheet className="w-4 h-4" />,
      badge: overview?.recent_ledger?.length,
    },
    {
      id: "onboard",
      label: "Onboard New Client",
      icon: <Plus className="w-4 h-4" />,
    },
  ];

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveBusy(true);
    setSaveToast(null);
    try {
      const updated = await apiFetch(`/api/restaurants/${activeRestaurantId}/config`, {
        method: "PATCH",
        body: JSON.stringify({
          name: nameInput,
          tagline: taglineInput,
          theme: {
            primary_color: primaryColor,
            accent_color: accentColor,
            bg_color: bgColor,
            logo_url:
              restaurant?.theme?.logo_url || "/images/logos/shree-ram-dhaba.svg",
          },
          billing_model: billingModel,
          markup_bps: billingModel === "profit_share" ? markupBps : 0,
          amber_threshold_seconds: amberThreshold,
        }),
      });
      applyTenantThemeVars(updated.theme);
      setSaveToast(
        `Saved ${updated.name}! Server-side menu prices & theme updated live.`
      );
      queryClient.invalidateQueries({ queryKey: ["restaurant", activeRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["menu", activeRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
    } catch (err: any) {
      setSaveToast(`Error: ${err.message}`);
    } finally {
      setSaveBusy(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBusy(true);
    try {
      const created = await apiFetch("/api/restaurants", {
        method: "POST",
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          tagline: newTagline,
          primary_color: newPrimary,
          accent_color: newAccent,
          bg_color: "#F7F5F2",
          billing_model: newModel,
          markup_bps: newModel === "profit_share" ? newMarkupBps : 0,
          table_count: 6,
        }),
      });
      setActiveRestaurantId(created.restaurant_id);
      setActiveMenuId("config");
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <InternalPortalLayout
      portalTitle="Super Admin Command Center"
      portalSubtitle="Multi-tenant white-label management, hidden profit-share formula & global paise ledger"
      portalRoleBadge="SUPER ADMIN"
      menuItems={sidebarItems}
      activeMenuId={activeMenuId}
      onSelectMenu={setActiveMenuId}
      headerActions={
        <button
          onClick={() => setActiveMenuId("onboard")}
          className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tenant
        </button>
      }
    >
      <div className="space-y-6">
        {/* Global KPI Row (Shown on Overview & Ledger) */}
        {(activeMenuId === "overview" || activeMenuId === "ledger") && overview && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80">
              <div className="text-xs text-stone-400 font-medium">
                Global Platform GMV
              </div>
              <div className="text-2xl font-extrabold text-[#141414] mt-1">
                {formatPaise(overview.total_gmv_paise)}
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                Sample data + Live Orders
              </div>
            </div>

            <div className="bg-[#141414] text-white rounded-3xl p-5 shadow-lg">
              <div className="text-xs text-stone-400 font-medium">
                Platform Hidden Profit-Share Earned
              </div>
              <div className="text-2xl font-extrabold text-[#FF6B4A] mt-1">
                {formatPaise(overview.total_platform_markup_paise)}
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                Embedded invisibly in item prices
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80">
              <div className="text-xs text-stone-400 font-medium">
                One-Time Setup Licenses
              </div>
              <div className="text-2xl font-extrabold text-[#141414] mt-1">
                {formatPaise(overview.total_one_time_fees_paise)}
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                One-Time + AMC Tenants
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80">
              <div className="text-xs text-stone-400 font-medium">
                Annual AMC Recurring
              </div>
              <div className="text-2xl font-extrabold text-[#141414] mt-1">
                {formatPaise(overview.total_amc_fees_paise)}/yr
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                Active Clients: {overview.tenants?.length || 2}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: PLATFORM OVERVIEW & TENANT PORTFOLIO */}
        {activeMenuId === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(overview?.tenants || []).map((t: any) => {
              const isSelected = t.restaurant_id === activeRestaurantId;
              return (
                <div
                  key={t.restaurant_id}
                  className={`bg-white rounded-3xl p-6 shadow-xs border-2 transition space-y-4 ${
                    isSelected ? "border-[#FF6B4A]" : "border-stone-200/80"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#141414] text-white flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[#FF6B4A]" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-[#141414]">
                          {t.name}
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          ID: {t.restaurant_id}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                        t.billing_model === "profit_share"
                          ? "bg-[#FF6B4A]/15 text-[#FF6B4A]"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {t.billing_model === "profit_share"
                        ? `${(t.markup_bps / 100).toFixed(0)}% Profit-Share`
                        : "One-Time + AMC"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#FAF8F6] text-xs">
                    <div>
                      <div className="text-stone-400">Gross GMV</div>
                      <div className="text-sm font-extrabold text-[#141414] mt-0.5">
                        {formatPaise(t.gross_gmv_paise)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400">Restaurant Net</div>
                      <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
                        {formatPaise(t.restaurant_net_paise)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400">Platform Cut</div>
                      <div className="text-sm font-extrabold text-[#FF6B4A] mt-0.5">
                        {formatPaise(t.platform_hidden_markup_paise)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-stone-400">
                      Settled Orders: <strong>{t.orders_settled_count}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setActiveRestaurantId(t.restaurant_id);
                        setActiveMenuId("config");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold transition"
                    >
                      Configure Branding & Formula →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: WHITE-LABEL BRANDING & PROFIT-SHARE FORMULA CONFIGURATOR */}
        {activeMenuId === "config" && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-stone-200/80 space-y-6 max-w-4xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#141414] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#FF6B4A]" />
                  Configure Tenant:{" "}
                  <span className="text-[#FF6B4A]">{restaurant?.name}</span>
                </h2>
                <p className="text-xs text-stone-400">
                  Updates customer menu pricing, branding, and idle threshold immediately
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 font-bold">
                {activeRestaurantId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-stone-400 font-bold mb-1">
                  Restaurant Brand Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-[#F7F5F2] rounded-xl px-4 py-3 font-bold text-[#141414] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-stone-400 font-bold mb-1">
                  Brand Tagline
                </label>
                <input
                  type="text"
                  value={taglineInput}
                  onChange={(e) => setTaglineInput(e.target.value)}
                  className="w-full bg-[#F7F5F2] rounded-xl px-4 py-3 font-bold text-[#141414] focus:outline-none"
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF8F6] border border-stone-200/60 space-y-3">
              <div className="text-xs font-extrabold text-[#141414] flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-[#FF6B4A]" />
                White-Label Theme Colors & Idle Amber Threshold
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-stone-400 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-stone-200">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full font-mono text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-stone-400 mb-1">Accent Color</label>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-stone-200">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full font-mono text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-stone-400 mb-1">
                    Amber Idle Threshold (sec)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={3600}
                    value={amberThreshold}
                    onChange={(e) => setAmberThreshold(Number(e.target.value))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-[#141414]"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF8F6] border border-stone-200/60 space-y-4">
              <div className="text-xs font-extrabold text-[#141414] flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#FF6B4A]" />
                Monetization Formula (Server-Side Integer Paise)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingModel("profit_share")}
                  className={`p-4 rounded-2xl border text-left transition ${
                    billingModel === "profit_share"
                      ? "bg-[#141414] text-white border-[#141414]"
                      : "bg-white text-stone-500 border-stone-200"
                  }`}
                >
                  <div className="font-extrabold text-sm">
                    Profit-Sharing (Hidden Markup)
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Embeds markup % into menu display prices. ₹0 platform fee shown on customer bill.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingModel("one_time_amc")}
                  className={`p-4 rounded-2xl border text-left transition ${
                    billingModel === "one_time_amc"
                      ? "bg-[#141414] text-white border-[#141414]"
                      : "bg-white text-stone-500 border-stone-200"
                  }`}
                >
                  <div className="font-extrabold text-sm">One-Time Setup + AMC</div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Fixed license & annual maintenance. Menu prices match 100% of restaurant base prices.
                  </p>
                </button>
              </div>

              {billingModel === "profit_share" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-600 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-[#FF6B4A]" />
                      Hidden Platform Markup:
                    </span>
                    <span className="font-extrabold text-[#FF6B4A] text-sm">
                      {markupBps} bps ({(markupBps / 100).toFixed(1)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={100}
                    value={markupBps}
                    onChange={(e) => setMarkupBps(Number(e.target.value))}
                    className="w-full accent-[#FF6B4A]"
                  />
                  <div className="p-3 rounded-xl bg-white border border-stone-200/70 text-[11px] text-stone-600 flex items-center justify-between">
                    <span>Base Dish: ₹260</span>
                    <span className="font-extrabold text-[#141414]">
                      Customer Menu Price:{" "}
                      {formatPaise(
                        Math.round((26000 * (10000 + markupBps)) / 10000 / 100) * 100
                      )}{" "}
                      • Visible Platform Fee: ₹0
                    </span>
                  </div>
                </div>
              )}
            </div>

            {saveToast && (
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                {saveToast}
              </div>
            )}

            <button
              type="submit"
              disabled={saveBusy}
              className="px-8 py-3.5 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Save className="w-4 h-4" />
              <span>
                {saveBusy
                  ? "Saving Configuration..."
                  : "Save Tenant Branding & Pricing Formula"}
              </span>
            </button>
          </form>
        )}

        {/* VIEW 3: GLOBAL PAISE SETTLEMENT LEDGER */}
        {(activeMenuId === "ledger" || activeMenuId === "overview") && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-[#141414]">
                  Global Server-Side Paise Ledger
                </h3>
                <p className="text-xs text-stone-400">
                  Tracks Base Menu Value, Display Subtotal, 5% Discount, GST on (Subtotal - Discount), and Platform Profit Share
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-extrabold">
                Sample data + Live Settlements
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400">
                    <th className="py-3 px-3">Tenant</th>
                    <th className="py-3 px-3">Table</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-3">Base Value</th>
                    <th className="py-3 px-3">Display Subtotal</th>
                    <th className="py-3 px-3">5% Discount</th>
                    <th className="py-3 px-3">GST</th>
                    <th className="py-3 px-3">Gross Bill</th>
                    <th className="py-3 px-3">Platform Cut</th>
                    <th className="py-3 px-3">Restro Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(overview?.recent_ledger || []).map((e: any) => (
                    <tr key={e.id} className="hover:bg-[#FAF8F6]">
                      <td className="py-3 px-3 font-extrabold text-[#141414]">
                        {e.restaurant_id}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        Table #{e.table_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#F7F5F2] text-stone-600 text-[10px] font-bold">
                          {e.billing_model}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {formatPaise(e.subtotal_base_paise)}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {formatPaise(e.subtotal_display_paise)}
                      </td>
                      <td className="py-3 px-3 text-emerald-600 font-semibold">
                        -{formatPaise(e.customer_discount_paise)}
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {formatPaise(e.tax_paise)}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#141414]">
                        {formatPaise(e.gross_bill_paise)}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#FF6B4A]">
                        +{formatPaise(e.platform_hidden_markup_paise)}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-emerald-700">
                        {formatPaise(e.restaurant_net_paise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: ONBOARD NEW WHITE-LABEL RESTAURANT CLIENT */}
        {activeMenuId === "onboard" && (
          <form
            onSubmit={handleCreateTenant}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-stone-200/80 max-w-xl space-y-4 text-xs"
          >
            <div>
              <h3 className="text-lg font-extrabold text-[#141414]">
                Onboard New White-Label Restaurant Client
              </h3>
              <p className="text-xs text-stone-400">
                Creates a new multi-tenant restaurant with tables, QR tokens, and starter 3D menu items.
              </p>
            </div>

            <div>
              <label className="block text-stone-400 font-bold mb-1">
                Tenant Slug (restaurant_id)
              </label>
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full bg-[#F7F5F2] rounded-xl px-4 py-2.5 font-mono font-bold text-[#141414]"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-bold mb-1">
                Restaurant Display Name
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#F7F5F2] rounded-xl px-4 py-2.5 font-bold text-[#141414]"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-bold mb-1">Tagline</label>
              <input
                type="text"
                value={newTagline}
                onChange={(e) => setNewTagline(e.target.value)}
                className="w-full bg-[#F7F5F2] rounded-xl px-4 py-2.5 font-bold text-[#141414]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-400 font-bold mb-1">
                  Billing Model
                </label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value as any)}
                  className="w-full bg-[#F7F5F2] rounded-xl px-3 py-2.5 font-bold text-[#141414]"
                >
                  <option value="profit_share">Profit-Share (Hidden Markup)</option>
                  <option value="one_time_amc">One-Time + AMC</option>
                </select>
              </div>
              <div>
                <label className="block text-stone-400 font-bold mb-1">
                  Hidden Markup (bps)
                </label>
                <input
                  type="number"
                  value={newMarkupBps}
                  onChange={(e) => setNewMarkupBps(Number(e.target.value))}
                  className="w-full bg-[#F7F5F2] rounded-xl px-3 py-2.5 font-bold text-[#141414]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createBusy}
              className="w-full py-3.5 rounded-xl bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold transition"
            >
              {createBusy ? "Onboarding..." : "Create Tenant Live"}
            </button>
          </form>
        )}
      </div>
    </InternalPortalLayout>
  );
};
