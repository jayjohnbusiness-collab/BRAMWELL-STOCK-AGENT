import type { Feed, Quote } from "./types";
import { SEED } from "../agent/seed";

/*
 * A real market-data adapter (Finnhub).
 *
 * This is the proof that the seam holds: the same brain runs against live
 * prices with no changes. Notes and limits, kept honest:
 *   - The free-tier quote endpoint is one call per symbol; we fan out and drop
 *     any that fail rather than failing the whole poll.
 *   - Indices aren't covered on the free tier, so we skip them and leave those
 *     rows to their registry defaults.
 *   - Prior-session change isn't in the quote payload; it's left untouched.
 *   - Cause is not the feed's job: the attributor (attribution/finnhub.ts)
 *     supplies it from company news. This adapter only reports price and move.
 *   - The token rides in the query string, which is fine for a dev scaffold;
 *     a production deployment should proxy this through a backend.
 */
const BASE = "https://finnhub.io/api/v1";

export class FinnhubFeed implements Feed {
  readonly name = "finnhub";
  // ~11 symbols per poll → ~44 calls/min, under Finnhub's free 60/min ceiling.
  readonly pollMs = 15_000;

  constructor(private readonly token: string) {}

  async quotes(symbols: string[]): Promise<Quote[]> {
    const equities = symbols.filter((s) => !isIndex(s));
    const results = await Promise.all(equities.map((s) => this.one(s)));
    return results.filter((q): q is Quote => q !== null);
  }

  private async one(symbol: string): Promise<Quote | null> {
    try {
      const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.token}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = (await res.json()) as { c?: number; dp?: number };
      // c = current price, dp = percent change. A zero current price on this
      // endpoint means "no data for this symbol", not a real quote.
      if (typeof d.c !== "number" || d.c === 0) return null;
      // Cause is left to the attributor (company news), not the price feed.
      // Omitting it here keeps any attributed cause intact across polls.
      return {
        symbol,
        price: d.c,
        changePct: typeof d.dp === "number" ? d.dp : 0,
      };
    } catch {
      return null; // keep calm; the next poll will try again
    }
  }
}

function isIndex(symbol: string): boolean {
  return SEED.some((i) => i.symbol === symbol && i.kind === "index");
}
