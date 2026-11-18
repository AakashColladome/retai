import React, { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Globe, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { AppRole } from "@/store/useAppStore";

let currentAudio: HTMLAudioElement | null = null;

export async function speakWithElevenLabs(
  text: string,
  lang: "hi" | "en" = "hi",
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    onStart?.();
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });

    if (!res.ok) {
      throw new Error("TTS API fallback");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      onEnd?.();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      onEnd?.();
    };
    await audio.play();
  } catch {
    // Fallback to browser SpeechSynthesis if audio fails
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
      utter.onend = () => onEnd?.();
      utter.onerror = () => onEnd?.();
      window.speechSynthesis.speak(utter);
    } else {
      onEnd?.();
    }
  }
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

interface RoleGuideBotProps {
  role: AppRole;
  restaurantName: string;
  tableNumber?: number;
  phoneDiscountPct?: number;
  reviewDiscountPct?: number;
}

export const RoleGuideBot: React.FC<RoleGuideBotProps> = ({
  role,
  restaurantName,
  tableNumber = 1,
  phoneDiscountPct = 5,
  reviewDiscountPct = 2,
}) => {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [speaking, setSpeaking] = useState(false);
  const greetedRef = useRef<string>("");

  const getGuideContent = () => {
    const rName = restaurantName || "Shree Ram Dhaba";

    if (role === "customer") {
      return {
        titleHi: `🤖 RetAI Dost — ${rName} गाइड`,
        titleEn: `🤖 RetAI Guide — ${rName} Concierge`,
        speechHi: `नमस्कार! आपका ${rName} में हार्दिक स्वागत है। टेबल नंबर ${tableNumber} पर आप अपना मोबाइल नंबर वेरीफाई करके ${phoneDiscountPct} प्रतिशत की तुरंत छूट पा सकते हैं। आप बिना वेटर को बुलाए कभी भी एक टैप में गरमा-गरम रोटी या डिश रिपीट कर सकते हैं। जब आपका लंच या डिनर पूरा हो जाए, तब मील कंप्लीट दबाएं और गूगल रिव्यू देकर ${reviewDiscountPct} प्रतिशत अतिरिक्त छूट पाएं!`,
        speechEn: `Namaskar and welcome to ${rName} at Table number ${tableNumber}! Verify your mobile number for an instant ${phoneDiscountPct} percent discount. You can repeat chapatis or dishes in one tap anytime without calling a waiter. Once you complete your lunch or dinner, tap Complete Meal and leave a Google Review for an extra ${reviewDiscountPct} percent off!`,
        stepsHi: [
          `1. मोबाइल वेरीफाई करें (${phoneDiscountPct}% छूट) या Guest चुनें`,
          "2. मेनू से ऑर्डर करें या 2D मैप में वॉशरूम/हैंडवॉश की दिशा देखें",
          "3. खाने के बीच में 1-Tap से गरम रोटी/चपाती तुरंत रिपीट करें",
          `4. खाना पूरा होने पर 'Lunch/Dinner Complete' दबाएं और Google Review से +${reviewDiscountPct}% छूट पाएं`,
        ],
        stepsEn: [
          `1. Verify mobile (${phoneDiscountPct}% off) or continue as Guest`,
          "2. Order dishes or check 2D Floor Map for Washroom & Handwash path",
          "3. Use 1-Tap Repeat anytime to add hot Chapatis/Rotis without waiting",
          `4. Tap 'Complete Lunch/Dinner' when done & get +${reviewDiscountPct}% off via Google Review`,
        ],
      };
    }

    if (role === "kitchen") {
      return {
        titleHi: "🤖 किचन (KDS) गाइड बॉट",
        titleEn: "🤖 Kitchen KDS Guide Bot",
        speechHi: `नमस्कार उस्ताद जी! यह ${rName} का किचन डिस्प्ले पोर्टल है। यहाँ आपको केवल किचन के लाइव ऑर्डर, रिपीट रोटी के प्रायोरिटी टैग और कुकिंग टाइमर दिखेंगे। आप भीड़ के हिसाब से समय घटा या बढ़ा सकते हैं और खाना तैयार होने पर रेडी दबा सकते हैं।`,
        speechEn: `Welcome to ${rName}'s Kitchen Display Portal! Here you see strictly kitchen cooking tickets, 1-tap repeat chapati priority badges, and prep timers. Adjust ETA with +2m or +5m and mark orders Ready when plated.`,
        stepsHi: [
          "1. यहाँ केवल किचन के लाइव ऑर्डर और कंडीमेंट रिक्वेस्ट दिखती हैं",
          "2. 'REPEAT' बैज वाले ऑर्डर (जैसे एक्स्ट्रा चपाती) को प्राथमिकता दें",
          "3. भीड़ के अनुसार -2m / +2m / +5m से समय अपडेट करें",
          "4. खाना पकने पर Queued → Preparing → Ready → Served दबाएं",
        ],
        stepsEn: [
          "1. Displays strictly kitchen tickets & condiment requests (no floor clutter)",
          "2. Prioritize tickets marked with the REPEAT chapati/item badge",
          "3. Override prep ETA (-2m / +2m / +5m) to sync live with the customer's screen",
          "4. Progress ticket stages: Queued → Preparing → Ready → Served",
        ],
      };
    }

    if (role === "manager") {
      return {
        titleHi: "🤖 फ्लोर मैनेजर गाइड बॉट",
        titleEn: "🤖 Floor Manager Guide Bot",
        speechHi: `नमस्कार मैनेजर साहब! इस पोर्टल से आप ${rName} का लाइव टेबल मैप देख सकते हैं। लाल का मतलब टेबल खाली है, हरा का मतलब मेहमान बैठे हैं, और एम्बर अलर्ट तब बजेगा जब मेहमान बैठने के बाद ऑर्डर न करें। आप 2D फ्लोर मैप में टेबल और वॉशरूम की जगह सेट कर सकते हैं और डिस्काउंट प्रतिशत भी तय कर सकते हैं।`,
        speechEn: `Welcome Floor Manager! Monitor Red, Green, and Amber table occupancy in real time, configure the 2D Floor Plan with table and washroom coordinates, and adjust customer mobile and Google Review discount percentages.`,
        stepsHi: [
          "1. Red = खाली, Green = मेहमान बैठे हैं, Amber = बिना ऑर्डर के प्रतीक्षा",
          "2. 2D Floor Setup में टेबल और वॉशरूम/हैंडवॉश की सटीक लोकेशन सेट करें",
          `3. Discounts टैब से मोबाइल (${phoneDiscountPct}%) और Google Review (+${reviewDiscountPct}%) छूट तय करें`,
          "4. गेस्ट के 1-Tap पानी/कटलरी रिक्वेस्ट को तुरंत पूरा करें",
        ],
        stepsEn: [
          "1. Red = Empty, Green = Seated, Amber = Seated past threshold without ordering",
          "2. Place Tables & Washroom pins on the 2D Floor Map so guests see directions",
          `3. Adjust Mobile (${phoneDiscountPct}%) & Google Review (+${reviewDiscountPct}%) discount rules`,
          "4. Fulfill live 1-Tap guest water & cutlery requests",
        ],
      };
    }

    if (role === "owner") {
      return {
        titleHi: "🤖 रेस्टोरेंट एडमिन / ओनर गाइड बॉट",
        titleEn: "🤖 Restaurant Admin / Owner Guide Bot",
        speechHi: `नमस्कार ओनर साहब! ${rName} के एडमिन पोर्टल में आपका स्वागत है। यहाँ से आप तय करते हैं कि रेस्टोरेंट में कितनी टेबल हैं, वॉशरूम और किचन कहाँ है, किस स्टाफ डिपार्टमेंट को View या Edit का अधिकार है, और ग्राहक को मोबाइल या गूगल रिव्यू पर कितने प्रतिशत छूट देनी है।`,
        speechEn: `Welcome Restaurant Owner! From this portal you control your 2D Floor Map & Washroom locations, department RBAC View and Edit access permissions, customer discount percentages, menu pricing, and read-only settlement reports.`,
        stepsHi: [
          "1. Floor & Washroom Map: तय करें कि कौन सी टेबल और वॉशरूम कहाँ स्थित है",
          "2. RBAC Access Control: मैनेजर, किचन और वेटर को View/Edit अधिकार दें",
          "3. Discounts Config: मोबाइल वेरीफिकेशन और Google Review छूट % बदलें",
          "4. Analytics & Settlement: बेस्ट सेलर और अपना नेट सेटलमेंट देखें",
        ],
        stepsEn: [
          "1. Floor & Washroom Map: Define exact table coordinates & washroom pins",
          "2. RBAC Access Control: Grant View/Edit permissions per staff department",
          "3. Discounts Config: Set Mobile OTP % and Google Review +2% reward",
          "4. Analytics & Settlements: Audit best sellers and net restaurant payouts",
        ],
      };
    }

    return {
      titleHi: "🤖 सुपर एडमिन (Platform HQ) गाइड बॉट",
      titleEn: "🤖 Super Admin Platform Guide Bot",
      speechHi: `नमस्कार सुपर एडमिन! यहाँ से आप नए रेस्टोरेंट ऑनबोर्ड कर सकते हैं और प्लेटफ़ॉर्म का कमीशन या हिडन प्रॉफिट शेयर फॉर्मूला तय कर सकते हैं। यह प्लेटफ़ॉर्म चार्ज केवल आपको दिखता है, रेस्टोरेंट के ओनर, मैनेजर या ग्राहक को कभी नहीं दिखता।`,
      speechEn: `Welcome Super Admin! Onboard new white-label restaurants and configure your confidential platform profit-share markup or AMC fee. Platform charges are visible exclusively to Super Admin and never shown to restaurant staff or customers.`,
      stepsHi: [
        "1. नए ढाबे, कैफे या होटल को 1-क्लिक में ऑनबोर्ड करें",
        "2. Profit-Share (Hidden Markup %) या One-Time + AMC मॉडल चुनें",
        "3. प्लेटफ़ॉर्म कमीशन ओनर या मैनेजर को कभी नहीं दिखाया जाता",
        "4. ग्लोबल लेजर में हर ऑर्डर पर अपना कमीशन और रेस्टोरेंट का हिस्सा देखें",
      ],
      stepsEn: [
        "1. Onboard new white-label restaurants, cafes, or dhabas in seconds",
        "2. Configure Profit-Share (Hidden Menu Markup %) vs One-Time + AMC",
        "3. Platform commission is strictly hidden from restaurant owners & managers",
        "4. Audit global GMV and your exact platform cut in integer paise",
      ],
    };
  };

  const content = getGuideContent();
  const activeSpeech = lang === "hi" ? content.speechHi : content.speechEn;
  const activeSteps = lang === "hi" ? content.stepsHi : content.stepsEn;

  const handleToggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speakWithElevenLabs(
        activeSpeech,
        lang,
        () => setSpeaking(true),
        () => setSpeaking(false)
      );
    }
  };

  // Auto-greet on Customer QR scan / welcome load when user interacts
  useEffect(() => {
    const key = `${role}:${restaurantName}`;
    if (role === "customer" && greetedRef.current !== key) {
      greetedRef.current = key;
    }
  }, [role, restaurantName]);

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start">
      {open && (
        <div className="mb-3 w-80 sm:w-96 rounded-[28px] bg-white border border-stone-200 shadow-[0_24px_60px_rgba(0,0,0,0.16)] p-5 text-[#222423] space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#222423] text-[#9FE870] flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#222423]">
                  {lang === "hi" ? content.titleHi : content.titleEn}
                </h4>
                <span className="text-[10px] text-stone-400 font-medium">
                  ElevenLabs AI Voice • Hindi & English
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const nextLang = lang === "hi" ? "en" : "hi";
                  setLang(nextLang);
                  if (speaking) {
                    stopSpeaking();
                    setSpeaking(false);
                  }
                }}
                className="px-2.5 py-1 rounded-full bg-[#F3F4F3] hover:bg-[#222423] text-[#222423] hover:text-white text-[10px] font-bold transition flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                {lang === "hi" ? "🇮🇳 हिंदी" : "🇬🇧 EN"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F3F4F3] flex items-center justify-center text-stone-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-stone-600 bg-[#F6F8F6] p-3.5 rounded-2xl border border-stone-200/70 leading-relaxed">
            "{activeSpeech}"
          </p>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {lang === "hi" ? "यह पोर्टल कैसे काम करता है:" : "How This Flow Works:"}
            </div>
            {activeSteps.map((st, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px] text-[#222423] font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#65A30D] shrink-0 mt-0.5" />
                <span>{st}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleToggleSpeech}
            className={`w-full py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              speaking
                ? "bg-rose-600 text-white"
                : "bg-[#222423] hover:bg-[#333634] text-[#9FE870]"
            }`}
          >
            {speaking ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>{lang === "hi" ? "आवाज़ रोकें (Stop Voice)" : "Stop Speaking"}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>
                  {lang === "hi"
                    ? "🔊 हिंदी में सुनें (Play Voice Guide)"
                    : "🔊 Listen in English (ElevenLabs)"}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Floating Guide Bot Trigger Pill */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#222423] text-white text-xs font-semibold shadow-xl hover:scale-[1.02] transition border border-white/10"
        >
          <span className="w-6 h-6 rounded-full bg-[#9FE870] text-[#222423] flex items-center justify-center">
            <Bot className="w-3.5 h-3.5" />
          </span>
          <span>{lang === "hi" ? "AI गाइड (हिंदी/EN)" : "AI Guide Bot"}</span>
        </button>

        <button
          onClick={handleToggleSpeech}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition border ${
            speaking
              ? "bg-[#9FE870] text-[#222423] border-[#222423] animate-pulse"
              : "bg-white text-[#222423] border-stone-200 hover:bg-[#9FE870]"
          }`}
          title="Speak Guide in Hindi / English (ElevenLabs)"
        >
          {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
