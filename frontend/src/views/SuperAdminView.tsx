import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Crown,
  Palette,
  Percent,
  Plus,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { applyTenantThemeVars, formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export const SuperAdminView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeRestaurantId, setActiveRestaurantId } = useAppStore();

  const { data: overview } = useQuery<any>({
    queryKey: ["super-admin-overview"],
    queryFn: () => apiFetch("/api/super-admin/overview"),
    refetchInterval: 4000,
  });

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  // Config Editor State for Selected Tenant
  const [nameInput, setNameInput] = useState("");
  const [taglineInput, setTaglineInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c2410c");
  const [accentColor, setAccentColor] = useState("#d97706");
  const [bgColor, setBgColor] = useState("#fff7ed");
  const [billingModel, setBillingModel] = useState<"one_time_amc" | "profit_share">("profit_share");
  const [markupBps, setMarkupBps] = useState<number>(800);
  const [amberThreshold, setAmberThreshold] = useState<number>(60);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // New Tenant Onboarding Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("royal-haveli-restro");
  const [newName, setNewName] = useState("Royal Haveli Heritage Restro");
  const [newTagline, setNewTagline] = useState("Fine Rajasthani Thali & Courtyard Dining");
  const [newPrimary, setNewPrimary] = useState("#9333ea");
  const [newAccent, setNewAccent] = useState("#f59e0b");
  const [newModel, setNewModel] = useState<"one_time_amc" | "profit_share">("profit_share");
  const [newMarkupBps, setNewMarkupBps] = useState(1000);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setNameInput(restaurant.name || "");
      setTaglineInput(restaurant.tagline || "");
      setPrimaryColor(restaurant.theme?.primary_color || "#c2410c");
      setAccentColor(restaurant.theme?.accent_color || "#d97706");
      setBgColor(restaurant.theme?.bg_color || "#fff7ed");
      setBillingModel(restaurant.billing_model || "profit_share");
      setMarkupBps(restaurant.markup_bps ?? 800);
      setAmberThreshold(restaurant.amber_threshold_seconds ?? 60);
    }
  }, [restaurant]);

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
            logo_url: restaurant?.theme?.logo_url || "/images/logos/shree-ram-dhaba.svg",
          },
          billing_model: billingModel,
          markup_bps: billingModel === "profit_share" ? markupBps : 0,
          amber_threshold_seconds: amberThreshold,
        }),
      });
      applyTenantThemeVars(updated.theme);
      setSaveToast(
        `Saved ${updated.name} configuration! Server-side menu prices & CSS theme variables updated live.`
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
          bg_color: "#faf5ff",
          billing_model: newModel,
          markup_bps: newModel === "profit_share" ? newMarkupBps : 0,
          table_count: 6,
        }),
      });
      setCreateOpen(false);
      setActiveRestaurantId(created.restaurant_id);
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Super Admin Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
            <Crown className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">
              Super Admin Multi-Tenant & Monetization Command Center
            </h1>
            <p className="text-xs text-slate-300">
              Manage White-Label Restaurant Clients, Switch Between One-Time+AMC vs. Hidden Profit-Share Formula, and Audit Server-Side Paise Ledgers
            </p>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Onboard New White-Label Restaurant
        </button>
      </div>

      {/* Global Platform Revenue Metrics (Computed Server-Side in Integer Paise) */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Global Platform GMV Processed</div>
            <div className="text-2xl font-black text-white mt-1">
              {formatPaise(overview.total_gmv_paise)}
            </div>
            <div className="text-[11px] text-amber-300 mt-1">Includes sample + live orders</div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40">
            <div className="text-xs text-amber-300 font-semibold">
              Platform Hidden Profit-Share Earned
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {formatPaise(overview.total_platform_markup_paise)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Embedded invisibly in menu item prices
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
            <div className="text-xs text-emerald-300 font-semibold">
              One-Time License Fees Contracted
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {formatPaise(overview.total_one_time_fees_paise)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">From One-Time + AMC tenants</div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40">
            <div className="text-xs text-indigo-300 font-semibold">Annual AMC Recurring Fees</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              {formatPaise(overview.total_amc_fees_paise)}/yr
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active Tenants: {overview.tenants?.length || 2}
            </div>
          </div>
        </div>
      )}

      {/* Main Split: White-Label & Pricing Formula Configurator vs. Tenant Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: White-Label Branding & Dual Monetization Formula Editor */}
        <form
          onSubmit={handleSaveConfig}
          className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-400" />
                Editing Tenant: <span className="text-orange-400">{restaurant?.name}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Changes apply immediately to Customer Tablet/QR Menu, CSS Theme Variables, and Server-Side Pricing
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              ID: {activeRestaurantId}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Restaurant Brand Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Brand Tagline</label>
              <input
                type="text"
                value={taglineInput}
                onChange={(e) => setTaglineInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Dynamic CSS Theme Variables Editor */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-orange-400" />
              White-Label Brand Colors (Applied via CSS Custom Variables)
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">--brand-primary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">--brand-accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Idle Amber Threshold (sec)</label>
                <input
                  type="number"
                  min={15}
                  max={3600}
                  value={amberThreshold}
                  onChange={(e) => setAmberThreshold(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Dual Monetization Model Selector */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Monetization Model & Server-Side Pricing Formula
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setBillingModel("profit_share")}
                className={`p-3.5 rounded-xl border text-left transition ${
                  billingModel === "profit_share"
                    ? "bg-amber-500/15 border-amber-500 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-bold text-sm text-amber-300">
                  Option B: Profit-Sharing (Hidden Menu Markup)
                </div>
                <p className="text-[11px] mt-1">
                  Server embeds markup % directly into item display prices. Customer sees ₹0 platform fee on bill.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBillingModel("one_time_amc")}
                className={`p-3.5 rounded-xl border text-left transition ${
                  billingModel === "one_time_amc"
                    ? "bg-emerald-500/15 border-emerald-500 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-bold text-sm text-emerald-300">
                  Option A: One-Time Setup + Annual AMC
                </div>
                <p className="text-[11px] mt-1">
                  Fixed software license + AMC. Menu display prices equal 100% of restaurant base prices.
                </p>
              </button>
            </div>

            {billingModel === "profit_share" && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                    Hidden Platform Markup Basis Points:
                  </span>
                  <span className="font-extrabold text-amber-400 text-sm">
                    {markupBps} bps ({(markupBps / 100).toFixed(1)}% embedded in menu prices)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={100}
                  value={markupBps}
                  onChange={(e) => setMarkupBps(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="p-2.5 rounded-lg bg-slate-900 text-[11px] text-slate-300 flex items-center justify-between">
                  <span>Example: Base Dish ₹260 (26000 paise)</span>
                  <span className="font-bold text-amber-300">
                    Customer Menu Price:{" "}
                    {formatPaise(Math.round((26000 * (10000 + markupBps)) / 10000 / 100) * 100)} •
                    Visible Platform Fee: ₹0
                  </span>
                </div>
              </div>
            )}
          </div>

          {saveToast && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-xs text-emerald-200">
              {saveToast}
            </div>
          )}

          <button
            type="submit"
            disabled={saveBusy}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" />
            {saveBusy ? "Saving Server-Side Config..." : "Save Tenant Branding & Pricing Formula"}
          </button>
        </form>

        {/* Right Col: Onboarded Tenant Portfolio */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Active Restaurant Tenants
          </h3>
          <div className="space-y-3">
            {(overview?.tenants || []).map((t: any) => {
              const isSelected = t.restaurant_id === activeRestaurantId;
              return (
                <div
                  key={t.restaurant_id}
                  onClick={() => setActiveRestaurantId(t.restaurant_id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-2 ${
                    isSelected
                      ? "bg-slate-950 border-orange-500 ring-1 ring-orange-500/40"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{t.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        t.billing_model === "profit_share"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {t.billing_model === "profit_share"
                        ? `${(t.markup_bps / 100).toFixed(0)}% Profit-Share`
                        : "One-Time + AMC"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-900">
                    <div>
                      <div className="text-slate-500">Gross GMV</div>
                      <div className="font-bold text-white">{formatPaise(t.gross_gmv_paise)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Restro Net</div>
                      <div className="font-bold text-emerald-400">
                        {formatPaise(t.restaurant_net_paise)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Your Markup</div>
                      <div className="font-bold text-amber-400">
                        {formatPaise(t.platform_hidden_markup_paise)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Cross-Tenant Ledger Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">
              Global Server-Side Paise Ledger (Profit-Share Split vs. Restaurant Net)
            </h3>
            <p className="text-xs text-slate-400">
              Every paid order records exact base food value, embedded hidden platform markup, 5% discount, and GST on (Subtotal - Discount)
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            Sample data + Live Settlements
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Tenant</th>
                <th className="py-2.5 px-3">Table</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Base Menu Value</th>
                <th className="py-2.5 px-3">Display Subtotal</th>
                <th className="py-2.5 px-3">5% Discount</th>
                <th className="py-2.5 px-3">GST</th>
                <th className="py-2.5 px-3">Gross Bill</th>
                <th className="py-2.5 px-3">Platform Cut</th>
                <th className="py-2.5 px-3">Restaurant Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(overview?.recent_ledger || []).map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-950/60">
                  <td className="py-2.5 px-3 font-bold text-white">{e.restaurant_id}</td>
                  <td className="py-2.5 px-3">Table #{e.table_number}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {e.billing_model}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {formatPaise(e.subtotal_base_paise)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200">
                    {formatPaise(e.subtotal_display_paise)}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400">
                    -{formatPaise(e.customer_discount_paise)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{formatPaise(e.tax_paise)}</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {formatPaise(e.gross_bill_paise)}
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-amber-400">
                    +{formatPaise(e.platform_hidden_markup_paise)}
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-emerald-400">
                    {formatPaise(e.restaurant_net_paise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Onboard New White-Label Restaurant Tenant */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTenant}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 text-xs"
          >
            <h3 className="text-lg font-bold text-white">
              Onboard New White-Label Restaurant Client
            </h3>
            <div>
              <label className="block text-slate-300 mb-1">Tenant Slug (restaurant_id)</label>
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Restaurant Display Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Tagline</label>
              <input
                type="text"
                value={newTagline}
                onChange={(e) => setNewTagline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Billing Model</label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="profit_share">Profit-Share (Hidden Markup)</option>
                  <option value="one_time_amc">One-Time + AMC</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Hidden Markup (bps)</label>
                <input
                  type="number"
                  value={newMarkupBps}
                  onChange={(e) => setNewMarkupBps(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createBusy}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold"
              >
                {createBusy ? "Onboarding..." : "Create Tenant Live"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
