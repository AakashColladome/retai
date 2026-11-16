import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an integer paise amount received from the server into INR display string.
 * Note: All pricing, markup, 5% discount, and GST calculations happen strictly server-side.
 */
export function formatPaise(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || Number.isNaN(paise)) {
    return "₹0";
  }
  const rupees = paise / 100;
  if (paise % 100 === 0) {
    return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Plays a two-tone alert chime on the Manager Console when a table transitions to Amber
 * (seated beyond threshold with no order placed) or when a service request arrives.
 */
export function playAlertChime(type: "amber" | "order" | "service" = "amber") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = type === "amber" ? "triangle" : "sine";
    osc1.frequency.setValueAtTime(type === "amber" ? 587.33 : 523.25, now); // D5 or C5
    osc1.frequency.setValueAtTime(type === "amber" ? 880.0 : 659.25, now + 0.16); // A5 or E5

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.55);
  } catch {
    // Ignore audio autoplay block if user hasn't interacted yet
  }
}

export function applyTenantThemeVars(theme?: {
  primary_color?: string;
  accent_color?: string;
  bg_color?: string;
}) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primary_color) root.style.setProperty("--brand-primary", theme.primary_color);
  if (theme.accent_color) root.style.setProperty("--brand-accent", theme.accent_color);
  if (theme.bg_color) root.style.setProperty("--brand-bg", theme.bg_color);
}
