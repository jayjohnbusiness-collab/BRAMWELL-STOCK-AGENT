/*
 * Speech normalization.
 *
 * Bramwell's replies are written to read well on screen, where compact units
 * are fine ("8h 30m", "3h ago", "20d", "$100/mo"). Read aloud verbatim, a
 * text-to-speech engine says "eight h" — so before a line is spoken (and only
 * then; the on-screen text is untouched) the compact forms are expanded to
 * their spoken words: "eight hours thirty minutes", "three hours ago", and so
 * on. Pure and synchronous, so it's testable without a voice.
 */

/** "1 hour", "8 hours" — a count with a naturally pluralized unit. */
function plural(n: string, unit: string): string {
  return `${n} ${unit}${n === "1" ? "" : "s"}`;
}

const NUM = "(\\d+(?:\\.\\d+)?)";

export function forSpeech(text: string): string {
  let s = text;

  // Duration countdown "Xh Ym" → "X hours Y minutes" (handled before the lone
  // units below so the pair isn't split).
  s = s.replace(new RegExp(`\\b${NUM}\\s*h\\s+${NUM}\\s*m\\b`, "gi"), (_m, h, mn) =>
    `${plural(h, "hour")} ${plural(mn, "minute")}`,
  );
  // Lone units. "h"/"d"/"w" are unambiguous; "m"/"s" are treated as time here
  // because Bramwell never abbreviates millions/seconds any other way aloud.
  s = s.replace(new RegExp(`\\b${NUM}\\s*h\\b`, "gi"), (_m, n) => plural(n, "hour"));
  s = s.replace(new RegExp(`\\b${NUM}\\s*m\\b`, "gi"), (_m, n) => plural(n, "minute"));
  s = s.replace(new RegExp(`\\b${NUM}\\s*d\\b`, "gi"), (_m, n) => plural(n, "day"));
  s = s.replace(new RegExp(`\\b${NUM}\\s*w\\b`, "gi"), (_m, n) => plural(n, "week"));
  s = s.replace(new RegExp(`\\b${NUM}\\s*s\\s+ago\\b`, "gi"), (_m, n) => `${plural(n, "second")} ago`);

  // Per-period suffixes.
  s = s.replace(/\/\s*mo\b/gi, " a month").replace(/\/\s*yr\b/gi, " a year").replace(/\/\s*wk\b/gi, " a week");

  // Symbols a TTS engine skips or mispronounces.
  s = s.replace(/σ/g, " sigma").replace(/ρ/g, " rho").replace(/Δ/g, " change ");
  s = s.replace(/\bvs\.?\b/gi, "versus");
  s = s.replace(/%/g, " percent");

  return s.replace(/\s{2,}/g, " ").trim();
}
