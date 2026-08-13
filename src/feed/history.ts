import type { Quote } from "./types";

/*
 * A per-session price tape, persisted for the trading day.
 *
 * Finnhub's free tier has no intraday candle endpoint, so the 1D chart (and the
 * detail-drawer sparkline) draw from the prices we've already seen: every poll
 * appends the latest tick per symbol here. To keep the day chart from vanishing
 * on a hard refresh, the tape is saved to localStorage and restored on load —
 * but only while it's still the same trading day (America/New_York). A new day
 * starts a fresh tape.
 */

export interface Tick {
  /** Epoch milliseconds. */
  t: number;
  price: number;
}

// Enough points to cover a full regular session at the live 15s cadence
// (~6.5h ≈ 1560 ticks) with headroom; older points roll off.
const MAX_POINTS = 1600;
// Collapse ticks closer together than this, so a fast simulated feed doesn't
// pack the tape with near-identical points.
const MIN_GAP_MS = 750;
// Throttle persistence so we're not writing localStorage on every tick.
const SAVE_EVERY_MS = 4000;
const STORE_KEY = "bramwell.tape.v1";

const tape = new Map<string, Tick[]>();
/** The ET trading day the current tape belongs to (YYYY-MM-DD). */
let tapeDay = "";
let lastSave = 0;

/** Today's date in America/New_York as YYYY-MM-DD — the trading-day key. */
function etDay(): string {
  try {
    // en-CA renders as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function persist(): void {
  if (!hasStorage()) return;
  try {
    const obj: Record<string, Tick[]> = {};
    tape.forEach((ticks, sym) => {
      obj[sym] = ticks;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify({ day: tapeDay, tape: obj }));
  } catch {
    /* quota exceeded or unavailable — the tape simply won't survive reload */
  }
}

/** Restore the tape from localStorage if it belongs to the current trading day. */
function restore(): void {
  tapeDay = etDay();
  if (!hasStorage()) return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { day?: string; tape?: Record<string, Tick[]> };
    if (parsed?.day && parsed.day === tapeDay && parsed.tape) {
      for (const [sym, ticks] of Object.entries(parsed.tape)) {
        if (Array.isArray(ticks)) {
          tape.set(
            sym,
            ticks.filter(
              (t) => t && typeof t.t === "number" && typeof t.price === "number",
            ),
          );
        }
      }
    } else {
      // A stale day (or malformed) — drop it so a new session starts clean.
      localStorage.removeItem(STORE_KEY);
    }
  } catch {
    /* ignore a corrupt payload */
  }
}

restore();

// Flush the freshest ticks when the page is hidden or closed, so a reload keeps
// right up to the last quote rather than only the last throttled save.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persist);
  window.addEventListener("visibilitychange", () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") persist();
  });
}

/** Append the latest price for each quoted symbol. */
export function recordQuotes(quotes: Quote[], now: number): void {
  // Roll the tape over at the trading-day boundary.
  const today = etDay();
  if (today && today !== tapeDay) {
    tape.clear();
    tapeDay = today;
    if (hasStorage()) {
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  for (const q of quotes) {
    if (!Number.isFinite(q.price) || q.price <= 0) continue;
    const series = tape.get(q.symbol) ?? [];
    const last = series[series.length - 1];
    if (last && now - last.t < MIN_GAP_MS) {
      last.price = q.price; // refresh the most recent point rather than crowd it
    } else {
      series.push({ t: now, price: q.price });
      if (series.length > MAX_POINTS) series.shift();
    }
    tape.set(q.symbol, series);
  }

  if (now - lastSave > SAVE_EVERY_MS) {
    lastSave = now;
    persist();
  }
}

/** The accumulated intraday series for a symbol (oldest first). */
export function priceSeries(symbol: string): Tick[] {
  return tape.get(symbol.toUpperCase()) ?? [];
}
