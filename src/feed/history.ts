import type { Quote } from "./types";

/*
 * A tiny in-session price tape.
 *
 * Finnhub's free tier has no intraday candle endpoint, so rather than invent a
 * price path we simply keep the prices we've already seen: every poll appends
 * the latest tick per symbol here, and the detail drawer draws a sparkline from
 * whatever has accumulated this session. It starts empty and fills as the app
 * runs — honest, if modest. Nothing is persisted; a reload starts a fresh tape.
 */

export interface Tick {
  /** Epoch milliseconds. */
  t: number;
  price: number;
}

// Cap per symbol so a long session can't grow without bound (~an hour at the
// 15s live cadence, far more at the simulated 1.6s).
const MAX_POINTS = 240;
// Collapse ticks closer together than this, so a fast simulated feed doesn't
// pack the tape with near-identical points.
const MIN_GAP_MS = 750;

const tape = new Map<string, Tick[]>();

/** Append the latest price for each quoted symbol. */
export function recordQuotes(quotes: Quote[], now: number): void {
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
}

/** The accumulated intraday series for a symbol (oldest first). */
export function priceSeries(symbol: string): Tick[] {
  return tape.get(symbol.toUpperCase()) ?? [];
}
