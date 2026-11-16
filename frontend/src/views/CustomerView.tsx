import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import {
  Bell,
  Box,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  Flame,
  Gift,
  Info,
  MapPin,
  MessageCircle,
  Mic,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Utensils,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import "@google/model-viewer";
import { apiFetch } from "@/lib/api";
import { formatPaise } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          exposure?: string;
        },
        HTMLElement
      >;
    }
  }
}

const OCCASIONS = [
  { id: "family", label: "Family Feast", emoji: "👨‍👩‍👧‍👦" },
  { id: "birthday", label: "Birthday Celebration", emoji: "🎂" },
  { id: "anniversary", label: "Anniversary Date", emoji: "🥂" },
  { id: "rainy", label: "Chai & Comfort", emoji: "🌧️" },
  { id: "quick_lunch", label: "Express Lunch", emoji: "⚡" },
];

const WHEEL_PRIZES = [
  "Complimentary Masala Papad",
  "Free Kulhad Masala Chai on Next Visit",
  "Chef Special Mint Dip Upgrade",
  "Priority Express Tandoor Prep",
  "Complimentary Hot Gulab Jamun (Next Visit)",
];

export const CustomerView: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    customerMode,
    selectedTableNumber,
    activeSession,
    selectedOccasion,
    cart,
    setSelectedTableNumber,
    setActiveSession,
    setSelectedOccasion,
    addToCart,
    updateCartQty,
    updateCartNotes,
    clearCart,
  } = useAppStore();

  // Entry & Verification state
  const [entryStep, setEntryStep] = useState<"wake" | "auth" | "menu">("wake");
  const [phoneInput, setPhoneInput] = useState("9876543210");
  const [guestNameInput, setGuestNameInput] = useState("Aarav Sharma");
  const [guestCountInput, setGuestCountInput] = useState(2);
  const [dpdpChecked, setDpdpChecked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("1234");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Modals & UI state
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [facilitiesModalOpen, setFacilitiesModalOpen] = useState(false);
  const [active3DItem, setActive3DItem] = useState<any | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // AI Voice/Text Parser state
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  // Gamification & Checkout state
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [serviceToast, setServiceToast] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [whatsappReceipt, setWhatsappReceipt] = useState<any | null>(null);

  // Fetch Restaurant Info
  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  // Fetch Tables to get qr_token & active session
  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  const currentTable = tables.find((t) => t.table_number === selectedTableNumber) || tables[0];
  const currentQrToken = currentTable?.qr_token || `${activeRestaurantId}-table-${selectedTableNumber}-token`;

  // Sync activeSession if table already has one
  useEffect(() => {
    if (currentTable?.session && !activeSession) {
      setActiveSession({
        ...currentTable.session,
        restaurant_id: activeRestaurantId,
        table_id: currentTable.table_id,
        table_number: currentTable.table_number,
        qr_token: currentTable.qr_token,
      });
      setEntryStep("menu");
    }
  }, [currentTable, activeRestaurantId]);

  // Reset to wake screen when switching tenant
  useEffect(() => {
    setEntryStep("wake");
    setWhatsappReceipt(null);
  }, [activeRestaurantId]);

  // Fetch Menu with server-side computed prices
  const { data: menuData } = useQuery<any>({
    queryKey: ["menu", activeRestaurantId, currentQrToken],
    queryFn: () =>
      apiFetch(`/api/menu/${activeRestaurantId}?qr_token=${encodeURIComponent(currentQrToken)}`),
    enabled: !!currentQrToken,
  });

  const menuItems: any[] = menuData?.items || [];
  const categories = ["All", ...Array.from(new Set(menuItems.map((i) => i.category)))];
  const filteredMenu =
    selectedCategory === "All"
      ? menuItems
      : menuItems.filter((i) => i.category === selectedCategory);

  // Fetch Server-Side Order Preview for Cart
  const { data: cartPreview } = useQuery<any>({
    queryKey: [
      "order-preview",
      activeRestaurantId,
      activeSession?.session_id,
      cart,
      activeSession?.is_phone_verified,
    ],
    queryFn: () =>
      apiFetch("/api/orders/preview", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          session_id: activeSession?.session_id || null,
          qr_token: currentQrToken,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            qty: c.qty,
            notes: c.notes,
          })),
        }),
      }),
    enabled: cart.length > 0,
  });

  // Fetch Active Orders for this Session
  const { data: sessionOrders = [] } = useQuery<any[]>({
    queryKey: ["session-orders", activeRestaurantId, activeSession?.session_id],
    queryFn: () =>
      apiFetch(
        `/api/orders/${activeRestaurantId}?active_only=true&session_id=${activeSession?.session_id}`
      ),
    enabled: !!activeSession?.session_id,
    refetchInterval: 3000,
  });

  const activeOrder = sessionOrders[0] || null;

  // Fetch AI Occasion Upsells
  const { data: upsellData } = useQuery<any>({
    queryKey: [
      "ai-upsell",
      activeRestaurantId,
      selectedOccasion,
      cart.map((c) => c.menu_item_id).join(","),
    ],
    queryFn: () =>
      apiFetch("/api/ai/upsell", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          occasion: selectedOccasion,
          cart_item_ids: cart.map((c) => c.menu_item_id),
        }),
      }),
    enabled: entryStep === "menu" && menuItems.length > 0,
  });

  // Step 1: Wake Tap ("Hey") -> Starts Table Session & Alerts Manager Floor Map
  const handleWakeTable = async () => {
    setAuthError(null);
    try {
      const sess = await apiFetch("/api/sessions/start", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          table_number: selectedTableNumber,
          qr_token: currentQrToken,
          guest_count: guestCountInput,
          source: customerMode === "qr" ? "qr" : "tablet",
          occasion: selectedOccasion,
        }),
      });
      setActiveSession(sess);
      setEntryStep("auth");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Step 2A: Verify Mobile + DPDP Consent + OTP -> Unlocks 5% Off
  const handleVerifyPhone = async () => {
    if (!activeSession) return;
    setAuthError(null);
    if (!dpdpChecked) {
      setAuthError(
        "Please check the DPDP Act 2023 consent box to verify your mobile number and unlock the 5% discount."
      );
      return;
    }
    setAuthBusy(true);
    try {
      const verified = await apiFetch(`/api/sessions/${activeSession.session_id}/verify-phone`, {
        method: "POST",
        body: JSON.stringify({
          qr_token: currentQrToken,
          phone: phoneInput,
          name: guestNameInput,
          otp: otpInput,
          dpdp_consent: dpdpChecked,
          occasion: selectedOccasion,
        }),
      });
      setActiveSession({
        ...activeSession,
        is_phone_verified: verified.is_phone_verified,
        dpdp_consent: verified.dpdp_consent,
        customer_phone: verified.customer_phone,
        customer_name: verified.customer_name,
      });
      setEntryStep("menu");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // Step 2B: Continue as Guest (Bottom-Left)
  const handleContinueAsGuest = () => {
    setEntryStep("menu");
  };

  // AI Voice / Text Order Parsing
  const handleAiOrderParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiInput.trim()) return;
    setAiBusy(true);
    setAiFeedback(null);
    try {
      const res = await apiFetch("/api/ai/parse-order", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          text: aiInput,
        }),
      });
      if (res.parsed_items?.length > 0) {
        for (const item of res.parsed_items) {
          addToCart({
            menu_item_id: item.menu_item_id,
            name: item.name,
            qty: item.qty,
            display_unit_paise: item.display_unit_paise,
            notes: item.notes || "",
            image_url: item.image_url,
          });
        }
        setAiFeedback(`✅ ${res.summary_message} (${res.source === "claude_api" ? res.model : "Smart Hinglish Parser"})`);
        setAiInput("");
      } else {
        setAiFeedback(res.summary_message || "Could not match dishes. Try '2 Paneer Butter Masala aur 4 Butter Naan'.");
      }
    } catch (err: any) {
      setAiFeedback(`Error: ${err.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const handleVoiceMic = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setAiInput("Bhaiya 2 Handi Paneer Butter Masala aur 4 Garlic Butter Tandoori Naan lagao, kam teekha");
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = "en-IN";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(transcript);
    };
    recognition.start();
  };

  // Place Order to Kitchen
  const handlePlaceOrder = async () => {
    if (!activeSession || cart.length === 0) return;
    try {
      await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          session_id: activeSession.session_id,
          qr_token: currentQrToken,
          occasion: selectedOccasion,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            qty: c.qty,
            notes: c.notes,
          })),
        }),
      });
      clearCart();
      setCartDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(`Order failed: ${err.message}`);
    }
  };

  // 1-Tap Quick Repeat Item
  const handleRepeatItem = async (menuItemId: string, dishName: string) => {
    if (!activeOrder) return;
    try {
      await apiFetch(`/api/orders/${activeOrder.id}/repeat-item`, {
        method: "POST",
        body: JSON.stringify({
          qr_token: currentQrToken,
          menu_item_id: menuItemId,
          qty: 1,
        }),
      });
      setServiceToast(`Repeated +1 ${dishName} — sent directly to Kitchen KDS!`);
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
      setTimeout(() => setServiceToast(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 1-Tap Table Essentials (Water, Tissues, Cutlery, Chutney, Clean Table)
  const handleServiceRequest = async (
    reqType: "water" | "tissues" | "cutlery" | "chutney" | "clean_table" | "call_waiter",
    label: string
  ) => {
    if (!activeSession) return;
    try {
      await apiFetch("/api/service-requests", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          session_id: activeSession.session_id,
          qr_token: currentQrToken,
          request_type: reqType,
        }),
      });
      setServiceToast(`Requested: ${label} — Runner notified for Table #${selectedTableNumber}!`);
      setTimeout(() => setServiceToast(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Spin the Wheel Waiting Game
  const handleSpinWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setTimeout(() => {
      const prize = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)];
      setWonPrize(prize);
      setWheelSpinning(false);
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.65 },
      });
    }, 1200);
  };

  // Pay & Close Session -> Table returns to Red (Empty) & WhatsApp Bill Generated
  const handlePayOrder = async (method: "upi" | "card" | "cash") => {
    if (!activeOrder) return;
    setPaymentBusy(true);
    try {
      const res = await apiFetch(`/api/orders/${activeOrder.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          qr_token: currentQrToken,
          payment_method: method,
        }),
      });
      setWhatsappReceipt(res);
      setActiveSession(null);
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
    } catch (err: any) {
      alert(`Payment error: ${err.message}`);
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <div
      className={`mx-auto transition-all py-4 px-3 ${
        customerMode === "qr" ? "max-w-md" : "max-w-6xl"
      }`}
    >
      {/* Top Hardware / Table Context Strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Active Table:</span>
          <select
            value={selectedTableNumber}
            onChange={(e) => {
              setSelectedTableNumber(Number(e.target.value));
              setEntryStep("wake");
            }}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-orange-400 font-semibold"
          >
            {tables.map((t: any) => (
              <option key={t.table_number} value={t.table_number}>
                Table #{t.table_number} ({t.zone}) — {t.status.toUpperCase()}
              </option>
            ))}
          </select>
          <span className="text-slate-500 hidden sm:inline">
            QR Token: <code className="text-slate-300">{currentQrToken}</code>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeSession && (
            <span
              className={`px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                activeSession.is_phone_verified
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {activeSession.is_phone_verified
                ? `✓ 5% Off Active (${activeSession.customer_phone})`
                : "Guest Diner Mode"}
            </span>
          )}
          <button
            onClick={() => setFacilitiesModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-medium"
          >
            <Compass className="w-3.5 h-3.5 text-orange-400" />
            About & Washroom Map
          </button>
        </div>
      </div>

      {/* Main Frame (Tablet Bezel or Mobile QR Frame) */}
      <div
        className={`relative rounded-3xl overflow-hidden border-4 shadow-2xl bg-slate-900 ${
          customerMode === "tablet"
            ? "border-slate-700 min-h-[680px]"
            : "border-slate-800 min-h-[740px]"
        }`}
      >
        {/* STEP 1: WAKE SCREEN ("Say Hey or Tap Hey") */}
        {entryStep === "wake" && !whatsappReceipt && (
          <div className="flex flex-col items-center justify-center text-center p-8 min-h-[640px] bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/40">
            <img
              src={restaurant?.theme?.logo_url || "/images/logos/shree-ram-dhaba.svg"}
              alt={restaurant?.name}
              className="h-20 mb-5 rounded-2xl shadow-lg"
            />
            <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold mb-3">
              {customerMode === "tablet"
                ? `Smart Table Tablet • Table #${selectedTableNumber}`
                : `Mobile QR Ordering • Table #${selectedTableNumber}`}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
              {restaurant?.name || "Shree Ram Dhaba"}
            </h1>
            <p className="text-slate-300 max-w-lg text-sm mb-6">{restaurant?.tagline}</p>

            {/* Party Size Selector */}
            <div className="flex items-center gap-2 mb-6 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl">
              <span className="text-xs text-slate-400">Number of Guests at Table:</span>
              {[1, 2, 3, 4, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setGuestCountInput(n)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                    guestCountInput === n
                      ? "bg-orange-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Interactive "Hey" Pulse Button */}
            <button
              onClick={handleWakeTable}
              className="group relative flex flex-col items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-2xl shadow-orange-600/40 hover:scale-105 active:scale-95 transition-all"
            >
              <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-20" />
              <Volume2 className="w-10 h-10 mb-1.5" />
              <span className="text-xl font-black tracking-wide">TAP "HEY"</span>
              <span className="text-[11px] text-orange-100 mt-0.5">or Say "Hey" to Start</span>
            </button>

            {authError && (
              <p className="mt-4 text-xs text-rose-400 bg-rose-950/60 px-3 py-1.5 rounded-lg">
                {authError}
              </p>
            )}
          </div>
        )}

        {/* STEP 2: MOBILE + DPDP CONSENT (5% OFF) OR BOTTOM-LEFT GUEST LOGIN */}
        {entryStep === "auth" && !whatsappReceipt && (
          <div className="relative flex flex-col justify-between p-6 sm:p-10 min-h-[640px] bg-gradient-to-b from-slate-950 to-slate-900">
            <div className="max-w-md mx-auto w-full my-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-3">
                <Gift className="w-3.5 h-3.5" />
                Instant 5% OFF Total Bill
              </div>

              <h2 className="text-2xl font-bold text-white mb-1">
                Verify WhatsApp Number & Save 5%
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Get an instant 5% discount on your entire order, auto WhatsApp digital bill, and special occasion rewards.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Your Name</label>
                  <input
                    type="text"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    10-Digit Mobile / WhatsApp Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      maxLength={10}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="9876543210"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setOtpSent(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-orange-300 border border-slate-700"
                    >
                      {otpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    Enter OTP <span className="text-slate-500">(Demo Mode OTP: 1234)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white tracking-widest font-mono"
                  />
                </div>

                {/* Mandatory DPDP Act 2023 Consent Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={dpdpChecked}
                    onChange={(e) => setDpdpChecked(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="leading-relaxed">
                    <strong className="text-white">DPDP Act Consent:</strong> I consent to{" "}
                    {restaurant?.name || "the restaurant"} collecting my mobile number to send my
                    digital WhatsApp bill, apply the 5% loyalty discount, and share occasional offers.
                  </span>
                </label>

                {authError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300">
                    {authError}
                  </div>
                )}

                <button
                  disabled={authBusy}
                  onClick={handleVerifyPhone}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {authBusy ? "Verifying..." : "Verify & Unlock 5% Discount"}
                </button>
              </div>
            </div>

            {/* Bottom-Left Login as Guest Button (as specified by user) */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleContinueAsGuest}
                className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
              >
                Login as Guest (Skip 5% Discount) →
              </button>
              <span className="text-[11px] text-slate-500">
                Table #{selectedTableNumber} • Manager notified of seating
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: INTERACTIVE MENU, AI CONCIERGE, ACTIVE ORDER & GAMES */}
        {entryStep === "menu" && !whatsappReceipt && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Restaurant Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
              <div className="flex items-center gap-3.5">
                <img
                  src={restaurant?.theme?.logo_url || "/images/logos/shree-ram-dhaba.svg"}
                  alt={restaurant?.name}
                  className="h-14 w-auto rounded-xl"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{restaurant?.name}</h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Table #{selectedTableNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xl">{restaurant?.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFacilitiesModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-orange-300 border border-slate-700 flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Restroom & Facility Guide
                </button>
                <button
                  onClick={() => setCartDrawerOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Cart ({cart.reduce((s, i) => s + i.qty, 0)})
                </button>
              </div>
            </div>

            {/* Active Order Live Tracker + 1-Tap Repeat & Essentials Dock */}
            {activeOrder && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold uppercase">
                      Order Status: {activeOrder.status}
                    </span>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      Est. Prep Time: {activeOrder.effective_prep_minutes} mins
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 mr-2">Current Bill Total:</span>
                    <span className="text-lg font-extrabold text-emerald-400">
                      {formatPaise(activeOrder.total_paise)}
                    </span>
                  </div>
                </div>

                {/* 1-Tap Repeat Previously Ordered Dishes */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                    1-Tap Instant Repeat (Straight to Kitchen):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeOrder.items.map((item: any, idx: number) => (
                      <button
                        key={`${item.menu_item_id}-${idx}`}
                        onClick={() => handleRepeatItem(item.menu_item_id, item.name)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-orange-600 text-xs text-white font-medium border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        +1 {item.name.replace(" (3D View)", "")} ({formatPaise(item.display_unit_paise)})
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1-Tap Table Necessities Bar */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      Table Essentials (Free):
                    </span>
                    {[
                      { id: "water", label: "💧 RO Water" },
                      { id: "chutney", label: "🌿 Mint Chutney & Onion" },
                      { id: "tissues", label: "🧻 Tissues" },
                      { id: "cutlery", label: "🍴 Extra Cutlery" },
                      { id: "clean_table", label: "✨ Clean Table" },
                    ].map((req) => (
                      <button
                        key={req.id}
                        onClick={() => handleServiceRequest(req.id as any, req.label)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs transition"
                      >
                        {req.label}
                      </button>
                    ))}
                  </div>

                  {/* In-Table Payment Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={paymentBusy}
                      onClick={() => handlePayOrder("upi")}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {paymentBusy ? "Processing..." : `Pay ${formatPaise(activeOrder.total_paise)} (UPI / Card)`}
                    </button>
                  </div>
                </div>

                {/* Gamified Waiting Experience while Food Prepares */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Gamified Waiting Lounge — Spin & Win While Your Food Cooks!
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {wonPrize
                        ? `🎉 You Unlocked: ${wonPrize}! (Added to your table perks)`
                        : "Spin the Dhaba Chakra to unlock a complimentary table perk while the chef prepares your order."}
                    </p>
                  </div>
                  <button
                    onClick={handleSpinWheel}
                    disabled={wheelSpinning}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-extrabold text-xs shadow hover:opacity-95 transition"
                  >
                    {wheelSpinning ? "Spinning Chakra..." : wonPrize ? "Spin Again 🎡" : "Spin Reward Wheel 🎡"}
                  </button>
                </div>
              </div>
            )}

            {serviceToast && (
              <div className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-between">
                <span>{serviceToast}</span>
                <button onClick={() => setServiceToast(null)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* AI Multilingual (Hindi / Hinglish / English) Voice & Text Order Bar */}
            <form
              onSubmit={handleAiOrderParse}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-orange-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Order Concierge (Hindi, Hinglish & English)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAiInput(
                      activeRestaurantId === "shree-ram-dhaba"
                        ? "Bhaiya 2 Handi Paneer Butter Masala aur 4 Garlic Butter Tandoori Naan lagao, kam teekha"
                        : "2 Truffle Burrata Sourdough Pizza and 2 Smoked Hazelnut Cortado"
                    )
                  }
                  className="text-[11px] text-slate-400 hover:text-orange-300 underline"
                >
                  Try Sample Hinglish Command
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVoiceMic}
                  className={`p-2.5 rounded-xl border transition ${
                    listening
                      ? "bg-rose-600 border-rose-400 text-white animate-pulse"
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                  title="Speak Order in Hindi / Hinglish / English"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Say or type e.g. '2 paneer butter masala aur 4 butter naan lagao, kam teekha'..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={aiBusy}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {aiBusy ? "Parsing..." : "Add via AI"}
                </button>
              </div>

              {aiFeedback && <p className="text-xs text-emerald-400 pt-1">{aiFeedback}</p>}
            </form>

            {/* Occasion Selector + AI Contextual Upsell Strip */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">Occasion:</span>
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition flex items-center gap-1 ${
                      selectedOccasion === occ.id
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span>{occ.emoji}</span>
                    <span>{occ.label}</span>
                  </button>
                ))}
              </div>

              {upsellData?.suggestions?.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                  <div className="text-xs font-bold text-amber-300 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Recommended for{" "}
                      {OCCASIONS.find((o) => o.id === selectedOccasion)?.label || "Your Table"}
                    </span>
                    <span className="text-[10px] text-amber-200/70">
                      Powered by {upsellData.model}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {upsellData.suggestions.map((sug: any) => (
                      <div
                        key={sug.menu_item_id}
                        className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {sug.name.replace(" (3D View)", "")}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">{sug.reason}</div>
                          <div className="text-xs font-bold text-amber-400 mt-0.5">
                            {formatPaise(sug.display_price_paise)}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            addToCart({
                              menu_item_id: sug.menu_item_id,
                              name: sug.name,
                              display_unit_paise: sug.display_price_paise,
                              notes: "",
                              image_url: sug.image_url,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-orange-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid with 3D Live Preview & Detailed Ingredients */}
            <div
              className={`grid gap-4 ${
                customerMode === "qr" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {filteredMenu.map((item: any) => {
                const inCart = cart.find((c) => c.menu_item_id === item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition group"
                  >
                    <div>
                      <div className="relative h-40 bg-slate-900 overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950/85 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                            ● VEG
                          </span>
                          {item.is_bestseller && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                              ★ BESTSELLER
                            </span>
                          )}
                        </div>
                        {item.model_3d_url && (
                          <button
                            onClick={() => setActive3DItem(item)}
                            className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-indigo-600/95 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-lg"
                          >
                            <Box className="w-3.5 h-3.5" />
                            View in 3D
                          </button>
                        )}
                      </div>

                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-white text-sm">{item.name}</h3>
                          <span className="text-base font-extrabold text-orange-400 shrink-0">
                            {formatPaise(item.display_price_paise)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>

                        {/* Ingredients Tags */}
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {item.ingredients?.map((ing: string) => (
                            <span
                              key={ing}
                              className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] border border-slate-800"
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {item.prep_time_minutes} mins • {item.calories} kcal
                      </span>

                      {inCart ? (
                        <div className="flex items-center gap-2 bg-orange-600/20 border border-orange-500/40 rounded-xl px-2 py-1">
                          <button
                            onClick={() => updateCartQty(item.id, inCart.qty - 1)}
                            className="w-6 h-6 rounded bg-slate-900 text-white font-bold"
                          >
                            -
                          </button>
                          <span className="font-bold text-orange-300">{inCart.qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, inCart.qty + 1)}
                            className="w-6 h-6 rounded bg-orange-600 text-white font-bold"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            addToCart({
                              menu_item_id: item.id,
                              name: item.name,
                              display_unit_paise: item.display_price_paise,
                              notes: "",
                              image_url: item.image_url,
                            })
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition"
                        >
                          + Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: WHATSAPP DIGITAL BILL & SESSION COMPLETE SCREEN */}
        {whatsappReceipt && (
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[640px] bg-gradient-to-b from-slate-950 to-emerald-950/30">
            <div className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Payment Completed & Table Session Closed
                </span>
                <span className="text-xs text-slate-400">
                  Table #{whatsappReceipt.order.table_number}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <MessageCircle className="w-4 h-4" />
                  Auto WhatsApp Digital Bill Dispatched
                </div>
                <p className="text-xs text-slate-300">
                  Sent to:{" "}
                  <strong className="text-white">
                    {whatsappReceipt.whatsapp_invoice.customer_phone}
                  </strong>
                </p>
              </div>

              {/* Itemized Server-Computed Receipt */}
              <div className="space-y-2 text-xs border-t border-b border-slate-800 py-3">
                {whatsappReceipt.order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-slate-300">
                    <span>
                      {item.qty} x {item.name.replace(" (3D View)", "")}
                    </span>
                    <span className="font-semibold text-white">
                      {formatPaise(item.line_display_total_paise)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Items Subtotal</span>
                  <span>{formatPaise(whatsappReceipt.order.subtotal_paise)}</span>
                </div>
                {whatsappReceipt.order.discount_paise > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>5% Verified Mobile Discount</span>
                    <span>-{formatPaise(whatsappReceipt.order.discount_paise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST (Computed on Subtotal - Discount)</span>
                  <span>{formatPaise(whatsappReceipt.order.tax_paise)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                  <span>Total Paid</span>
                  <span className="text-emerald-400">
                    {formatPaise(whatsappReceipt.order.total_paise)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setWhatsappReceipt(null);
                  setEntryStep("wake");
                }}
                className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition"
              >
                Start New Guest Session on Table #{selectedTableNumber}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: 3D Live Dish Viewer (<model-viewer> with local .glb) */}
      {active3DItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                  Interactive 3D glTF (.glb) Preview
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{active3DItem.name}</h3>
              </div>
              <button
                onClick={() => setActive3DItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-72 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
              <model-viewer
                src={active3DItem.model_3d_url}
                alt={active3DItem.name}
                auto-rotate
                camera-controls
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <p className="text-xs text-slate-300">{active3DItem.description}</p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-lg font-extrabold text-orange-400">
                {formatPaise(active3DItem.display_price_paise)}
              </span>
              <button
                onClick={() => {
                  addToCart({
                    menu_item_id: active3DItem.id,
                    name: active3DItem.name,
                    display_unit_paise: active3DItem.display_price_paise,
                    notes: "",
                    image_url: active3DItem.image_url,
                  });
                  setActive3DItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                + Add to Table Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Restaurant Brief, Hygiene & Washroom / Facility Locator */}
      {facilitiesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-orange-400" />
                {restaurant?.name} — Brief & Washroom Guide
              </h3>
              <button
                onClick={() => setFacilitiesModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{restaurant?.description}</p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-orange-300 mb-0.5">🚻 Washroom / Restroom Directions</div>
                <div className="text-slate-300">
                  {restaurant?.facilities_info?.restroom_directions}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-emerald-300 mb-0.5">🧼 Handwash & Hygiene Station</div>
                <div className="text-slate-300">
                  {restaurant?.facilities_info?.handwash_station}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-indigo-300 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5" /> Guest Wi-Fi
                  </div>
                  <div className="text-slate-300">{restaurant?.facilities_info?.wifi_ssid}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-300">🚗 Parking</div>
                  <div className="text-slate-300">{restaurant?.facilities_info?.parking_info}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cart & Server-Side Pricing Breakdown Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-slate-900 border-l border-slate-800 h-full max-w-md w-full p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-orange-400" />
                  Table #{selectedTableNumber} Cart
                </h3>
                <button
                  onClick={() => setCartDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center">
                  Your table cart is empty. Add dishes from the menu or use the AI Concierge bar!
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((c) => (
                    <div
                      key={c.menu_item_id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{c.name}</span>
                        <span className="text-xs font-bold text-orange-400">
                          {formatPaise(c.display_unit_paise * c.qty)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={c.notes}
                          onChange={(e) => updateCartNotes(c.menu_item_id, e.target.value)}
                          placeholder="Chef note (e.g., less spicy, extra butter)..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty - 1)}
                            className="w-6 h-6 rounded bg-slate-800 text-white text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-white px-1">{c.qty}</span>
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty + 1)}
                            className="w-6 h-6 rounded bg-orange-600 text-white text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && cartPreview && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal (Server-Computed)</span>
                    <span>{formatPaise(cartPreview.subtotal_paise)}</span>
                  </div>
                  {cartPreview.discount_paise > 0 ? (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>5% Verified Phone Discount</span>
                      <span>-{formatPaise(cartPreview.discount_paise)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-amber-300 text-[11px]">
                      <span>Verify Phone + DPDP to unlock 5% Off</span>
                      <button
                        onClick={() => {
                          setCartDrawerOpen(false);
                          setEntryStep("auth");
                        }}
                        className="underline font-semibold"
                      >
                        Verify Now
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>GST ({(cartPreview.gst_bps / 100).toFixed(0)}% on Subtotal - Discount)</span>
                    <span>{formatPaise(cartPreview.tax_paise)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Payable Total</span>
                    <span className="text-orange-400">{formatPaise(cartPreview.total_paise)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg"
                >
                  Send Order to Kitchen KDS →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
