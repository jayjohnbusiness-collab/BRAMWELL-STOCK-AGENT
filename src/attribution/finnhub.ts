import type { Cause } from "../agent/types";
import type { Attributor, AttributionInput, NewsItem } from "./types";
import { attributeFromNews } from "./attribute";

/*
 * The real attributor (Finnhub company-news).
 *
 * It fetches recent company news and runs the same pure rule as the simulated
 * one, so the anti-fabrication guarantee is identical: a grounded cause from a
 * real headline, or null. It never generates prose about the move — it only
 * relays what a named outlet actually published, and flags thin sourcing as
 * unconfirmed. On any error it returns null (silence), never a guess.
 */
const BASE = "https://finnhub.io/api/v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export class FinnhubNewsAttributor implements Attributor {
  readonly name = "finnhub";

  constructor(private readonly token: string) {}

  async attribute(input: AttributionInput): Promise<Cause | null> {
    try {
      const now = Date.now();
      const from = ymd(now - 3 * DAY_MS);
      const to = ymd(now);
      const url = `${BASE}/company-news?symbol=${encodeURIComponent(
        input.symbol,
      )}&from=${from}&to=${to}&token=${this.token}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = (await res.json()) as Array<{
        headline?: string;
        source?: string;
        url?: string;
        datetime?: number; // epoch SECONDS
      }>;
      if (!Array.isArray(raw)) return null;

      const items: NewsItem[] = raw
        .filter((r) => r.headline && r.datetime)
        .map((r) => ({
          headline: r.headline as string,
          source: r.source ?? "unknown",
          url: r.url,
          publishedAt: (r.datetime as number) * 1000,
        }));

      return attributeFromNews(input, items, now);
    } catch {
      return null; // silence beats a fabricated cause
    }
  }
}

/** YYYY-MM-DD in UTC, which is the format Finnhub's news range expects. */
function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
