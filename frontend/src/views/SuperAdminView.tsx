import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
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
  const [primaryColor, setPrimaryColor] = useState("#222423");
  const [accentColor, setAccentColor] = useState("#9FE870");
  const [bgColor, setBgColor] = useState("#F4F6F4");
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
  const [newPrimary, setNewPrimary] = useState("#222423");
  const [newAccent, setNewAccent] = useState("#9FE870");
  const [newModel, setNewModel] = useState<"one_time_amc" | "profit_share">(
    "profit_share"
  );
  const [newMarkupBps, setNewMarkupBps] = useState(1000);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setNameInput(restaurant.name || "");
      setTaglineInput(restaurant.tagline || "");
      setPrimaryColor(restaurant.theme?.primary_color || "#222423");
      setAccentColor(restaurant.theme?.accent_color || "#9FE870");
      setBgColor(restaurant.theme?.bg_color || "#F4F6F4");
      setBillingModel(restaurant.billing_model || "profit_share");
      setMarkupBps(restaurant.markup_bps ?? 800);
      setAmberThreshold(restaurant.amber_threshold_seconds ?? 60);
    }
  }, [restaurant]);

  const sidebarItems: SidebarMenuItem[] = [
    {
      id: "overview",
      label: "Platform Ecosystem",
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: overview?.tenants?.length || 2,
    },
    {
      id: "config",
      label: "Platform Charges & Markup",
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: "ledger",
      label: "Confidential Split Ledger",
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      id: "onboard",
      label: "Onboard New Restaurant",
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
        `Saved ${updated.name}! Confidential platform markup & branding updated live.`
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
          bg_color: "#F4F6F4",
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
      portalTitle="INTELLIGENT PLATFORM HQ"
      portalSubtitle="Super Admin control center — confidential platform charges, profit-share formula & tenant onboarding"
      portalRoleBadge="SUPER ADMIN ONLY"
      menuItems={sidebarItems}
      activeMenuId={activeMenuId}
      onSelectMenu={setActiveMenuId}
      showCctvControl={true}
      heroMetrics={[
        {
          label: "Global Platform GMV",
          value: formatPaise(overview?.total_gmv_paise || 0),
          progressPct: 84,
        },
        {
          label: "Hidden Profit-Share Cut",
          value: formatPaise(overview?.total_platform_markup_paise || 0),
          progressPct: 72,
        },
      ]}
      heroRightStat={{
        leftValue: `${overview?.tenants?.length || 2} Clients`,
        leftLabel: "ONBOARDED TENANTS",
        rightValue: "100% Hidden",
        rightLabel: "PLATFORM FEE VISIBILITY",
      }}
      headerActions={
        <button
          onClick={() => setActiveMenuId("onboard")}
          className="px-4 py-2 rounded-full bg-[#222423] text-[#9FE870] text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Onboard Restaurant
        </button>
      }
    >
      <div className="space-y-5">
        {/* Strict Confidentiality Notice */}
        <div className="bg-white rounded-[24px] p-4 border border-stone-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#1E201F]">
            <Lock className="w-4 h-4 text-[#65A30D]" />
            <span>
              <strong>Confidential Platform Pricing:</strong> Platform charges (`markup_bps` & profit-share splits) are controlled exclusively by Super Admin and are <strong>never shown</strong> to Restaurant Owners, Managers, or Customers.
            </span>
          </div>
        </div>

        {/* VIEW 1: PLATFORM OVERVIEW & TENANT PORTFOLIO */}
        {activeMenuId === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {(overview?.tenants || []).map((t: any) => {
              const isSelected = t.restaurant_id === activeRestaurantId;
              return (
                <div
                  key={t.restaurant_id}
                  className={`bg-white rounded-[28px] p-6 shadow-2xs border-2 transition space-y-4 ${
                    isSelected ? "border-[#222423]" : "border-stone-200/60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#222423] text-[#9FE870] flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#1E201F]">
                          {t.name}
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          ID: {t.restaurant_id}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        t.billing_model === "profit_share"
                          ? "bg-[#9FE870] text-[#1E201F]"
                          : "bg-[#F4F6F4] text-[#1E201F]"
                      }`}
                    >
                      {t.billing_model === "profit_share"
                        ? `${(t.markup_bps / 100).toFixed(0)}% Hidden Profit-Share`
                        : "One-Time + AMC"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#F4F6F4] text-xs">
                    <div>
                      <div className="text-stone-400">Gross GMV</div>
                      <div className="text-sm font-bold text-[#1E201F] mt-0.5">
                        {formatPaise(t.gross_gmv_paise)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400">Restaurant Net</div>
                      <div className="text-sm font-bold text-stone-700 mt-0.5">
                        {formatPaise(t.restaurant_net_paise)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400">Your Platform Cut</div>
                      <div className="text-sm font-bold text-[#65A30D] mt-0.5">
                        +{formatPaise(t.platform_hidden_markup_paise)}
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
                      className="px-4 py-2 rounded-xl bg-[#222423] text-[#9FE870] text-xs font-bold transition"
                    >
                      Configure Platform Charges →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: CONFIDENTIAL PLATFORM CHARGES & BRANDING CONFIGURATOR */}
        {activeMenuId === "config" && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-white rounded-[28px] p-6 sm:p-8 shadow-2xs border border-stone-200/60 space-y-6 max-w-4xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#1E201F] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#65A30D]" />
                  Platform Charges & White-Label:{" "}
                  <span className="text-[#65A30D]">{restaurant?.name}</span>
                </h2>
                <p className="text-xs text-stone-400">
                  Only Super Admin can view or modify these commercial platform charges.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#F4F6F4] text-stone-600 font-bold">
                {activeRestaurantId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Restaurant Brand Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-[#F4F6F4] rounded-xl px-4 py-3 font-semibold text-[#1E201F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Brand Tagline
                </label>
                <input
                  type="text"
                  value={taglineInput}
                  onChange={(e) => setTaglineInput(e.target.value)}
                  className="w-full bg-[#F4F6F4] rounded-xl px-4 py-3 font-semibold text-[#1E201F] focus:outline-none"
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#F4F6F4] border border-stone-200/70 space-y-4">
              <div className="text-xs font-bold text-[#1E201F] flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#65A30D]" />
                Super Admin Commercial Formula (Invisible to Owner, Manager & Customer)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingModel("profit_share")}
                  className={`p-4 rounded-2xl border text-left transition ${
                    billingModel === "profit_share"
                      ? "bg-[#222423] text-white border-[#222423]"
                      : "bg-white text-stone-500 border-stone-200"
                  }`}
                >
                  <div className="font-bold text-sm text-[#9FE870]">
                    Profit-Sharing (Hidden Menu Markup)
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Embeds your platform % directly into menu display prices. Hidden from customers and staff.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingModel("one_time_amc")}
                  className={`p-4 rounded-2xl border text-left transition ${
                    billingModel === "one_time_amc"
                      ? "bg-[#222423] text-white border-[#222423]"
                      : "bg-white text-stone-500 border-stone-200"
                  }`}
                >
                  <div className="font-bold text-sm text-[#9FE870]">
                    One-Time License + AMC
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Fixed setup + annual maintenance. Menu display prices match 100% of restaurant base prices.
                  </p>
                </button>
              </div>

              {billingModel === "profit_share" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-600 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-[#65A30D]" />
                      Hidden Platform Commission Basis Points:
                    </span>
                    <span className="font-bold text-[#1E201F] text-sm">
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
                    className="w-full accent-[#222423]"
                  />
                  <div className="p-3 rounded-xl bg-white border border-stone-200/70 text-[11px] text-stone-600 flex items-center justify-between">
                    <span>Restaurant Enters: ₹260</span>
                    <span className="font-bold text-[#1E201F]">
                      Customer Sees:{" "}
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
              <div className="p-3.5 rounded-xl bg-[#9FE870]/30 text-[#1E201F] text-xs font-bold">
                {saveToast}
              </div>
            )}

            <button
              type="submit"
              disabled={saveBusy}
              className="px-8 py-3.5 rounded-xl bg-[#222423] hover:bg-[#333634] text-[#9FE870] font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>
                {saveBusy
                  ? "Saving..."
                  : "Save Confidential Platform Charges & Branding"}
              </span>
            </button>
          </form>
        )}

        {/* VIEW 3: CONFIDENTIAL GLOBAL PAISE LEDGER */}
        {(activeMenuId === "ledger" || activeMenuId === "overview") && (
          <div className="bg-white rounded-[28px] p-6 shadow-2xs border border-stone-200/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#1E201F]">
                  Super Admin Confidential Split Ledger (Integer Paise)
                </h3>
                <p className="text-xs text-stone-400">
                  Shows Restaurant Base Value vs. Display Subtotal vs. Your Hidden Platform Cut
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#F4F6F4] text-stone-600 text-[10px] font-bold">
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
                    <th className="py-3 px-3">Restro Base</th>
                    <th className="py-3 px-3">Customer Display</th>
                    <th className="py-3 px-3">Discounts</th>
                    <th className="py-3 px-3">GST</th>
                    <th className="py-3 px-3">Gross Paid</th>
                    <th className="py-3 px-3">Your Platform Cut</th>
                    <th className="py-3 px-3">Restro Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(overview?.recent_ledger || []).map((e: any) => (
                    <tr key={e.id} className="hover:bg-[#F4F6F4]/60">
                      <td className="py-3 px-3 font-bold text-[#1E201F]">
                        {e.restaurant_id}
                      </td>
                      <td className="py-3 px-3">Table #{e.table_number}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#F4F6F4] text-stone-600 text-[10px] font-semibold">
                          {e.billing_model}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {formatPaise(e.subtotal_base_paise)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#1E201F]">
                        {formatPaise(e.subtotal_display_paise)}
                      </td>
                      <td className="py-3 px-3 text-amber-700">
                        -{formatPaise(e.customer_discount_paise)}
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {formatPaise(e.tax_paise)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#1E201F]">
                        {formatPaise(e.gross_bill_paise)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#65A30D]">
                        +{formatPaise(e.platform_hidden_markup_paise)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#1E201F]">
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
            className="bg-white rounded-[28px] p-6 sm:p-8 shadow-2xs border border-stone-200/60 max-w-xl space-y-4 text-xs"
          >
            <div>
              <h3 className="text-lg font-bold text-[#1E201F]">
                Onboard New White-Label Restaurant Client
              </h3>
              <p className="text-xs text-stone-400">
                Creates a new multi-tenant restaurant with 2D floor map tables, QR tokens, and starter dishes.
              </p>
            </div>

            <div>
              <label className="block text-stone-400 font-semibold mb-1">
                Tenant Slug (restaurant_id)
              </label>
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full bg-[#F4F6F4] rounded-xl px-4 py-2.5 font-mono font-bold text-[#1E201F]"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-semibold mb-1">
                Restaurant Display Name
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#F4F6F4] rounded-xl px-4 py-2.5 font-semibold text-[#1E201F]"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-semibold mb-1">Tagline</label>
              <input
                type="text"
                value={newTagline}
                onChange={(e) => setNewTagline(e.target.value)}
                className="w-full bg-[#F4F6F4] rounded-xl px-4 py-2.5 font-semibold text-[#1E201F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Billing Model
                </label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value as any)}
                  className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2.5 font-semibold text-[#1E201F]"
                >
                  <option value="profit_share">Profit-Share (Hidden Markup)</option>
                  <option value="one_time_amc">One-Time + AMC</option>
                </select>
              </div>
              <div>
                <label className="block text-stone-400 font-semibold mb-1">
                  Hidden Markup (bps)
                </label>
                <input
                  type="number"
                  value={newMarkupBps}
                  onChange={(e) => setNewMarkupBps(Number(e.target.value))}
                  className="w-full bg-[#F4F6F4] rounded-xl px-3 py-2.5 font-semibold text-[#1E201F]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createBusy}
              className="w-full py-3.5 rounded-xl bg-[#222423] text-[#9FE870] font-bold transition"
            >
              {createBusy ? "Onboarding..." : "Create Tenant Live"}
            </button>
          </form>
        )}
      </div>
    </InternalPortalLayout>
  );
};
