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
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Mic,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  User,
  Utensils,
  Volume2,
  X,
} from "lucide-react";
import "@google/model-viewer";
import { speakWithElevenLabs } from "@/components/RoleGuideBot";
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
    clearCart,
  } = useAppStore();

  const [entryStep, setEntryStep] = useState<"welcome" | "app">("welcome");
  const [activeTab, setActiveTab] = useState<CustomerTab>("home");

  // Phone input and Existing Customer Lookup
  const [phoneInput, setPhoneInput] = useState("9876543210");
  const [guestNameInput, setGuestNameInput] = useState("Aarav Sharma");
  const [guestCountInput, setGuestCountInput] = useState(2);
  const [existingCustomer, setExistingCustomer] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [isQrLocked, setIsQrLocked] = useState(false);

  const [dpdpChecked, setDpdpChecked] = useState(true);
  const [otpInput, setOtpInput] = useState("1234");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [active3DItem, setActive3DItem] = useState<any | null>(null);
  const [essentialsModalOpen, setEssentialsModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // "Meal Complete" -> Final Billing & Google Review Screen State
  const [mealCompletedScreen, setMealCompletedScreen] = useState(false);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState(
    "Amazing food, super fast 1-tap chapati service!"
  );
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // AI Smart Waiter State (Gemini 2.5 Flash + ElevenLabs)
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [whatsappReceipt, setWhatsappReceipt] = useState<any | null>(null);

  const { data: restaurant } = useQuery<any>({
    queryKey: ["restaurant", activeRestaurantId],
    queryFn: () => apiFetch(`/api/restaurants/${activeRestaurantId}`),
  });

  const primaryColor = restaurant?.theme?.primary_color || "#ea580c";
  const logoUrl = restaurant?.theme?.logo_url;
  const phoneDiscountPct = (restaurant?.phone_discount_bps ?? 500) / 100;
  const reviewDiscountPct = (restaurant?.google_review_discount_bps ?? 200) / 100;

  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["tables", activeRestaurantId],
    queryFn: () => apiFetch(`/api/tables/${activeRestaurantId}`),
    refetchInterval: 4000,
  });

  // Bug 3: Detect and lock Table Number from QR URL parameters (?table=T1 or ?table=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawTable = params.get("table") || params.get("table_number") || params.get("t");
    if (rawTable) {
      const num = parseInt(rawTable.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > 0) {
        setSelectedTableNumber(num);
        setIsQrLocked(true);
      }
    }
  }, []);

  const currentTable =
    tables.find((t) => t.table_number === selectedTableNumber) || tables[0];
  const currentQrToken =
    currentTable?.qr_token || `${activeRestaurantId}-table-${selectedTableNumber}-token`;

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

  useEffect(() => {
    setEntryStep("welcome");
    setActiveTab("home");
    setMealCompletedScreen(false);
    setWhatsappReceipt(null);
  }, [activeRestaurantId]);

  // Bug 4: Instant Customer Lookup by Phone
  const handlePhoneLookup = async (phoneVal: string) => {
    const cleaned = phoneVal.replace(/\D/g, "").slice(0, 10);
    setPhoneInput(cleaned);
    if (cleaned.length === 10) {
      setLookupLoading(true);
      try {
        const res = await apiFetch(
          `/api/customers/lookup?phone=${cleaned}&restaurant_id=${activeRestaurantId}`
        );
        if (res.found) {
          setExistingCustomer(res);
          setGuestNameInput(res.name);
          showToast(`Welcome back, ${res.name}! 🎉`);
        } else {
          setExistingCustomer(null);
        }
      } catch {
        setExistingCustomer(null);
      } finally {
        setLookupLoading(false);
      }
    } else {
      setExistingCustomer(null);
    }
  };

  const { data: menuData } = useQuery<any>({
    queryKey: ["menu", activeRestaurantId, currentQrToken],
    queryFn: () =>
      apiFetch(
        `/api/menu/${activeRestaurantId}?qr_token=${encodeURIComponent(currentQrToken)}`
      ),
    enabled: !!currentQrToken,
  });

  const menuItems: any[] = menuData?.items || [];

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

  // ElevenLabs Hindi Welcome Voice
  const playWelcomeGreeting = (lang: "hi" | "en" = "hi") => {
    const rName = restaurant?.name || "Shree Ram Dhaba";
    const text =
      lang === "hi"
        ? `नमस्कार! आपका ${rName} में हार्दिक स्वागत है। टेबल नंबर ${selectedTableNumber} पर आपका ५ प्रतिशत वीआईपी डिस्काउंट एक्टिव है। कृपया मेन्यू से अपने मनपसंद व्यंजन चुनें!`
        : `Namaskar and welcome to ${rName} at Table ${selectedTableNumber}! Your 5% VIP discount is unlocked. Enjoy our authentic highway delicacies!`;
    speakWithElevenLabs(text, lang);
  };

  // Bug 4: Friction-free fast login (No member selection blocking entry)
  const handleStartVerifiedSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!dpdpChecked) {
      setAuthError(
        `Please check the DPDP consent box to unlock your ${phoneDiscountPct}% discount.`
      );
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
          guest_count: guestCountInput || 2,
          source: customerMode === "qr" ? "qr" : "tablet",
          occasion: selectedOccasion,
        }),
      });

      const verified = await apiFetch(`/api/sessions/${sess.session_id}/verify-phone`, {
        method: "POST",
        body: JSON.stringify({
          qr_token: currentQrToken,
          phone: phoneInput,
          name: guestNameInput || "Guest",
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
      playWelcomeGreeting("hi");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

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
          guest_count: guestCountInput || 2,
          source: customerMode === "qr" ? "qr" : "tablet",
          occasion: selectedOccasion,
        }),
      });
      setActiveSession(sess);
      setEntryStep("app");
      setActiveTab("home");
      playWelcomeGreeting("hi");
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // Bug 7: Conversational AI Smart Waiter with Gemini 2.5 Flash & ElevenLabs
  const handleAiOrderParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiInput.trim()) return;
    setAiBusy(true);
    setAiFeedback(null);
    try {
      const res = await apiFetch("/api/ai/smart-order", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          text: aiInput,
        }),
      });

      const summaryText = res.summary_message || "Ji, main aapka order samajh gaya hoon!";
      setAiFeedback(summaryText);

      // Play audio response via ElevenLabs
      speakWithElevenLabs(summaryText, "hi");

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
        showToast(`Added ${res.parsed_items.length} dish(es) to your bag!`);
      }
      setAiInput("");
    } catch (err: any) {
      setAiFeedback(`Error: ${err.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const handleVoiceMic = () => {
    setAiModalOpen(true);
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setAiInput("hello");
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = "hi-IN";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(transcript);
    };
    recognition.start();
  };

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
      setMealCompletedScreen(false);
      setActiveTab("order");
      showToast("Order sent to Kitchen! You can repeat chapatis/dishes anytime.");
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables", activeRestaurantId] });
    } catch (err: any) {
      alert(`Order error: ${err.message}`);
    }
  };

  const handleRepeatItem = async (menuItemId: string, itemName: string) => {
    if (!activeSession) return;
    try {
      await apiFetch("/api/orders/repeat-item", {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: activeRestaurantId,
          session_id: activeSession.session_id,
          qr_token: currentQrToken,
          menu_item_id: menuItemId,
          qty: 1,
        }),
      });
      showToast(`Added +1 ${itemName.replace(" (3D View)", "")} to active order!`);
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitGoogleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setReviewSubmitting(true);
    try {
      await apiFetch(`/api/sessions/${activeSession.session_id}/google-review`, {
        method: "POST",
        body: JSON.stringify({
          qr_token: currentQrToken,
          stars: reviewStars,
          review_text: reviewText,
        }),
      });
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      showToast(`+${reviewDiscountPct}% Google Review discount applied!`);
      queryClient.invalidateQueries({ queryKey: ["session-orders"] });
    } catch (err: any) {
      alert(`Review error: ${err.message}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

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
      setMealCompletedScreen(false);
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

  const breadItems = menuItems.filter(
    (m) =>
      m.category.toLowerCase().includes("bread") ||
      m.name.toLowerCase().includes("naan") ||
      m.name.toLowerCase().includes("kulcha") ||
      m.name.toLowerCase().includes("chapati") ||
      m.name.toLowerCase().includes("roti")
  );

  // ============================================================================
  // SCREEN 1: ANIMATED LUXURY LOGIN (Bug #4 & Bug #2 & Bug #3)
  // ============================================================================
  if (entryStep === "welcome" && !whatsappReceipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F2EB] via-[#FAF9F6] to-[#ECE7DE] flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased selection:bg-amber-500 selection:text-white">
        <div className="w-full max-w-[420px] bg-white rounded-[40px] p-7 sm:p-8 shadow-[0_24px_70px_rgba(20,20,20,0.08)] border border-stone-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          
          {/* Top Brand & QR Lock Indicator */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-full shadow-xs" />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Utensils className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider block">
                  Table QR
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#141414]">
                  <span>Table #{selectedTableNumber}</span>
                  {isQrLocked && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      QR Locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Voice Welcome Button */}
            <button
              type="button"
              onClick={() => playWelcomeGreeting("hi")}
              className="px-3.5 py-1.5 rounded-full bg-[#141414] text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-sm hover:bg-stone-800 transition"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#9FE870]" />
              <span>नमस्ते</span>
            </button>
          </div>

          {/* Restaurant Title & Tagline */}
          <div className="mb-6 space-y-1">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {restaurant?.name || "Shree Ram Dhaba"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141414] tracking-tight leading-tight pt-1">
              Welcome! <span className="font-light text-stone-400">Order & Eat.</span>
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed">
              {restaurant?.tagline || "Highway tandoor feasts served fresh straight to your table."}
            </p>
          </div>

          {/* Instant 5% VIP Discount Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🎉</span>
              <div>
                <div className="text-xs font-bold text-amber-900">
                  Flat {phoneDiscountPct}% Instant Discount
                </div>
                <div className="text-[10px] text-amber-700">
                  Enter your mobile number to unlock VIP pricing!
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#141414] text-white text-[10px] font-extrabold tracking-wide">
              -{phoneDiscountPct}% OFF
            </span>
          </div>

          {/* Fast 1-Tap Login Form */}
          <form onSubmit={handleStartVerifiedSession} className="space-y-4">
            
            {/* Phone Number Input with +91 and Auto-Lookup */}
            <div>
              <label className="block text-[11px] text-stone-500 font-semibold mb-1">
                WhatsApp / Mobile Number
              </label>
              <div className="flex items-center gap-2 bg-[#F7F5F2] rounded-2xl px-3.5 py-2.5 border border-stone-200/70 focus-within:border-stone-400 focus-within:bg-white transition">
                <span className="text-xs font-bold text-stone-600 flex items-center gap-1">
                  <span>🇮🇳</span> +91
                </span>
                <span className="text-stone-300">|</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) => handlePhoneLookup(e.target.value)}
                  placeholder="9876543210"
                  className="w-full bg-transparent text-xs font-bold text-[#141414] focus:outline-none placeholder:text-stone-400 tracking-wide"
                />
                {lookupLoading && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-stone-400 border-t-transparent animate-spin" />
                )}
              </div>
            </div>

            {/* Existing Customer Welcome-Back Pill */}
            {existingCustomer ? (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Welcome back, {existingCustomer.name}!</span>
                    <div className="text-[10px] text-emerald-700 font-medium">
                      Regular Diner • Visit #{existingCustomer.visit_count + 1}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-stone-500 font-semibold mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full bg-[#F7F5F2] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#141414] border border-stone-200/70 focus:outline-none focus:bg-white transition"
                />
              </div>
            )}

            {/* Verification OTP */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-stone-500 font-semibold">
                  OTP Code
                </label>
                <span className="text-[10px] text-stone-400 font-medium">(Auto: 1234)</span>
              </div>
              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-full bg-[#F7F5F2] rounded-2xl px-3.5 py-2.5 text-xs font-extrabold tracking-widest text-[#141414] border border-stone-200/70 focus:outline-none focus:bg-white text-center"
              />
            </div>

            {/* DPDP Consent Checkbox */}
            <label className="flex items-start gap-2.5 pt-0.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dpdpChecked}
                onChange={(e) => setDpdpChecked(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[11px] text-stone-500 leading-snug">
                I consent under the <strong className="text-[#141414]">DPDP Act 2023</strong> to receive my WhatsApp bill & unlock my {phoneDiscountPct}% VIP discount.
              </span>
            </label>

            {authError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
                {authError}
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-4 rounded-full text-white font-bold text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <span>{authBusy ? "Unlocking VIP Menu..." : `Unlock ${phoneDiscountPct}% Discount & View Menu`}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Skip to Guest */}
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled={authBusy}
              onClick={handleContinueAsGuest}
              className="text-xs font-semibold text-stone-400 hover:text-[#141414] transition"
            >
              Skip & Browse Menu as Guest →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // WHATSAPP BILL RECEIPT (After Payment)
  // ============================================================================
  if (whatsappReceipt) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-stone-100 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-[#141414]">Payment Successful!</h2>
            <p className="text-xs text-stone-500 mt-1">
              Thank you for dining at {restaurant?.name || "Shree Ram Dhaba"}!
            </p>
          </div>

          <div className="bg-stone-50 rounded-2xl p-4 text-left font-mono text-xs space-y-2 border border-stone-200/60">
            <div className="flex justify-between text-stone-500">
              <span>Bill #</span>
              <span className="font-bold text-[#141414]">{whatsappReceipt.bill_id || "SRD-9812"}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Table</span>
              <span className="font-bold text-[#141414]">Table #{selectedTableNumber}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Total Paid</span>
              <span className="font-bold text-emerald-600">{formatPaise(whatsappReceipt.total_paise || 0)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>WhatsApp Copy</span>
              <span className="font-bold text-emerald-600">✓ Sent to +91 {phoneInput}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 rounded-full bg-stone-100 hover:bg-stone-200 text-[#141414] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={() => {
                setWhatsappReceipt(null);
                setEntryStep("welcome");
              }}
              className="flex-1 py-3 rounded-full text-white font-bold text-xs shadow-md transition"
              style={{ backgroundColor: primaryColor }}
            >
              Start New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SCREEN 2: MAIN DINING APP (Orbix Studio Inspired Luxury Experience)
  // ============================================================================
  const isDesktopWebApp = customerMode === "tablet";

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#141414] pb-28 font-sans antialiased">
      {/* Device Mode Switcher for Demo */}
      <div className="bg-[#1E201F] text-stone-300 py-1.5 px-4 text-xs flex items-center justify-between border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#9FE870] animate-pulse" />
          <span className="font-medium text-[11px] text-stone-300">
            {restaurant?.name} • Table #{selectedTableNumber}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCustomerMode("qr")}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition ${
              customerMode === "qr" ? "bg-white text-[#141414]" : "text-stone-400 hover:text-white"
            }`}
          >
            Mobile Frame
          </button>
          <button
            onClick={() => setCustomerMode("tablet")}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition ${
              customerMode === "tablet" ? "bg-white text-[#141414]" : "text-stone-400 hover:text-white"
            }`}
          >
            Web App
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`mx-auto transition-all ${
          customerMode === "qr"
            ? "max-w-[420px] md:my-4 bg-white md:rounded-[44px] md:shadow-[0_28px_80px_rgba(20,20,20,0.12)] md:border-[6px] md:border-white min-h-[820px] relative overflow-hidden"
            : "max-w-7xl px-4 sm:px-6 pt-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        }`}
      >
        <div className={isDesktopWebApp ? "lg:col-span-8" : "w-full"}>
          
          {/* Header Bar */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Thermal Bill / Receipt Viewer Button (Bug #6) */}
              <button
                onClick={() => setReceiptModalOpen(true)}
                className="w-11 h-11 rounded-full bg-[#F7F5F2] hover:bg-[#141414] hover:text-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] transition"
                title="View Bill / Print Receipt"
              >
                <ReceiptText className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="w-3.5 h-3.5 object-contain" />}
                  <span>{restaurant?.name || "Shree Ram Dhaba"}</span>
                </div>
                <div className="text-sm font-extrabold text-[#141414] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Table #{selectedTableNumber}</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-xs font-semibold text-stone-500">
                    {activeSession?.customer_name || "Verified Diner"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice Guide Bot Audio */}
              <button
                onClick={() => playWelcomeGreeting("hi")}
                className="w-11 h-11 rounded-full bg-[#F7F5F2] hover:bg-[#141414] hover:text-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] transition"
                title="Voice Guide"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {/* Service Requests (Water, Cutlery) */}
              <button
                onClick={() => setEssentialsModalOpen(true)}
                className="w-11 h-11 rounded-full bg-[#F7F5F2] hover:bg-[#141414] hover:text-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] transition"
                title="Request Water / Table Essentials"
              >
                <Bell className="w-4 h-4" />
              </button>

              {/* Cart Bag Icon with Badge */}
              <button
                onClick={() => setActiveTab("cart")}
                className="w-11 h-11 rounded-full bg-[#F7F5F2] hover:bg-[#141414] hover:text-white border border-stone-200/70 shadow-2xs flex items-center justify-center text-[#141414] transition relative"
                title="View Bag"
              >
                <ShoppingBag className="w-4 h-4" />
                {totalCartItems > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>

          {toastMsg && (
            <div className="mx-5 mb-3 px-4 py-2.5 rounded-2xl bg-[#141414] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {toastMsg}
              </span>
              <button onClick={() => setToastMsg(null)}>
                <X className="w-3.5 h-3.5 text-stone-400" />
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: MENU & DISHES                                             */}
          {/* ================================================================ */}
          {activeTab === "home" && (
            <div>
              <div className="px-5 pt-1 pb-4 space-y-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h1 className="text-[28px] sm:text-[32px] tracking-tight leading-none">
                    <span className="font-extrabold text-[#141414]">Hungry?</span>{" "}
                    <span className="font-light text-stone-400">Order & Eat.</span>
                  </h1>

                  {activeOrder && (
                    <button
                      onClick={() => setActiveTab("order")}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs transition hover:brightness-105"
                      style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                    >
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      Order {activeOrder.status.toUpperCase()} • 1-Tap Roti / Bill
                    </button>
                  )}
                </div>

                {/* Search Bar & Smart Voice Waiter Button */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 flex items-center gap-2.5 bg-[#F7F5F2] rounded-full px-4 py-3 border border-stone-200/60 focus-within:bg-white focus-within:border-stone-400 transition">
                    <Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search dishes or type in Hindi..."
                      className="w-full bg-transparent text-xs font-medium text-[#141414] placeholder:text-stone-400 focus:outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")}>
                        <X className="w-3.5 h-3.5 text-stone-400" />
                      </button>
                    )}
                  </div>

                  {/* Gemini Smart Waiter Trigger (Bug #7) */}
                  <button
                    onClick={handleVoiceMic}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition shrink-0 hover:scale-105 active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                    title="AI Smart Waiter (Gemini 2.5 Flash)"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Category Selector Pills */}
              <div className="bg-[#FAF9F6] rounded-[36px] pt-4 pb-10 px-5 space-y-5">
                <div className="flex items-center justify-start gap-4 overflow-x-auto no-scrollbar pb-1">
                  {categoryPills.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="flex flex-col items-center shrink-0 group transition"
                      >
                        <div
                          className={`w-13 h-13 rounded-full bg-white p-1 shadow-xs flex items-center justify-center transition-all ${
                            isActive
                              ? "scale-105 ring-2 shadow-md"
                              : "opacity-75 group-hover:opacity-100"
                          }`}
                          style={isActive ? { borderColor: primaryColor } : {}}
                        >
                          <img
                            src={cat.image}
                            alt={cat.shortLabel}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span
                          className={`text-xs mt-1.5 transition ${
                            isActive ? "font-bold text-[#141414]" : "font-medium text-stone-400"
                          }`}
                        >
                          {cat.shortLabel}
                        </span>
                        <span
                          className="h-[2.5px] rounded-full mt-0.5 transition-all"
                          style={{
                            width: isActive ? "20px" : "0px",
                            backgroundColor: isActive ? primaryColor : "transparent",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Dish Cards Grid with In-place [ - 1 + ] Quantity Controls (Bug #8) */}
                <div
                  className={`grid gap-3.5 ${
                    customerMode === "qr" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {filteredMenu.map((item: any) => {
                    const inCart = cart.find((c) => c.menu_item_id === item.id);
                    const qty = inCart ? inCart.qty : 0;
                    const cleanTitle = item.name.replace(" (3D View)", "");
                    const subtitle = item.ingredients?.slice(0, 2).join(" • ") || item.category;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-[26px] p-3.5 shadow-[0_8px_24px_rgba(20,20,20,0.04)] border border-stone-100/80 hover:shadow-md transition flex flex-col items-center text-center justify-between relative group"
                      >
                        {item.model_3d_url && (
                          <button
                            onClick={() => setActive3DItem(item)}
                            className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-[9px] font-bold tracking-tight transition flex items-center gap-0.5"
                            title="Interactive 3D View"
                          >
                            <Box className="w-2.5 h-2.5" /> 3D
                          </button>
                        )}

                        <div className="w-full">
                          <div
                            onClick={() => item.model_3d_url && setActive3DItem(item)}
                            className="h-28 flex items-center justify-center cursor-pointer"
                          >
                            <img
                              src={item.image_url}
                              alt={cleanTitle}
                              className="w-24 h-24 object-contain group-hover:scale-105 transition duration-300"
                            />
                          </div>

                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                              {activeSession?.is_phone_verified
                                ? `-${phoneDiscountPct}% VIP`
                                : item.is_bestseller
                                ? "BESTSELLER"
                                : `${item.prep_time_minutes} MIN`}
                            </span>
                          </div>

                          <h3 className="font-bold text-[#141414] text-xs sm:text-sm mt-1.5 line-clamp-1">
                            {cleanTitle}
                          </h3>
                          <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1">
                            {subtitle}
                          </p>
                        </div>

                        {/* In-place Quantity Counter or Add Button (Bug #8) */}
                        <div className="w-full flex items-center justify-between mt-3 pt-1 border-t border-stone-100">
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-stone-400">₹</span>
                            <span className="text-sm sm:text-base font-extrabold text-[#141414]">
                              {(item.display_price_paise / 100).toFixed(0)}
                            </span>
                          </div>

                          {qty > 0 ? (
                            <div className="flex items-center gap-1.5 bg-[#141414] text-white rounded-full p-1 shadow-xs">
                              <button
                                onClick={() => updateCartQty(item.id, qty - 1)}
                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-95 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold px-1">{qty}</span>
                              <button
                                onClick={() => updateCartQty(item.id, qty + 1)}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white active:scale-95 transition"
                                style={{ backgroundColor: primaryColor }}
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
                              className="px-3.5 py-1.5 rounded-full text-white text-[11px] font-bold shadow-xs transition hover:brightness-110 active:scale-95"
                              style={{ backgroundColor: primaryColor }}
                            >
                              + ADD
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

          {/* ================================================================ */}
          {/* TAB 2: AI CONCIERGE & OCCASIONS                                  */}
          {/* ================================================================ */}
          {activeTab === "offers" && (
            <div className="px-5 py-4 space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-[#141414]">
                  AI Concierge <span className="font-light text-stone-400">& Waiter</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Powered by Google Gemini 2.5 Flash & ElevenLabs Hindi Voice.
                </p>
              </div>

              {/* Conversational Smart Order Input Box */}
              <form
                onSubmit={handleAiOrderParse}
                className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-3 border border-stone-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141414] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                    Conversational Smart Order
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiInput("Bhaiya 2 Dal Makhani aur 4 Butter Naan lagana, kam teekha")}
                    className="text-[11px] font-semibold hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Sample Hinglish
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleVoiceMic}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition ${
                      listening ? "bg-rose-500 text-white animate-pulse" : "bg-[#F7F5F2] text-[#141414]"
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Type 'hello', or '2 dal makhani aur 4 naan'..."
                    className="flex-1 bg-[#F7F5F2] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#141414] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={aiBusy}
                    className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {aiBusy ? "..." : "Send"}
                  </button>
                </div>

                {aiFeedback && (
                  <div className="p-3 rounded-2xl bg-stone-50 text-xs font-medium text-stone-700 leading-relaxed border border-stone-200/70">
                    {aiFeedback}
                  </div>
                )}
              </form>

              {/* Occasion Selection */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Select Dining Occasion
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {OCCASIONS.map((occ) => (
                    <button
                      key={occ.id}
                      onClick={() => setSelectedOccasion(occ.id)}
                      className={`px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
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

              {/* Curated Recommendations */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Curated For Your Table
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(upsellData?.suggestions || []).map((sug: any) => (
                    <div
                      key={sug.menu_item_id}
                      className="bg-white rounded-[24px] p-4 shadow-xs flex items-center gap-3.5 justify-between border border-stone-100"
                    >
                      <img src={sug.image_url} alt={sug.name} className="w-14 h-14 object-contain shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#141414] truncate">
                          {sug.name.replace(" (3D View)", "")}
                        </div>
                        <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5">{sug.reason}</p>
                        <div className="font-bold text-xs mt-1" style={{ color: primaryColor }}>
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
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: LIVE DINING & FINAL BILLING SCREEN                        */}
          {/* ================================================================ */}
          {activeTab === "order" && (
            <div className="px-5 py-4 space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-[#141414]">
                  {mealCompletedScreen ? "Final Bill & Review" : "Live Dining & 1-Tap Repeat"}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  {mealCompletedScreen
                    ? `Rate your experience on Google to unlock an extra +${reviewDiscountPct}% off your total bill!`
                    : "Repeat hot chapatis, rotis, or dishes in 1 tap anytime. Press 'Complete Meal' when you finish dining."}
                </p>
              </div>

              {!activeOrder ? (
                <div className="bg-white rounded-[32px] p-8 text-center space-y-3 shadow-xs border border-stone-100">
                  <Clock className="w-10 h-10 text-stone-300 mx-auto" />
                  <h3 className="text-base font-bold text-[#141414]">No Active Order in Kitchen Yet</h3>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto">
                    Add dishes from the menu to send your order straight to the kitchen.
                  </p>
                  <button
                    onClick={() => setActiveTab("home")}
                    className="px-5 py-2.5 rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Explore Menu
                  </button>
                </div>
              ) : !mealCompletedScreen ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-[32px] p-6 shadow-sm space-y-5 border border-stone-100">
                    <div className="flex items-center justify-between">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                      >
                        Kitchen Status: {activeOrder.status}
                      </span>
                      <span className="text-xs font-semibold text-stone-400">
                        Prep ETA: ~{activeOrder.effective_prep_minutes} mins
                      </span>
                    </div>

                    {/* 1-Tap Hot Chapati Repeat */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-[#141414] flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        1-Tap Repeat Hot Roti / Ordered Dishes
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeOrder.items.map((item: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleRepeatItem(item.menu_item_id, item.name)}
                            className="px-3 py-1.5 rounded-2xl bg-[#F7F5F2] hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-semibold transition flex items-center gap-1.5 border border-stone-200/70"
                          >
                            <Plus className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                            <span>+1 {item.name.replace(" (3D View)", "")}</span>
                          </button>
                        ))}
                        {breadItems.map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => handleRepeatItem(b.id, b.name)}
                            className="px-3 py-1.5 rounded-2xl bg-amber-50 hover:bg-[#141414] text-[#141414] hover:text-white text-xs font-semibold transition flex items-center gap-1.5 border border-amber-200"
                          >
                            <Plus className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                            <span>🫓 +1 Hot {b.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Order Items */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                      <div className="text-xs font-semibold text-stone-400">
                        Items Preparing / Served at Table #{activeOrder.table_number}:
                      </div>
                      {activeOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1">
                          <span className="text-[#141414] font-medium">
                            {item.qty}x {item.name.replace(" (3D View)", "")}
                            {item.is_repeat && (
                              <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                Repeat
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-[#141414]">
                            {formatPaise(item.line_display_total_paise)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => setActiveTab("home")}
                        className="px-4 py-3 rounded-full bg-[#F7F5F2] hover:bg-stone-200 text-[#141414] text-xs font-bold transition"
                      >
                        + Add More Dishes
                      </button>

                      <button
                        onClick={() => setMealCompletedScreen(true)}
                        className="flex-1 py-3.5 px-6 rounded-full text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Complete Dining & Get +{reviewDiscountPct}% Review Off</span>
                      </button>
                    </div>
                  </div>

                  {/* Wheel Game */}
                  <div className="bg-white rounded-[28px] p-5 shadow-xs flex items-center justify-between gap-4 border border-stone-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                        While Your Food Cooks
                      </span>
                      <h4 className="text-sm font-bold text-[#141414] mt-0.5">
                        {wonPrize ? `🎉 Won: ${wonPrize}!` : "Spin the Table Perk Wheel"}
                      </h4>
                    </div>
                    <button
                      onClick={handleSpinWheel}
                      disabled={wheelSpinning}
                      className="px-4 py-2.5 rounded-full text-white font-bold text-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {wheelSpinning ? "..." : "Spin 🎡"}
                    </button>
                  </div>
                </div>
              ) : (
                /* FINAL BILLING SCREEN WITH GOOGLE REVIEW BONUS */
                <div className="space-y-4">
                  <form
                    onSubmit={handleSubmitGoogleReview}
                    className="bg-white rounded-[32px] p-6 shadow-sm border-2 border-emerald-400 space-y-4"
                  >
                    <div>
                      <span className="px-3 py-1 rounded-full bg-[#1E201F] text-[#9FE870] text-[10px] font-bold uppercase">
                        Instant Google Review Reward
                      </span>
                      <h3 className="text-base font-bold text-[#141414] mt-2">
                        Rate {restaurant?.name} & Deduct +{reviewDiscountPct}% Extra!
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {activeOrder.is_google_reviewed
                          ? `✓ Your +${reviewDiscountPct}% Google Review Discount is applied below!`
                          : `Leave a quick rating to get extra ${reviewDiscountPct}% off your total bill.`}
                      </p>
                    </div>

                    {!activeOrder.is_google_reviewed && (
                      <>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setReviewStars(star)}
                              className={`p-2 rounded-xl transition ${
                                star <= reviewStars ? "text-amber-400 scale-110" : "text-stone-300"
                              }`}
                            >
                              <Star className="w-6 h-6 fill-current" />
                            </button>
                          ))}
                          <span className="text-xs font-bold text-[#141414] ml-2">
                            {reviewStars}.0 / 5.0 Stars
                          </span>
                        </div>

                        <input
                          type="text"
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="Your review comment..."
                          className="w-full bg-[#F7F5F2] rounded-2xl px-4 py-2.5 text-xs text-[#141414] focus:outline-none"
                        />

                        <button
                          type="submit"
                          disabled={reviewSubmitting}
                          className="w-full py-3.5 rounded-full text-white font-bold text-xs transition shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {reviewSubmitting ? "Applying..." : `Apply +${reviewDiscountPct}% Google Review Discount`}
                        </button>
                      </>
                    )}
                  </form>

                  {/* Bill Summary */}
                  <div className="bg-white rounded-[32px] p-6 shadow-sm space-y-4 border border-stone-100">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h3 className="text-base font-bold text-[#141414]">
                        Table #{activeOrder.table_number} Bill Summary
                      </h3>
                      <button
                        onClick={() => setMealCompletedScreen(false)}
                        className="text-xs font-bold hover:underline"
                        style={{ color: primaryColor }}
                      >
                        ← Back to Add Dishes
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      {activeOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-stone-600">
                          <span>{item.qty}x {item.name.replace(" (3D View)", "")}</span>
                          <span className="font-bold text-[#141414]">{formatPaise(item.line_display_total_paise)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Subtotal</span>
                        <span className="font-bold text-[#141414]">{formatPaise(activeOrder.subtotal_paise)}</span>
                      </div>

                      {activeOrder.phone_discount_paise > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>VIP Mobile Discount ({phoneDiscountPct}%)</span>
                          <span>-{formatPaise(activeOrder.phone_discount_paise)}</span>
                        </div>
                      )}

                      {activeOrder.review_discount_paise > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Google Review Bonus (+{reviewDiscountPct}%)</span>
                          <span>-{formatPaise(activeOrder.review_discount_paise)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-stone-500">
                        <span>GST (5%)</span>
                        <span className="font-bold text-[#141414]">{formatPaise(activeOrder.tax_paise)}</span>
                      </div>

                      <div className="flex justify-between text-lg font-extrabold text-[#141414] pt-2 border-t border-stone-100">
                        <span>Final Payable</span>
                        <span>{formatPaise(activeOrder.total_paise)}</span>
                      </div>
                    </div>

                    <button
                      disabled={paymentBusy}
                      onClick={() => handlePayOrder("upi")}
                      className="w-full py-4 rounded-full text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{paymentBusy ? "Processing..." : `Pay ${formatPaise(activeOrder.total_paise)} via UPI / Card`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: BAG / CART                                                */}
          {/* ================================================================ */}
          {activeTab === "cart" && (
            <div className="px-5 py-4 space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-[#141414]">
                  Table #{selectedTableNumber} <span className="font-light text-stone-400">Bag</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Verified server-side calculation with {phoneDiscountPct}% VIP discount.
                </p>
              </div>

              {cart.length === 0 ? (
                <div className="bg-white rounded-[32px] p-8 text-center space-y-3 shadow-xs border border-stone-100">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
                  <h3 className="text-base font-bold text-[#141414]">Your Bag is Empty</h3>
                  <p className="text-xs text-stone-400">
                    Add dishes from the menu to send your order straight to the kitchen.
                  </p>
                  <button
                    onClick={() => setActiveTab("home")}
                    className="px-5 py-2.5 rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {cart.map((c) => (
                      <div
                        key={c.menu_item_id}
                        className="p-4 rounded-2xl bg-white shadow-xs border border-stone-100 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={c.image_url} alt={c.name} className="w-12 h-12 object-contain shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#141414] truncate">
                              {c.name.replace(" (3D View)", "")}
                            </div>
                            <div className="text-xs font-extrabold text-stone-500 mt-0.5">
                              {formatPaise(c.display_unit_paise * c.qty)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[#F7F5F2] rounded-full p-1 border border-stone-200/70">
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty - 1)}
                            className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#141414] shadow-xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold w-5 text-center">{c.qty}</span>
                          <button
                            onClick={() => updateCartQty(c.menu_item_id, c.qty + 1)}
                            className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Guest count confirmation row in Cart */}
                  <div className="p-4 rounded-2xl bg-white border border-stone-100 shadow-xs flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141414]">Dining Guests at Table</div>
                      <div className="text-[10px] text-stone-400">Confirm headcount for plates & glasses</div>
                    </div>
                    <div className="flex items-center gap-2 bg-[#F7F5F2] px-3 py-1.5 rounded-full border border-stone-200/70">
                      <button
                        onClick={() => setGuestCountInput(Math.max(1, guestCountInput - 1))}
                        className="w-5 h-5 rounded-full bg-white text-xs font-bold shadow-xs flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold">{guestCountInput} 👤</span>
                      <button
                        onClick={() => setGuestCountInput(guestCountInput + 1)}
                        className="w-5 h-5 rounded-full text-white text-xs font-bold shadow-xs flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {cartPreview && (
                    <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-100 space-y-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-stone-500">
                          <span>Subtotal</span>
                          <span className="font-bold text-[#141414]">{formatPaise(cartPreview.subtotal_paise)}</span>
                        </div>
                        {cartPreview.discount_paise > 0 && (
                          <div className="flex justify-between text-emerald-600 font-bold">
                            <span>VIP Phone Discount ({phoneDiscountPct}%)</span>
                            <span>-{formatPaise(cartPreview.discount_paise)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-stone-500">
                          <span>GST (5%)</span>
                          <span className="font-bold text-[#141414]">{formatPaise(cartPreview.tax_paise)}</span>
                        </div>
                        <div className="flex justify-between text-base font-extrabold text-[#141414] pt-2 border-t border-stone-100">
                          <span>Total</span>
                          <span>{formatPaise(cartPreview.total_paise)}</span>
                        </div>
                      </div>

                      <button
                        onClick={handlePlaceOrder}
                        className="w-full py-4 rounded-full text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span>Send Order to Kitchen ({guestCountInput} Guests) →</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 5: PROFILE                                                   */}
          {/* ================================================================ */}
          {activeTab === "profile" && (
            <div className="px-5 py-6 space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-white shadow-md flex items-center justify-center text-2xl font-extrabold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {(activeSession?.customer_name || guestNameInput || "G")[0]}
                  </div>
                  <span className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#141414] mt-3">
                  {activeSession?.customer_name || guestNameInput || "Guest Diner"}
                </h2>
                <p className="text-xs text-stone-400">
                  {activeSession?.is_phone_verified
                    ? `+91 ${activeSession.customer_phone} • ${phoneDiscountPct}% VIP Discount Active`
                    : `Table #${selectedTableNumber} • Guest Session`}
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    icon: <ReceiptText className="w-4 h-4 text-[#141414]" />,
                    label: "View Bill & Thermal Tax Invoice",
                    sub: "Preview detailed bill breakdown or print receipt",
                    onClick: () => setReceiptModalOpen(true),
                  },
                  {
                    icon: <Tag className="w-4 h-4 text-[#141414]" />,
                    label: "Live Order Status & 1-Tap Repeat",
                    sub: activeOrder
                      ? `Order ${activeOrder.status.toUpperCase()} • ${formatPaise(activeOrder.total_paise)}`
                      : "View active table order",
                    onClick: () => setActiveTab("order"),
                  },
                  {
                    icon: <Bell className="w-4 h-4 text-[#141414]" />,
                    label: "Request Water, Cutlery & Table Service",
                    sub: "Free mineral water, extra tissues, runner",
                    onClick: () => setEssentialsModalOpen(true),
                  },
                  {
                    icon: <CreditCard className="w-4 h-4 text-[#141414]" />,
                    label: `Complete Dining & Claim +${reviewDiscountPct}% Review Discount`,
                    sub: "Generate final bill when you finish dining",
                    onClick: () => {
                      setMealCompletedScreen(true);
                      setActiveTab("order");
                    },
                  },
                  {
                    icon: <LogOut className="w-4 h-4 text-rose-500" />,
                    label: "Switch Table / Re-login",
                    sub: `Currently Table #${selectedTableNumber}`,
                    onClick: () => setEntryStep("welcome"),
                  },
                ].map((row, idx) => (
                  <button
                    key={idx}
                    onClick={row.onClick}
                    className="w-full bg-white hover:bg-stone-50 rounded-2xl p-4 shadow-xs border border-stone-100 flex items-center justify-between text-left transition"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#F7F5F2] flex items-center justify-center shrink-0">
                        {row.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#141414] truncate">{row.label}</div>
                        <div className="text-[11px] text-stone-400 truncate mt-0.5">{row.sub}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* FLOATING CART BAR WITH GUEST CONFIRMATION (Bug #8)                   */}
        {/* ==================================================================== */}
        {cart.length > 0 && activeTab !== "cart" && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-[400px] px-3 animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1E201F] text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between border border-stone-700/60 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {totalCartItems}
                </div>
                <div>
                  <div className="text-xs font-extrabold">
                    {formatPaise(cartPreview?.total_paise || cart.reduce((s, c) => s + c.display_unit_paise * c.qty, 0))}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold">
                    {activeSession?.is_phone_verified ? `-${phoneDiscountPct}% VIP applied` : `${totalCartItems} dishes in bag`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Inline Guest confirmation count selector */}
                <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-xl text-[11px] text-stone-300 border border-stone-700">
                  <span className="text-[10px] text-stone-400">Guests:</span>
                  <button
                    type="button"
                    onClick={() => setGuestCountInput(Math.max(1, guestCountInput - 1))}
                    className="w-4 h-4 flex items-center justify-center hover:text-white"
                  >
                    -
                  </button>
                  <span className="font-extrabold text-white px-0.5">{guestCountInput}</span>
                  <button
                    type="button"
                    onClick={() => setGuestCountInput(guestCountInput + 1)}
                    className="w-4 h-4 flex items-center justify-center hover:text-white"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab("cart")}
                  className="px-3 py-1.5 rounded-xl font-extrabold text-xs text-white shadow-xs flex items-center gap-1 active:scale-95 transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>View Bag</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* FLOATING PILL NAVIGATION BAR (Orbix Studio Style)                    */}
        {/* ==================================================================== */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-[#141414] text-white rounded-full p-1.5 px-3 shadow-[0_20px_50px_rgba(20,20,20,0.32)] flex items-center gap-2 sm:gap-3">
            {[
              { id: "home", icon: <Home className="w-4 h-4" />, label: "Menu" },
              { id: "offers", icon: <Tag className="w-4 h-4" />, label: "AI Concierge" },
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
                      ? "w-10 h-10 rounded-full text-white shadow-md"
                      : "w-9 h-9 rounded-full text-stone-400 hover:text-white"
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : {}}
                  title={nav.label}
                >
                  {nav.icon}
                  {nav.badge ? (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-[#141414] text-[9px] font-bold flex items-center justify-center">
                      {nav.badge}
                    </span>
                  ) : nav.dot ? (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: THERMAL INVOICE & PRINT RECEIPT (Bug #6)                    */}
      {/* ==================================================================== */}
      {receiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-stone-100">
            <div className="flex items-center justify-between pb-2 border-b border-dashed border-stone-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Tax Invoice & Bill
                </span>
                <h3 className="text-base font-extrabold text-[#141414]">
                  {restaurant?.name || "Shree Ram Dhaba"}
                </h3>
              </div>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-xs text-stone-700 space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-200/70">
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>Date: {new Date().toLocaleDateString("en-IN")}</span>
                <span>Table: #{selectedTableNumber}</span>
              </div>
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>Guest: {activeSession?.customer_name || guestNameInput || "Valued Diner"}</span>
                <span>Bill: #{activeOrder?.id?.slice(-6).toUpperCase() || "ORD-LIVE"}</span>
              </div>
              <div className="border-t border-dashed border-stone-300 my-2" />

              <div className="space-y-1.5">
                {(activeOrder?.items || cart).map((it: any, i: number) => (
                  <div key={i} className="flex justify-between items-start">
                    <span className="truncate max-w-[180px]">
                      {it.name.replace(" (3D View)", "")} x{it.qty}
                    </span>
                    <span className="font-bold">
                      {formatPaise((it.display_unit_paise || it.unit_price_paise || 0) * it.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-stone-300 my-2" />
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>{formatPaise(activeOrder?.subtotal_paise || cartPreview?.subtotal_paise || 0)}</span>
              </div>
              {activeSession?.is_phone_verified && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>VIP Phone Discount ({phoneDiscountPct}%)</span>
                  <span>-{formatPaise(activeOrder?.phone_discount_paise || cartPreview?.discount_paise || 0)}</span>
                </div>
              )}
              {activeOrder?.review_discount_paise > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Google Review Bonus ({reviewDiscountPct}%)</span>
                  <span>-{formatPaise(activeOrder.review_discount_paise)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500">
                <span>GST (5%)</span>
                <span>{formatPaise(activeOrder?.tax_paise || cartPreview?.tax_paise || 0)}</span>
              </div>
              <div className="border-t-2 border-stone-800 pt-2 flex justify-between font-extrabold text-sm text-[#141414]">
                <span>TOTAL DUE</span>
                <span>{formatPaise(activeOrder?.total_paise || cartPreview?.total_paise || 0)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-full bg-[#141414] hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save Receipt</span>
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-5 py-3 rounded-full bg-stone-100 hover:bg-stone-200 text-[#141414] font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: GEMINI 2.5 FLASH AI SMART WAITER (Bug #7)                   */}
      {/* ==================================================================== */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[36px] sm:rounded-[36px] max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4 border border-stone-100 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#141414]">AI Smart Waiter • {restaurant?.name}</h3>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Google Gemini 2.5 Flash & ElevenLabs Spoken Voice
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Response Dialogue Box */}
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-stone-200/70 text-xs text-stone-700 leading-relaxed flex items-start gap-3">
              <span className="text-xl">🤖</span>
              <div>
                <div className="font-bold text-[#141414] mb-0.5">AI Waiter Response</div>
                <div>
                  {aiFeedback ||
                    `Namaste! Main aapka AI Smart Waiter hoon. Aap "hello" bol sakte hain ya sidha "2 Dal Makhani aur 4 Butter Naan" bolkar order kar sakte hain!`}
                </div>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleAiOrderParse} className="space-y-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVoiceMic}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition shadow-xs ${
                    listening ? "bg-rose-500 text-white animate-pulse" : "bg-stone-100 text-[#141414]"
                  }`}
                  title="Speak in Hindi/Hinglish"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Type 'hello', or '2 dal makhani aur 3 naan'..."
                  className="flex-1 bg-stone-100 rounded-2xl px-4 py-3 text-xs font-semibold text-[#141414] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiBusy}
                  className="px-5 rounded-2xl text-white text-xs font-bold shadow-md transition shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {aiBusy ? "Thinking..." : "Send"}
                </button>
              </div>

              {/* Sample Quick Action Pills */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {["hello", "kya special hai?", "2 dal makhani aur 4 naan", "kuch meetha batao"].map((sample) => (
                  <button
                    type="button"
                    key={sample}
                    onClick={() => {
                      setAiInput(sample);
                    }}
                    className="px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-[10px] font-semibold whitespace-nowrap transition"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: INTERACTIVE 3D FOOD VIEWER                                  */}
      {/* ==================================================================== */}
      {active3DItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-stone-100">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                  Interactive 3D Dish View
                </span>
                <h3 className="text-base font-bold text-[#141414]">{active3DItem.name}</h3>
              </div>
              <button
                onClick={() => setActive3DItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-64 rounded-2xl bg-gradient-to-b from-[#F7F5F2] to-[#ECE7DE] flex items-center justify-center overflow-hidden">
              <model-viewer
                src={active3DItem.model_3d_url}
                alt={active3DItem.name}
                auto-rotate
                camera-controls
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <p className="text-xs text-stone-500">{active3DItem.description}</p>

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
                showToast(`Added ${active3DItem.name.replace(" (3D View)", "")} to bag`);
              }}
              className="w-full py-3.5 rounded-full text-white font-bold text-xs shadow-md transition"
              style={{ backgroundColor: primaryColor }}
            >
              Add to Bag • {formatPaise(active3DItem.display_price_paise)}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: TABLE ESSENTIALS REQUESTS                                   */}
      {/* ==================================================================== */}
      {essentialsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[36px] sm:rounded-[36px] max-w-sm w-full p-6 shadow-2xl space-y-4 border border-stone-100 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-bold text-[#141414]">Request Table Essentials</h3>
              <button
                onClick={() => setEssentialsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { type: "water", label: "Fresh RO Water", icon: "💧" },
                { type: "tissues", label: "Tissues & Napkins", icon: "🧻" },
                { type: "cutlery", label: "Forks & Spoons", icon: "🍴" },
                { type: "chutney", label: "Green Chutney & Onions", icon: "🧅" },
                { type: "clean_table", label: "Wipe Table", icon: "🧽" },
                { type: "call_waiter", label: "Call Runner", icon: "🙋" },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() =>
                    handleServiceRequest(
                      item.type as any,
                      item.label
                    )
                  }
                  className="p-3.5 rounded-2xl bg-stone-50 hover:bg-[#141414] hover:text-white border border-stone-100 text-left transition flex flex-col justify-between h-20 group"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs font-bold text-[#141414] group-hover:text-white leading-tight">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
