import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import {
  Bell,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Gift,
  HelpCircle,
  Home,
  LogOut,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  User,
  Utensils,
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
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "anniversary", label: "Anniversary", emoji: "🥂" },
  { id: "rainy", label: "Chai & Comfort", emoji: "🌧️" },
  { id: "quick_lunch", label: "Express Lunch", emoji: "⚡" },
];

const WHEEL_PRIZES = [
  "Complimentary Masala Papad",
  "Free Kulhad Chai on Next Visit",
  "Chef Special Mint Dip Upgrade",
  "Priority Express Tandoor Prep",
  "Complimentary Hot Gulab Jamun (Next Visit)",
];

type CustomerTab = "home" | "offers" | "order" | "cart" | "profile";

export const CustomerView: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRestaurantId,
    customerMode,
    selectedTableNumber,
    activeSession,
    selectedOccasion,
    cart,
    setCustomerMode,
    setSelectedTableNumber,
    setActiveSession,
    setSelectedOccasion,
    addToCart,
    updateCartQty,
    updateCartNotes,
    clearCart,
  } = useAppStore();

  // Entry Flow: "welcome" (Restaurant Name -> Hello -> Mobile Number / Guest) -> "app"
  const [entryStep, setEntryStep] = useState<"welcome" | "app">("welcome");
  const [activeTab, setActiveTab] = useState<CustomerTab>("home");

  // Welcome form state
  const [guestNameInput, setGuestNameInput] = useState("Sophia Williams");
  const [phoneInput, setPhoneInput] = useState("9876543210");
  const [guestCountInput, setGuestCountInput] = useState(2);
  const [dpdpChecked, setDpdpChecked] = useState(true);
  const [otpInput, setOtpInput] = useState("1234");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Search, Category & Modals
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [active3DItem, setActive3DItem] = useState<any | null>(null);
  const [facilitiesModalOpen, setFacilitiesModalOpen] = useState(false);
  const [essentialsModalOpen, setEssentialsModalOpen] = useState(false);

  // AI Voice / Text Concierge
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  // Gamification & Checkout
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [whatsappReceipt, setWhatsappReceipt] = useState<any | null>(null);

  // Fetch Restaurant Info
  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  // Fetch Tables
  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  const currentTable =
    tables.find((t) => t.table_number === selectedTableNumber) || tables[0];
  const currentQrToken =
    currentTable?.qr_token || `${activeRestaurantId}-table-${selectedTableNumber}-token`;

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
    }
  }, [currentTable, activeRestaurantId]);

  // Reset welcome when tenant changes
  useEffect(() => {
    setEntryStep("welcome");
    setActiveTab("home");
    setWhatsappReceipt(null);
  }, [activeRestaurantId]);

  // Fetch Menu with server-side computed prices
  const { data: menuData } = useQuery<any>({
    queryKey: ["menu", activeRestaurantId, currentQrToken],
    queryFn: () =>
      apiFetch(
        `/api/menu/${activeRestaurantId}?qr_token=${encodeURIComponent(currentQrToken)}`
      ),
    enabled: !!currentQrToken,
  });

  const menuItems: any[] = menuData?.items || [];

  // Build compact category list with circular dish icons
  const rawCategories = Array.from(new Set(menuItems.map((i) => i.category)));
  const categoryPills = [
    {
      id: "All",
      shortLabel: "All",
      image: menuItems[0]?.image_url || "/images/dishes/maharaja-thali.svg",
    },
    ...rawCategories.map((cat) => {
      const sampleItem = menuItems.find((i) => i.category === cat);
      const shortLabel = cat
        .replace("Signature ", "")
        .replace("Main Course ", "")
        .replace("Tandoori ", "")
        .replace("Woodfired Sourdough ", "")
        .split(" ")[0];
      return {
        id: cat,
        shortLabel,
        image: sampleItem?.image_url || "/images/dishes/paneer-butter-masala.svg",
      };
    }),
  ];

  const filteredMenu = menuItems.filter((item) => {
    const matchesCat =
      selectedCategory === "All" || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.name_hi && item.name_hi.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  // Server-Side Order Preview for Cart
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
    enabled: entryStep === "app" && menuItems.length > 0,
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Start Session + Verify Phone (1-Click Smooth Flow)
  const handleStartVerifiedSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!dpdpChecked) {
      setAuthError("Please check the DPDP consent box to unlock your 5% discount.");
      return;
    }
    setAuthBusy(true);
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

      const verified = await apiFetch(`/api/sessions/${sess.session_id}/verify-phone`, {
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
        ...sess,
        is_phone_verified: verified.is_phone_verified,
        dpdp_consent: verified.dpdp_consent,
        customer_phone: verified.customer_phone,
        customer_name: verified.customer_name,
      });
      setEntryStep("app");
      setActiveTab("home");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // Start Session as Guest (Bottom-Left Button)
  const handleContinueAsGuest = async () => {
    setAuthError(null);
    setAuthBusy(true);
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
      setEntryStep("app");
      setActiveTab("home");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // AI Multilingual Order Parse
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
        setAiFeedback(`Added ${res.parsed_items.length} dish(es) to your bag!`);
        showToast(`Added ${res.parsed_items.length} dish(es) via AI Concierge`);
        setAiInput("");
      } else {
        setAiFeedback(
          res.summary_message ||
            "Try saying '2 Paneer Butter Masala aur 4 Butter Naan'"
        );
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
      setAiInput(
        activeRestaurantId === "shree-ram-dhaba"
          ? "2 Handi Paneer Butter Masala aur 4 Garlic Butter Tandoori Naan, kam teekha"
          : "2 Truffle Burrata Sourdough Pizza and 2 Smoked Hazelnut Cortado"
      );
      setActiveTab("offers");
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = "en-IN";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(transcript);
      setActiveTab("offers");
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
      setActiveTab("order");
      showToast("Order sent to Kitchen! Track live prep time below.");
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(`Order failed: ${err.message}`);
    }
  };

  // 1-Tap Quick Repeat
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
      showToast(`Repeated +1 ${dishName.replace(" (3D View)", "")}`);
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 1-Tap Table Essentials
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
      setEssentialsModalOpen(false);
      showToast(`Requested: ${label} — Runner notified!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Spin the Wheel
  const handleSpinWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setTimeout(() => {
      const prize = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)];
      setWonPrize(prize);
      setWheelSpinning(false);
      confetti({ particleCount: 70, spread: 65, origin: { y: 0.65 } });
    }, 1000);
  };

  // Pay Order & Dispatch WhatsApp Receipt
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

  const totalCartItems = cart.reduce((s, i) => s + i.qty, 0);

  // ============================================================================
  // SCREEN 1: CLEAN RESTAURANT WELCOME -> "Hello!" -> MOBILE NUMBER / GUEST
  // ============================================================================
  if (entryStep === "welcome" && !whatsappReceipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F9EDE8] via-[#FAF8F6] to-[#F4F1EC] flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px] bg-[#FAF9F6] rounded-[44px] p-7 sm:p-9 shadow-[0_24px_70px_rgba(20,20,20,0.09)] border border-white relative overflow-hidden">
          {/* Top Status / Table Bar */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white shadow-xs border border-stone-200/70 flex items-center justify-center text-[#141414]">
                <Utensils className="w-4 h-4 text-[#FF6B4A]" />
              </div>
              <div>
                <div className="text-[10px] text-stone-400 font-medium leading-none">
                  Seated at
                </div>
                <select
                  value={selectedTableNumber}
                  onChange={(e) => setSelectedTableNumber(Number(e.target.value))}
                  className="text-xs font-extrabold text-[#141414] bg-transparent focus:outline-none cursor-pointer"
                >
                  {tables.map((t: any) => (
                    <option key={t.table_number} value={t.table_number}>
                      Table #{t.table_number} • {t.zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-white border border-stone-200/80 text-[11px] font-bold text-[#141414]">
              {customerMode === "qr" ? "QR App" : "Table WebApp"}
            </span>
          </div>

          {/* 1. Restaurant Brand & Name */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A] text-[11px] font-bold mb-2">
              <Sparkles className="w-3 h-3" />
              {restaurant?.name || "Shree Ram Dhaba"}
            </div>

            {/* 2. "Hello!" Editorial Greeting */}
            <h1 className="text-[34px] leading-[1.12] tracking-tight">
              <span className="font-extrabold text-[#141414]">Hello! </span>
              <span className="font-light text-stone-400">Order & Eat.</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
              {restaurant?.tagline || "Freshly prepared dishes served straight to your table."}
            </p>
          </div>

          {/* 3. Mobile Number & 5% Discount Form Card */}
          <form
            onSubmit={handleStartVerifiedSession}
            className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-stone-100 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#141414]">
                Enter Mobile for 5% Off
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px] font-bold">
                -5% TOTAL BILL
              </span>
            </div>

            {/* Party Size Pills */}
            <div>
              <label className="block text-[11px] text-stone-400 font-medium mb-1.5">
                Guests at Table
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setGuestCountInput(n)}
                    className={`py-2 rounded-2xl text-xs font-bold transition ${
                      guestCountInput === n
                        ? "bg-[#141414] text-white shadow-xs"
                        : "bg-[#F7F5F2] text-stone-500 hover:text-[#141414]"
                    }`}
                  >
                    {n} {n === 1 ? "Guest" : "Guests"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-stone-400 font-medium mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-[#F7F5F2] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-400 font-medium mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="9876543210"
                  className="w-full bg-[#F7F5F2] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-stone-400 font-medium mb-1">
                Verification OTP <span className="text-stone-400">(Demo: 1234)</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-full bg-[#F7F5F2] rounded-2xl px-3.5 py-2 text-xs font-bold tracking-widest text-[#141414] focus:outline-none"
              />
            </div>

            {/* DPDP Consent Checkbox */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={dpdpChecked}
                onChange={(e) => setDpdpChecked(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-[#FF6B4A] focus:ring-[#FF6B4A]"
              />
              <span className="text-[11px] text-stone-500 leading-snug">
                I consent under the <strong className="text-[#141414]">DPDP Act</strong> to
                receive my WhatsApp digital bill, 5% instant discount, and table offers.
              </span>
            </label>

            {authError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-3.5 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>{authBusy ? "Starting Session..." : "Verify & Unlock 5% Off"}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          {/* 4. Bottom-Left Login as Guest */}
          <div className="mt-5 flex items-center justify-between px-1">
            <button
              type="button"
              disabled={authBusy}
              onClick={handleContinueAsGuest}
              className="text-xs font-bold text-stone-500 hover:text-[#141414] transition flex items-center gap-1"
            >
              <span>Login as Guest</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setFacilitiesModalOpen(true)}
              className="text-[11px] font-semibold text-[#FF6B4A] hover:underline"
            >
              Restaurant Brief & Washrooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SCREEN 2: WHATSAPP RECEIPT & PAYMENT COMPLETE
  // ============================================================================
  if (whatsappReceipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F9EDE8] via-[#FAF8F6] to-[#F4F1EC] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-white rounded-[40px] p-7 shadow-[0_24px_70px_rgba(20,20,20,0.08)] space-y-5">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="text-center">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              Payment Successful • Session Closed
            </span>
            <h2 className="text-2xl font-extrabold text-[#141414] mt-2">
              Thank You for Dining!
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              WhatsApp receipt sent to{" "}
              <strong className="text-[#141414]">
                {whatsappReceipt.whatsapp_invoice.customer_phone}
              </strong>
            </p>
          </div>

          <div className="bg-[#FAF8F6] rounded-3xl p-4 space-y-2.5 text-xs">
            {whatsappReceipt.order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-stone-600">
                <span>
                  {item.qty}x {item.name.replace(" (3D View)", "")}
                </span>
                <span className="font-bold text-[#141414]">
                  {formatPaise(item.line_display_total_paise)}
                </span>
              </div>
            ))}
            <div className="border-t border-stone-200/80 pt-2 space-y-1">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal</span>
                <span>{formatPaise(whatsappReceipt.order.subtotal_paise)}</span>
              </div>
              {whatsappReceipt.order.discount_paise > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>5% Verified Discount</span>
                  <span>-{formatPaise(whatsappReceipt.order.discount_paise)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-400">
                <span>GST (on Subtotal - Discount)</span>
                <span>{formatPaise(whatsappReceipt.order.tax_paise)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#141414] pt-1.5 border-t border-stone-200/80">
                <span>Total Paid</span>
                <span>{formatPaise(whatsappReceipt.order.total_paise)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setWhatsappReceipt(null);
              setEntryStep("welcome");
            }}
            className="w-full py-3.5 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs transition"
          >
            Start New Table Session
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SCREEN 3: ORBIX STUDIO 2025 CONSUMER APP (MOBILE APP & LAPTOP WEBAPP)
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F9EDE8]/60 via-[#FAF8F6] to-[#F4F1EC] pb-28">
      {/* Desktop WebApp / Mobile App View Switcher Header (Only visible on larger screens) */}
      <div className="hidden md:flex max-w-6xl mx-auto pt-4 px-6 items-center justify-between text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[#141414]">{restaurant?.name}</span>
          <span>•</span>
          <span>Table #{selectedTableNumber}</span>
          {activeSession?.is_phone_verified && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              5% VIP Discount Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white rounded-full p-1 border border-stone-200/80 shadow-2xs">
          <button
            onClick={() => setCustomerMode("tablet")}
            className={`px-3 py-1 rounded-full font-bold transition ${
              customerMode === "tablet"
                ? "bg-[#141414] text-white"
                : "text-stone-500 hover:text-[#141414]"
            }`}
          >
            Laptop / Tablet WebApp
          </button>
          <button
            onClick={() => setCustomerMode("qr")}
            className={`px-3 py-1 rounded-full font-bold flex items-center gap-1 transition ${
              customerMode === "qr"
                ? "bg-[#141414] text-white"
                : "text-stone-500 hover:text-[#141414]"
            }`}
          >
            <Smartphone className="w-3 h-3" />
            Mobile Phone Frame
          </button>
        </div>
      </div>

      {/* Main Container: Mobile App Frame (420px) on Mobile/QR mode OR Full WebApp (1120px) on Laptop mode */}
      <div
        className={`mx-auto transition-all ${
          customerMode === "qr"
            ? "max-w-[420px] md:my-4 bg-[#FAF9F6] md:rounded-[48px] md:shadow-[0_28px_80px_rgba(20,20,20,0.10)] md:border-[6px] md:border-white min-h-[820px] relative overflow-hidden"
            : "max-w-6xl px-4 sm:px-6 pt-3"
        }`}
      >
        {/* TOP HEADER (Matches Orbix Studio Reference Right Screen) */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFacilitiesModalOpen(true)}
              className="w-11 h-11 rounded-full bg-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] hover:border-[#141414] transition"
              title="Restaurant Info & Washroom Map"
            >
              <MapPin className="w-4 h-4 text-[#141414]" />
            </button>
            <div>
              <div className="text-[11px] text-stone-400 font-medium">
                {restaurant?.name || "Shree Ram Dhaba"}
              </div>
              <div className="text-sm font-extrabold text-[#141414] flex items-center gap-1.5">
                <span>Table #{selectedTableNumber}</span>
                <span className="text-stone-300">•</span>
                <span className="text-xs font-semibold text-stone-500">
                  {currentTable?.zone || "Main Hall"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Circular Action Icons (Bell for 1-Tap Essentials + Bag with Orange Dot) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setEssentialsModalOpen(true)}
              className="w-11 h-11 rounded-full bg-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] hover:bg-[#141414] hover:text-white transition relative"
              title="1-Tap Water, Cutlery & Table Essentials"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("cart")}
              className="w-11 h-11 rounded-full bg-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] hover:bg-[#141414] hover:text-white transition relative"
              title="View Table Bag"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalCartItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF6B4A] text-white text-[10px] font-extrabold flex items-center justify-center">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="mx-5 mb-3 px-4 py-2.5 rounded-2xl bg-[#141414] text-white text-xs font-semibold flex items-center justify-between shadow-lg">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6B4A]" />
              {toastMsg}
            </span>
            <button onClick={() => setToastMsg(null)}>
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 1: HOME & MENU ("Hungry? Order & Eat." — Right Phone in Ref)  */}
        {/* ================================================================== */}
        {activeTab === "home" && (
          <div>
            {/* Editorial Title + Search Bar */}
            <div className="px-5 pt-1 pb-5 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-[32px] sm:text-[36px] tracking-tight leading-none">
                  <span className="font-extrabold text-[#141414]">Hungry?</span>{" "}
                  <span className="font-light text-stone-400">Order & Eat.</span>
                </h1>

                {activeOrder && (
                  <button
                    onClick={() => setActiveTab("order")}
                    className="px-3.5 py-1.5 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    Order {activeOrder.status.toUpperCase()} • {activeOrder.effective_prep_minutes}m
                  </button>
                )}
              </div>

              {/* Search Pill + Circular Matte Black Filter/AI Button */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1 flex items-center gap-2.5 bg-white rounded-full px-4 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-100">
                  <Search className="w-4 h-4 text-stone-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes or say in Hinglish..."
                    className="w-full bg-transparent text-xs font-medium text-[#141414] placeholder:text-stone-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")}>
                      <X className="w-3.5 h-3.5 text-stone-400" />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleVoiceMic}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition shrink-0 ${
                    listening
                      ? "bg-[#FF6B4A] text-white animate-pulse"
                      : "bg-[#141414] hover:bg-[#FF6B4A] text-white"
                  }`}
                  title="AI Voice / Hinglish Order Concierge"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Curved Arch Category Selector + Dish Cards Container */}
            <div className="bg-[#F2EFE9]/75 rounded-t-[44px] pt-6 pb-10 px-5 space-y-6">
              {/* Circular Category Bubbles with Active Black Underline */}
              <div className="flex items-center justify-start sm:justify-center gap-4 sm:gap-7 overflow-x-auto no-scrollbar pb-1">
                {categoryPills.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="flex flex-col items-center shrink-0 group"
                    >
                      <div
                        className={`w-14 h-14 rounded-full bg-white p-1.5 shadow-xs flex items-center justify-center transition-transform ${
                          isActive
                            ? "scale-110 ring-2 ring-[#141414]/10 shadow-md"
                            : "opacity-80 group-hover:opacity-100"
                        }`}
                      >
                        <img
                          src={cat.image}
                          alt={cat.shortLabel}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span
                        className={`text-xs mt-2 transition ${
                          isActive
                            ? "font-extrabold text-[#141414]"
                            : "font-medium text-stone-400"
                        }`}
                      >
                        {cat.shortLabel}
                      </span>
                      <span
                        className={`h-[3px] rounded-full mt-1 transition-all ${
                          isActive ? "w-5 bg-[#141414]" : "w-0 bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Dish Grid (2 Columns on Mobile / 3-4 Columns on Laptop WebApp) */}
              <div
                className={`grid gap-4 ${
                  customerMode === "qr"
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                }`}
              >
                {filteredMenu.map((item: any) => {
                  const inCart = cart.find((c) => c.menu_item_id === item.id);
                  const cleanTitle = item.name.replace(" (3D View)", "");
                  const subtitle =
                    item.ingredients?.slice(0, 2).join(" • ") || item.category;

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-[28px] p-4 shadow-[0_10px_30px_rgba(20,20,20,0.04)] border border-white hover:shadow-[0_16px_40px_rgba(20,20,20,0.08)] transition flex flex-col items-center text-center justify-between relative group"
                    >
                      {/* Optional 3D Badge */}
                      {item.model_3d_url && (
                        <button
                          onClick={() => setActive3DItem(item)}
                          className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-[9px] font-extrabold tracking-tight transition flex items-center gap-0.5"
                          title="Inspect Interactive 3D Dish"
                        >
                          <Box className="w-2.5 h-2.5" /> 3D
                        </button>
                      )}

                      <div className="w-full">
                        {/* Plated Food Visual */}
                        <div
                          onClick={() => item.model_3d_url && setActive3DItem(item)}
                          className="h-28 sm:h-32 flex items-center justify-center cursor-pointer"
                        >
                          <img
                            src={item.image_url}
                            alt={cleanTitle}
                            className="w-28 h-28 sm:w-32 sm:h-32 object-contain group-hover:scale-105 transition duration-300"
                          />
                        </div>

                        {/* Matte Black Pill Badge (-5% VIP or BESTSELLER) */}
                        <div className="mt-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#141414] text-white text-[10px] font-bold">
                            {activeSession?.is_phone_verified
                              ? "-5% VIP"
                              : item.is_bestseller
                              ? "BESTSELLER"
                              : `${item.prep_time_minutes} MIN`}
                          </span>
                        </div>

                        {/* Dish Name & Subtitle */}
                        <h3 className="font-extrabold text-[#141414] text-sm mt-2 line-clamp-1">
                          {cleanTitle}
                        </h3>
                        <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                          {subtitle}
                        </p>
                      </div>

                      {/* Price & Circular + / - Button Row */}
                      <div className="w-full flex items-center justify-between mt-3.5 pt-1">
                        <div className="text-left">
                          <span className="text-xs font-bold text-stone-400 mr-0.5">₹</span>
                          <span className="text-base sm:text-lg font-extrabold text-[#141414]">
                            {(item.display_price_paise / 100).toFixed(0)}
                          </span>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-1.5 bg-[#141414] text-white rounded-full px-2 py-1">
                            <button
                              onClick={() => updateCartQty(item.id, inCart.qty - 1)}
                              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-extrabold px-0.5">{inCart.qty}</span>
                            <button
                              onClick={() => updateCartQty(item.id, inCart.qty + 1)}
                              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              addToCart({
                                menu_item_id: item.id,
                                name: item.name,
                                display_unit_paise: item.display_price_paise,
                                notes: "",
                                image_url: item.image_url,
                              });
                              showToast(`Added ${cleanTitle} to bag`);
                            }}
                            className="w-9 h-9 rounded-full bg-[#F5F3EF] hover:bg-[#141414] text-[#141414] hover:text-white flex items-center justify-center transition shadow-2xs"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: AI CONCIERGE & OCCASION CURATION                            */}
        {/* ================================================================== */}
        {activeTab === "offers" && (
          <div className="px-5 py-4 space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#141414]">
                AI Concierge <span className="font-light text-stone-400">& Occasions</span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Order naturally in Hindi, Hinglish, or English, or pick your dining occasion for tailored chef pairings.
              </p>
            </div>

            {/* Multilingual AI Order Box */}
            <form
              onSubmit={handleAiOrderParse}
              className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#141414] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF6B4A]" />
                  Voice & Hinglish Smart Order
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
                  className="text-[11px] font-bold text-[#FF6B4A] hover:underline"
                >
                  Fill Sample Hinglish
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVoiceMic}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition ${
                    listening
                      ? "bg-[#FF6B4A] text-white animate-pulse"
                      : "bg-[#F7F5F2] text-[#141414]"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="e.g. '2 paneer butter masala aur 4 butter naan, kam teekha'..."
                  className="flex-1 bg-[#F7F5F2] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#141414] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiBusy}
                  className="px-4 py-2.5 rounded-2xl bg-[#141414] hover:bg-[#FF6B4A] text-white text-xs font-bold transition shrink-0"
                >
                  {aiBusy ? "..." : "Add"}
                </button>
              </div>
              {aiFeedback && (
                <p className="text-xs font-semibold text-emerald-600">{aiFeedback}</p>
              )}
            </form>

            {/* Occasion Pills */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">
                Select Dining Occasion
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      selectedOccasion === occ.id
                        ? "bg-[#141414] text-white shadow-sm"
                        : "bg-white text-stone-600 border border-stone-200/70"
                    }`}
                  >
                    <span>{occ.emoji}</span>
                    <span>{occ.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Curated Pairing Cards */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">
                Curated For Your Table
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(upsellData?.suggestions || []).map((sug: any) => (
                  <div
                    key={sug.menu_item_id}
                    className="bg-white rounded-[24px] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] flex items-center gap-3.5 justify-between"
                  >
                    <img
                      src={sug.image_url}
                      alt={sug.name}
                      className="w-16 h-16 object-contain shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-[#141414] truncate">
                        {sug.name.replace(" (3D View)", "")}
                      </div>
                      <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">
                        {sug.reason}
                      </p>
                      <div className="font-extrabold text-xs text-[#FF6B4A] mt-1">
                        {formatPaise(sug.display_price_paise)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        addToCart({
                          menu_item_id: sug.menu_item_id,
                          name: sug.name,
                          display_unit_paise: sug.display_price_paise,
                          notes: "",
                          image_url: sug.image_url,
                        });
                        showToast(`Added ${sug.name.replace(" (3D View)", "")}`);
                      }}
                      className="w-9 h-9 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white flex items-center justify-center shrink-0 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: LIVE ORDER STATUS, 1-TAP REPEAT & WAITING GAME              */}
        {/* ================================================================== */}
        {activeTab === "order" && (
          <div className="px-5 py-4 space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#141414]">
                Live Kitchen <span className="font-light text-stone-400">Order Tracker</span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Real-time preparation timer synced directly with the chef's KDS screen.
              </p>
            </div>

            {!activeOrder ? (
              <div className="bg-white rounded-[32px] p-8 text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                <Clock className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-base font-extrabold text-[#141414]">
                  No Active Order in Kitchen Yet
                </h3>
                <p className="text-xs text-stone-400 max-w-xs mx-auto">
                  Add your favorite dishes to the bag and place your order to see live kitchen preparation timers and play table games!
                </p>
                <button
                  onClick={() => setActiveTab("home")}
                  className="px-5 py-2.5 rounded-full bg-[#141414] text-white text-xs font-bold"
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live Prep Countdown Card */}
                <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] text-xs font-extrabold uppercase">
                      Status: {activeOrder.status}
                    </span>
                    <span className="text-xs font-bold text-stone-400">
                      Table #{activeOrder.table_number}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-extrabold text-[#141414]">
                        ~{activeOrder.effective_prep_minutes} mins
                      </div>
                      <div className="text-xs text-stone-400">
                        Estimated preparation time
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#141414]">
                        {formatPaise(activeOrder.total_paise)}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold">
                        {activeOrder.discount_paise > 0
                          ? "Includes 5% VIP Discount"
                          : "GST Included"}
                      </div>
                    </div>
                  </div>

                  {/* 1-Tap Repeat Ordered Dishes */}
                  <div className="pt-3 border-t border-stone-100">
                    <div className="text-xs font-extrabold text-[#141414] mb-2 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-[#FF6B4A]" />
                      1-Tap Instant Repeat (No Waiting for Waiter)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeOrder.items.map((item: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleRepeatItem(item.menu_item_id, item.name)}
                          className="px-3.5 py-2 rounded-2xl bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+1 {item.name.replace(" (3D View)", "")}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    disabled={paymentBusy}
                    onClick={() => handlePayOrder("upi")}
                    className="w-full py-3.5 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {paymentBusy
                        ? "Processing Payment..."
                        : `Pay ${formatPaise(activeOrder.total_paise)} & Get WhatsApp Bill`}
                    </span>
                  </button>
                </div>

                {/* Gamified Waiting Card */}
                <div className="bg-white rounded-[32px] p-5 shadow-[0_8px_28px_rgba(0,0,0,0.03)] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B4A]">
                      While Your Food Cooks
                    </span>
                    <h4 className="text-sm font-extrabold text-[#141414] mt-0.5">
                      {wonPrize ? `🎉 Won: ${wonPrize}!` : "Spin the Table Reward Wheel"}
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Win a complimentary table perk while our chef prepares your meal.
                    </p>
                  </div>
                  <button
                    onClick={handleSpinWheel}
                    disabled={wheelSpinning}
                    className="px-4 py-2.5 rounded-full bg-[#FF6B4A] text-white font-bold text-xs shrink-0 shadow-md"
                  >
                    {wheelSpinning ? "Spinning..." : "Spin 🎡"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: BAG / CART & SERVER-SIDE BILL PREVIEW                       */}
        {/* ================================================================== */}
        {activeTab === "cart" && (
          <div className="px-5 py-4 space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#141414]">
                Your Table <span className="font-light text-stone-400">Bag</span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                All prices, 5% verified discount, and GST are calculated server-side.
              </p>
            </div>

            {cart.length === 0 ? (
              <div className="bg-white rounded-[32px] p-8 text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-base font-extrabold text-[#141414]">Your Bag is Empty</h3>
                <p className="text-xs text-stone-400">
                  Add dishes from the menu to send your order straight to the kitchen.
                </p>
                <button
                  onClick={() => setActiveTab("home")}
                  className="px-5 py-2.5 rounded-full bg-[#141414] text-white text-xs font-bold"
                >
                  Browse Dishes
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {cart.map((c) => (
                    <div
                      key={c.menu_item_id}
                      className="bg-white rounded-[24px] p-4 shadow-[0_6px_24px_rgba(0,0,0,0.03)] space-y-2.5"
                    >
                      <div className="flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={c.image_url}
                            alt={c.name}
                            className="w-14 h-14 object-contain shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-[#141414] truncate">
                              {c.name.replace(" (3D View)", "")}
                            </div>
                            <div className="text-xs font-bold text-stone-400">
                              {formatPaise(c.display_unit_paise)} each
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-[#F7F5F2] rounded-full px-2.5 py-1">
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty - 1)}
                            className="w-6 h-6 rounded-full bg-white text-[#141414] font-bold flex items-center justify-center shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-extrabold text-[#141414] px-1">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty + 1)}
                            className="w-6 h-6 rounded-full bg-[#141414] text-white font-bold flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={c.notes}
                        onChange={(e) => updateCartNotes(c.menu_item_id, e.target.value)}
                        placeholder="Add chef note (e.g. less spicy, extra butter, Jain)..."
                        className="w-full bg-[#F7F5F2] rounded-xl px-3 py-2 text-xs text-[#141414] placeholder:text-stone-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {cartPreview && (
                  <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] space-y-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Subtotal</span>
                        <span className="font-bold text-[#141414]">
                          {formatPaise(cartPreview.subtotal_paise)}
                        </span>
                      </div>
                      {cartPreview.discount_paise > 0 ? (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>5% Verified Mobile Discount</span>
                          <span>-{formatPaise(cartPreview.discount_paise)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[#FF6B4A] font-semibold">
                          <span>Verify Mobile to Save 5% Now</span>
                          <button
                            onClick={() => setEntryStep("welcome")}
                            className="underline font-bold"
                          >
                            Verify
                          </button>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-500">
                        <span>
                          GST ({(cartPreview.gst_bps / 100).toFixed(0)}% on Subtotal - Discount)
                        </span>
                        <span className="font-bold text-[#141414]">
                          {formatPaise(cartPreview.tax_paise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-extrabold text-[#141414] pt-2 border-t border-stone-100">
                        <span>Total Payable</span>
                        <span>{formatPaise(cartPreview.total_paise)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      className="w-full py-4 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs shadow-lg transition"
                    >
                      Place Order to Kitchen • {formatPaise(cartPreview.total_paise)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: GUEST PROFILE & FACILITIES (Matches Left Phone in Ref Image)*/}
        {/* ================================================================== */}
        {activeTab === "profile" && (
          <div className="px-5 py-6 space-y-6">
            {/* Centered Avatar, Name & Verified Badge (Exact match to Sophia Williams screen) */}
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FF6B4A]/20 to-amber-100 border-2 border-white shadow-md flex items-center justify-center text-2xl font-black text-[#141414]">
                  {(activeSession?.customer_name || guestNameInput || "G")[0]}
                </div>
                <span className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center border-2 border-white shadow-xs">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </div>

              <h2 className="text-lg font-extrabold text-[#141414] mt-3">
                {activeSession?.customer_name || guestNameInput || "Guest Diner"}
              </h2>
              <p className="text-xs text-stone-400">
                {activeSession?.is_phone_verified
                  ? `+91 ${activeSession.customer_phone} • 5% VIP Discount Unlocked`
                  : `Table #${selectedTableNumber} • Guest Session`}
              </p>
            </div>

            {/* Clean Rounded White Action Rows with Left Icons & Right Chevrons */}
            <div className="space-y-2.5">
              {[
                {
                  icon: <User className="w-4 h-4 text-[#141414]" />,
                  label: "Personal Information & 5% VIP Status",
                  sub: activeSession?.is_phone_verified
                    ? "Verified & DPDP Consented"
                    : "Tap to verify mobile for 5% off",
                  onClick: () => setEntryStep("welcome"),
                },
                {
                  icon: <Tag className="w-4 h-4 text-[#141414]" />,
                  label: "My Orders & Live Prep Timer",
                  sub: activeOrder
                    ? `Order ${activeOrder.status.toUpperCase()} • ${formatPaise(activeOrder.total_paise)}`
                    : "View active table order",
                  onClick: () => setActiveTab("order"),
                },
                {
                  icon: <MapPin className="w-4 h-4 text-[#141414]" />,
                  label: "Restroom, Handwash & Facility Guide",
                  sub: restaurant?.facilities_info?.restroom_directions || "Directions & Wi-Fi",
                  onClick: () => setFacilitiesModalOpen(true),
                },
                {
                  icon: <Bell className="w-4 h-4 text-[#141414]" />,
                  label: "1-Tap Table Essentials (Water, Cutlery)",
                  sub: "Request free water, tissues, chutney or runner",
                  onClick: () => setEssentialsModalOpen(true),
                },
                {
                  icon: <CreditCard className="w-4 h-4 text-[#141414]" />,
                  label: "Payment Methods & WhatsApp Bill",
                  sub: "UPI, Card & Split Bill at Table",
                  onClick: () => setActiveTab(activeOrder ? "order" : "cart"),
                },
                {
                  icon: <HelpCircle className="w-4 h-4 text-[#141414]" />,
                  label: "Restaurant Story & Hygiene Standards",
                  sub: restaurant?.facilities_info?.hygiene_note || "5-Star Hygiene Rated",
                  onClick: () => setFacilitiesModalOpen(true),
                },
                {
                  icon: <LogOut className="w-4 h-4 text-rose-500" />,
                  label: "Switch Table / Start New Session",
                  sub: `Currently on Table #${selectedTableNumber}`,
                  onClick: () => setEntryStep("welcome"),
                },
              ].map((row, idx) => (
                <button
                  key={idx}
                  onClick={row.onClick}
                  className="w-full bg-white hover:bg-stone-50/80 rounded-2xl p-4 shadow-[0_4px_18px_rgba(0,0,0,0.025)] border border-stone-100/80 flex items-center justify-between text-left transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#F7F5F2] flex items-center justify-center shrink-0">
                      {row.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#141414] truncate">
                        {row.label}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate mt-0.5">
                        {row.sub}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* FLOATING MATTE-BLACK BOTTOM PILL NAVIGATION BAR (Exact Orbix Ref)  */}
        {/* ================================================================== */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-[#141414] text-white rounded-full p-2 px-3 shadow-[0_20px_50px_rgba(20,20,20,0.32)] flex items-center gap-2 sm:gap-3">
            {[
              { id: "home", icon: <Home className="w-4 h-4" />, label: "Menu" },
              { id: "offers", icon: <Tag className="w-4 h-4" />, label: "AI & Offers" },
              {
                id: "order",
                icon: <Compass className="w-4 h-4" />,
                label: "Live Order",
                dot: !!activeOrder,
              },
              {
                id: "cart",
                icon: <ShoppingBag className="w-4 h-4" />,
                label: "Bag",
                badge: totalCartItems,
              },
              { id: "profile", icon: <User className="w-4 h-4" />, label: "Profile" },
            ].map((nav) => {
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id as CustomerTab)}
                  className={`relative flex items-center justify-center transition-all ${
                    isActive
                      ? "w-11 h-11 rounded-full bg-[#FF6B4A] text-white shadow-lg shadow-[#FF6B4A]/40"
                      : "w-10 h-10 rounded-full text-stone-400 hover:text-white"
                  }`}
                  title={nav.label}
                >
                  {nav.icon}
                  {nav.badge ? (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-[#141414] text-[9px] font-black flex items-center justify-center">
                      {nav.badge}
                    </span>
                  ) : nav.dot ? (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL 1: 3D Dish Preview (<model-viewer>) */}
      {active3DItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B4A]">
                  Interactive 3D Dish Preview
                </span>
                <h3 className="text-lg font-extrabold text-[#141414]">
                  {active3DItem.name.replace(" (3D View)", "")}
                </h3>
              </div>
              <button
                onClick={() => setActive3DItem(null)}
                className="w-9 h-9 rounded-full bg-[#F7F5F2] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-64 rounded-[28px] bg-[#FAF8F6] border border-stone-200/60 overflow-hidden">
              <model-viewer
                src={active3DItem.model_3d_url}
                alt={active3DItem.name}
                auto-rotate
                camera-controls
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              {active3DItem.description}
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xl font-extrabold text-[#141414]">
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
                  showToast("Added to table bag");
                }}
                className="px-6 py-3 rounded-full bg-[#141414] hover:bg-[#FF6B4A] text-white font-bold text-xs transition"
              >
                + Add to Bag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: 1-Tap Table Essentials */}
      {essentialsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B4A]">
                  Zero-Wait Service
                </span>
                <h3 className="text-lg font-extrabold text-[#141414]">
                  1-Tap Table Essentials
                </h3>
              </div>
              <button
                onClick={() => setEssentialsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#F7F5F2] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                { id: "water", label: "💧 RO Drinking Water" },
                { id: "chutney", label: "🌿 Mint Chutney & Onion" },
                { id: "tissues", label: "🧻 Fresh Napkins" },
                { id: "cutlery", label: "🍴 Warm Plates & Cutlery" },
                { id: "clean_table", label: "✨ Quick Table Wipe" },
                { id: "call_waiter", label: "🙋 Call Floor Steward" },
              ].map((req) => (
                <button
                  key={req.id}
                  onClick={() => handleServiceRequest(req.id as any, req.label)}
                  className="p-3.5 rounded-2xl bg-[#FAF8F6] hover:bg-[#141414] text-[#141414] hover:text-white font-bold text-left transition"
                >
                  {req.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Restaurant Story, Washroom Directions & Wi-Fi */}
      {facilitiesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B4A]">
                  Guest Guide
                </span>
                <h3 className="text-lg font-extrabold text-[#141414]">
                  {restaurant?.name} — Facilities
                </h3>
              </div>
              <button
                onClick={() => setFacilitiesModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#F7F5F2] flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              {restaurant?.description}
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAF8F6]">
                <div className="font-extrabold text-[#141414] mb-0.5">
                  🚻 Restroom / Washroom Directions
                </div>
                <div className="text-stone-500">
                  {restaurant?.facilities_info?.restroom_directions}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F6]">
                <div className="font-extrabold text-[#141414] mb-0.5">
                  🧼 Handwash & Hygiene Station
                </div>
                <div className="text-stone-500">
                  {restaurant?.facilities_info?.handwash_station}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F6] flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-[#141414] flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-[#FF6B4A]" /> Guest Wi-Fi
                  </div>
                  <div className="text-stone-500">
                    {restaurant?.facilities_info?.wifi_ssid}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
