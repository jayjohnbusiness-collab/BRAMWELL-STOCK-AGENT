import type { Instrument, Sign } from "./types";

/*
 * Formatting.
 *
 * The same fact is delivered twice, differently (conversation spec §4):
 *   - Spoken: rounded and read naturally — "up seven percent".
 *   - Screen: exact and tabular — "+7.21%".
 *
 * Every change value carries a written sign as well as a color, so the
 * information survives for colorblind users and for the ear.
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

/** Whole numbers 0–99 in words. Enough for percentages read aloud. */
export function numberToWords(n: number): string {
  const x = Math.abs(Math.round(n));
  if (x < 20) return ONES[x];
  if (x < 100) {
    const t = Math.floor(x / 10);
    const o = x % 10;
    return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
  }
  return String(x); // beyond spoken range; fall back to the digits
}

/**
 * A percentage read aloud, rounded to the nearest half:
 *   7.21 → "seven percent", 4.53 → "four and a half percent".
 */
export function percentInWords(pct: number): string {
  const abs = Math.abs(pct);
  const halves = Math.round(abs * 2) / 2;
  const whole = Math.floor(halves);
  const half = halves - whole >= 0.5;
  if (whole === 0 && half) return "half a percent";
  if (whole === 0) return "flat";
  const wordy = numberToWords(whole);
  return half ? `${wordy} and a half percent` : `${wordy} percent`;
}

/** The bare magnitude in words, for list continuations: "seven", "four and a half". */
export function magnitudeInWords(pct: number): string {
  const abs = Math.abs(pct);
  const halves = Math.round(abs * 2) / 2;
  const whole = Math.floor(halves);
  const half = halves - whole >= 0.5;
  if (whole === 0 && half) return "a half";
  if (whole === 0) return "flat";
  const wordy = numberToWords(whole);
  return half ? `${wordy} and a half` : wordy;
}

export function direction(pct: number): "up" | "down" | "flat" {
  if (pct > 0.05) return "up";
  if (pct < -0.05) return "down";
  return "flat";
}

/** Spoken change: "up seven percent", "down two percent", "unchanged". */
export function spokenChange(pct: number): string {
  const dir = direction(pct);
  if (dir === "flat") return "unchanged";
  return `${dir} ${percentInWords(pct)}`;
}

export function sign(pct: number): Sign {
  if (pct > 0) return "+";
  if (pct < 0) return "-";
  return "";
}

/** Exact, on-screen percent with an explicit written sign: "+7.21%". */
export function exactPercent(pct: number): string {
  const s = pct > 0 ? "+" : pct < 0 ? "−" : ""; // U+2212 minus
  return `${s}${Math.abs(pct).toFixed(2)}%`;
}

/** Live price for the screen, e.g. "1,642.10". Tabular figures do the aligning. */
export function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** The live price implied by base price and today's percent change. */
export function livePrice(instrument: Instrument): number {
  return instrument.basePrice;
}
