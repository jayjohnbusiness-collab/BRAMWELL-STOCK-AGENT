import type { Instrument } from "./types";
import type { Quote } from "../feed/types";
import { SEED } from "./seed";

/*
 * The market read-model.
 *
 * This is the synchronous snapshot the agent brain reads: the registry of
 * instruments (names, sectors, aliases, watchlist membership) with their
 * current price, change, and cause. It does not fetch anything — a Feed
 * hydrates it via applyQuotes(). Swapping the Feed swaps the data source
 * without the brain or this class changing.
 */

export type Resolution =
  | { status: "ok"; instrument: Instrument }
  | { status: "ambiguous"; heard: string; options: Instrument[] }
  | { status: "none"; heard: string };

export class Market {
  private instruments: Instrument[];

  constructor(registry: Instrument[] = SEED) {
    // Clone so the registry stays pristine and updates don't mutate module state.
    this.instruments = registry.map((i) => ({ ...i }));
  }

  all(): Instrument[] {
    return this.instruments;
  }

  /** Every symbol in the registry — what to ask the feed for. */
  symbols(): string[] {
    return this.instruments.map((i) => i.symbol);
  }

  equities(): Instrument[] {
    return this.instruments.filter((i) => i.kind === "equity");
  }

  index(symbol: string): Instrument | undefined {
    return this.instruments.find(
      (i) => i.kind === "index" && i.symbol === symbol,
    );
  }

  held(): Instrument[] {
    return this.instruments.filter((i) => i.held);
  }

  bySymbol(symbol: string): Instrument | undefined {
    const s = symbol.toUpperCase();
    return this.instruments.find((i) => i.symbol === s);
  }

  private changeFor(i: Instrument, day: "today" | "yesterday"): number {
    return day === "today" ? i.changePct : i.prevChangePct;
  }

  /** Movers in a universe, sorted for the requested metric and day. */
  movers(
    universe: "nasdaq" | "watchlist",
    metric: "gainers" | "losers",
    day: "today" | "yesterday",
    limit = 3,
  ): Instrument[] {
    const pool =
      universe === "watchlist" ? this.held() : this.equities();
    const sorted = [...pool].sort((a, b) => {
      const ca = this.changeFor(a, day);
      const cb = this.changeFor(b, day);
      return metric === "gainers" ? cb - ca : ca - cb;
    });
    const directional = sorted.filter((i) => {
      const c = this.changeFor(i, day);
      return metric === "gainers" ? c > 0 : c < 0;
    });
    return directional.slice(0, limit);
  }

  /** How many names cleared a magnitude threshold — for "say the shape, defer". */
  countBeyond(
    universe: "nasdaq" | "watchlist",
    metric: "gainers" | "losers",
    day: "today" | "yesterday",
    threshold: number,
  ): number {
    const pool =
      universe === "watchlist" ? this.held() : this.equities();
    return pool.filter((i) => {
      const c = this.changeFor(i, day);
      return metric === "gainers" ? c >= threshold : c <= -threshold;
    }).length;
  }

  /**
   * Resolve a spoken/typed reference to an instrument.
   * Prefers an exact symbol, then a unique name/alias match, and returns
   * `ambiguous` when a word maps to more than one live instrument — Bramwell
   * proposes rather than silently guessing between two names.
   */
  resolve(text: string): Resolution {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1) Exact ticker symbol as an uppercase token, e.g. "AAPL", "$NVDA".
    const symbolMatch = raw
      .replace(/\$/g, "")
      .match(/\b[A-Z]{2,5}\b/g);
    if (symbolMatch) {
      for (const tok of symbolMatch) {
        const hit = this.bySymbol(tok);
        if (hit) return { status: "ok", instrument: hit };
      }
    }

    // 2) Company name or alias.
    const nameHits = this.instruments.filter((i) => {
      const name = i.name.toLowerCase().replace(/^the\s+/, "");
      if (lower.includes(name)) return true;
      return (i.aliases ?? []).some((a) => matchesWord(lower, a));
    });

    // Collapse a redundant multi-hit that is really one instrument.
    const uniqueSymbols = new Set(nameHits.map((i) => i.symbol));
    if (uniqueSymbols.size === 1) {
      return { status: "ok", instrument: nameHits[0] };
    }
    if (uniqueSymbols.size > 1) {
      return { status: "ambiguous", heard: raw, options: nameHits };
    }

    return { status: "none", heard: raw };
  }

  /**
   * Overlay live quotes from a Feed onto the registry. Price and change always
   * refresh; prior-session change and cause update only when the feed supplies
   * them, so a feed that can't attribute a cause leaves the registry's alone
   * (and a feed that sets cause: null explicitly clears it — "no reason yet").
   */
  applyQuotes(quotes: Quote[]): void {
    for (const q of quotes) {
      const i = this.bySymbol(q.symbol);
      if (!i) continue;
      i.basePrice = q.price;
      i.changePct = q.changePct;
      if (q.prevChangePct !== undefined) i.prevChangePct = q.prevChangePct;
      if (q.cause !== undefined) i.cause = q.cause;
    }
  }
}

/** A word-boundary match so "delta" doesn't fire inside "deltas" incidentally. */
function matchesWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(haystack);
}
