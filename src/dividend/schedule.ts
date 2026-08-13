/*
 * Dividend date projection.
 *
 * Finnhub's free tier doesn't expose a forward dividend calendar, so we project
 * the next quarterly ex-date and pay-date from a per-symbol phase — spread so
 * different names land on different upcoming dates. Deterministic and time-
 * injected, so it's testable. When a feed *can* supply real dates, it uses
 * those instead; these fill the gap and are labelled "estimated".
 */

const DAY = 86_400_000;
const QUARTER = 91 * DAY;
// A fixed reference so the projection is stable run to run.
const ANCHOR = Date.UTC(2021, 0, 4);
const PAY_LAG = 18 * DAY; // pay date trails the ex-date by ~2.5 weeks

/** A stable 0–90 day phase from the symbol, so payers don't all clump. */
export function hashPhase(symbol: string): number {
  let h = 0;
  const s = symbol.toUpperCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 91;
}

function iso(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/** The next ex-date and pay-date at/after `nowMs` for a symbol's phase. */
export function projectDates(seed: number, nowMs: number): { exDate: string; payDate: string } {
  let ex = ANCHOR + seed * DAY;
  while (ex <= nowMs) ex += QUARTER;
  return { exDate: iso(ex), payDate: iso(ex + PAY_LAG) };
}
