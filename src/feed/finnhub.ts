import type {
  Feed,
  FeedDiagnostics,
  LookupResult,
  MarketEvent,
  NewsHeadline,
  Quote,
} from "./types";
import { SEED } from "../agent/seed";

/*
 * A real market-data adapter (Finnhub).
 *
 * Notes and limits, kept honest:
 *   - The free-tier quote endpoint is one call per symbol; we fan out and drop
 *     any that fail rather than failing the whole poll.
 *   - Indices aren't covered on the free tier, so we skip them and leave those
 *     rows to their registry defaults.
 *   - Prior-session change isn't in the quote payload; it's left untouched.
 *   - Cause is not the feed's job: the attributor supplies it from company news.
 *   - The token rides in the query string, which is fine for a dev scaffold;
 *     a production deployment should proxy this through a backend.
 *
 * lastDiagnostics() reports how the most recent poll went, so the UI can show
 * whether live data is actually flowing and why not when it isn't.
 */
const BASE = "https://finnhub.io/api/v1";

export class FinnhubFeed implements Feed {
  readonly name = "finnhub";
  // ~11 symbols per poll → ~44 calls/min, under Finnhub's free 60/min ceiling.
  readonly pollMs = 15_000;

  private diag: FeedDiagnostics = { ok: 0, failed: 0 };

  constructor(private readonly token: string) {}

  lastDiagnostics(): FeedDiagnostics {
    return this.diag;
  }

  async quotes(symbols: string[]): Promise<Quote[]> {
    const equities = symbols.filter((s) => !isIndex(s));
    let ok = 0;
    let failed = 0;
    let error: string | undefined;
    let sample: { symbol: string; price: number } | undefined;

    const results = await Promise.all(
      equities.map(async (symbol) => {
        const r = await this.one(symbol);
        if (r.quote) {
          ok++;
          if (!sample) sample = { symbol, price: r.quote.price };
          return r.quote;
        }
        failed++;
        if (r.error) error = r.error;
        return null;
      }),
    );

    this.diag = { ok, failed, error, sample };
    if (ok === 0 && failed > 0) {
      // Surface the reason once per poll for anyone with the console open.
      console.warn(`[Bramwell] live feed: 0/${failed} quotes — ${error ?? "unknown"}`);
    }
    return results.filter((q): q is Quote => q !== null);
  }

  /** Look up any ticker: confirm it has a live quote, then fetch its name. */
  async lookup(symbol: string): Promise<LookupResult | null> {
    const s = symbol.trim().toUpperCase();
    try {
      const res = await fetch(
        `${BASE}/quote?symbol=${encodeURIComponent(s)}&token=${this.token}`,
      );
      if (!res.ok) return null;
      const d = (await res.json()) as { c?: number; dp?: number };
      if (typeof d.c !== "number" || d.c === 0) return null;

      let name = s;
      try {
        const pr = await fetch(
          `${BASE}/stock/profile2?symbol=${encodeURIComponent(s)}&token=${this.token}`,
        );
        if (pr.ok) {
          const p = (await pr.json()) as { name?: string };
          if (p?.name && p.name.trim()) name = p.name.trim();
        }
      } catch {
        /* name is a nicety; the symbol will do */
      }
      return { symbol: s, name, price: d.c, changePct: typeof d.dp === "number" ? d.dp : 0 };
    } catch {
      return null;
    }
  }

  /** Find a ticker by company name via Finnhub symbol search. */
  async search(query: string): Promise<{ symbol: string; name: string } | null> {
    try {
      const res = await fetch(
        `${BASE}/search?q=${encodeURIComponent(query.trim())}&token=${this.token}`,
      );
      if (!res.ok) return null;
      const d = (await res.json()) as {
        result?: Array<{ symbol?: string; description?: string; type?: string }>;
      };
      const results = Array.isArray(d?.result) ? d.result : [];
      // Prefer a plain US common-stock symbol (no exchange suffix).
      const best =
        results.find(
          (r) => r.symbol && !r.symbol.includes(".") && r.type === "Common Stock",
        ) ??
        results.find((r) => r.symbol && !r.symbol.includes(".")) ??
        results[0];
      if (!best?.symbol) return null;
      return {
        symbol: best.symbol.toUpperCase(),
        name: (best.description ?? best.symbol).trim(),
      };
    } catch {
      return null;
    }
  }

  /** Typeahead: the closest US-listed matches for a partial name or symbol. */
  async suggest(query: string): Promise<{ symbol: string; name: string }[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    try {
      const res = await fetch(
        `${BASE}/search?q=${encodeURIComponent(q)}&token=${this.token}`,
      );
      if (!res.ok) return [];
      const d = (await res.json()) as {
        result?: Array<{ symbol?: string; description?: string; type?: string }>;
      };
      const results = Array.isArray(d?.result) ? d.result : [];
      const seen = new Set<string>();
      const out: { symbol: string; name: string }[] = [];
      // Plain US common-stock tickers first (no exchange suffix), best-effort.
      const ordered = [
        ...results.filter((r) => r.symbol && !r.symbol.includes(".") && r.type === "Common Stock"),
        ...results.filter((r) => r.symbol && !r.symbol.includes(".") && r.type !== "Common Stock"),
      ];
      for (const r of ordered) {
        const sym = r.symbol?.toUpperCase();
        if (!sym || seen.has(sym)) continue;
        seen.add(sym);
        out.push({ symbol: sym, name: (r.description ?? sym).trim() });
        if (out.length >= 6) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Recent company-news headlines, newest first (last ~7 days). */
  async news(symbol: string): Promise<NewsHeadline[]> {
    const now = Date.now();
    const from = isoDay(now - 7 * 24 * 60 * 60 * 1000);
    const to = isoDay(now);
    try {
      const res = await fetch(
        `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${this.token}`,
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as Array<{
        headline?: string;
        source?: string;
        url?: string;
        datetime?: number; // epoch SECONDS
      }>;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((r) => r.headline && r.datetime)
        .map((r) => ({
          headline: (r.headline as string).trim(),
          source: r.source?.trim() || "unknown",
          url: r.url,
          datetime: (r.datetime as number) * 1000,
        }))
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  /** Upcoming earnings dates for the given symbols (next ~6 weeks). */
  async events(symbols: string[]): Promise<MarketEvent[]> {
    const now = Date.now();
    const from = isoDay(now);
    const to = isoDay(now + 45 * 24 * 60 * 60 * 1000);
    const out: MarketEvent[] = [];
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const res = await fetch(
            `${BASE}/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(
              symbol,
            )}&token=${this.token}`,
          );
          if (!res.ok) return;
          const d = (await res.json()) as {
            earningsCalendar?: Array<{ symbol?: string; date?: string; hour?: string }>;
          };
          for (const e of d?.earningsCalendar ?? []) {
            if (!e.date) continue;
            const when =
              e.hour === "bmo" || e.hour === "amc" || e.hour === "dmh" ? e.hour : null;
            out.push({ symbol: (e.symbol ?? symbol).toUpperCase(), date: e.date, kind: "earnings", when });
          }
        } catch {
          /* one symbol failing shouldn't sink the card */
        }
      }),
    );
    return out;
  }

  private async one(symbol: string): Promise<{ quote: Quote | null; error?: string }> {
    try {
      const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.token}`;
      const res = await fetch(url);
      if (!res.ok) {
        return { quote: null, error: httpReason(res.status) };
      }
      const d = (await res.json()) as { c?: number; dp?: number };
      if (typeof d.c !== "number" || d.c === 0) {
        return { quote: null, error: "no data for symbol" };
      }
      return {
        quote: {
          symbol,
          price: d.c,
          changePct: typeof d.dp === "number" ? d.dp : 0,
        },
      };
    } catch (e) {
      // A thrown fetch in the browser is almost always CORS or offline.
      const error =
        e instanceof TypeError ? "request blocked (CORS or offline)" : "request error";
      return { quote: null, error };
    }
  }
}

function httpReason(status: number): string {
  if (status === 401 || status === 403) return `unauthorized (${status}) — check your key`;
  if (status === 429) return "rate limited (429) — too many requests";
  return `HTTP ${status}`;
}

function isIndex(symbol: string): boolean {
  return SEED.some((i) => i.symbol === symbol && i.kind === "index");
}

/** YYYY-MM-DD in local time, which the earnings calendar range expects. */
function isoDay(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
