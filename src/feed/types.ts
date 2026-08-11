import type { Cause } from "../agent/types";

/*
 * The feed seam.
 *
 * The agent brain reads a synchronous snapshot (the Market). A Feed is where
 * that snapshot comes from — simulated today, a real provider tomorrow. The
 * brain never touches this; swapping feeds changes the data, not the butler.
 */

export interface Quote {
  symbol: string;
  /** Latest price. */
  price: number;
  /** Percent change so far today, e.g. 7.21 for +7.21%. */
  changePct: number;
  /** Prior-session percent change, when the feed can supply it. */
  prevChangePct?: number;
  /**
   * A probable cause for the move, if the feed can attribute one.
   *   - `undefined` → leave whatever the registry already had.
   *   - `null`      → explicitly no established cause (drives "no reason yet").
   * A real price feed has no causes; attribution is a separate, harder problem,
   * and null here is the honest answer until it's wired.
   */
  cause?: Cause | null;
}

export interface FeedDiagnostics {
  ok: number;
  failed: number;
  error?: string;
  sample?: { symbol: string; price: number };
}

export interface LookupResult {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

/** A recent news headline for a company. */
export interface NewsHeadline {
  headline: string;
  source: string;
  url?: string;
  /** Epoch milliseconds. */
  datetime: number;
}

/** An upcoming dated event for a symbol (earnings today; more feeds later). */
export interface MarketEvent {
  symbol: string;
  /** YYYY-MM-DD. */
  date: string;
  kind: "earnings";
  /** Before-market / after-market / during, when the feed says. */
  when?: "bmo" | "amc" | "dmh" | null;
}

export interface Feed {
  /** For diagnostics and the "which feed am I on" surface. */
  readonly name: string;
  /** Suggested polling cadence, in milliseconds. */
  readonly pollMs: number;
  /** Quotes for the requested symbols. Unknown/failed symbols are omitted. */
  quotes(symbols: string[]): Promise<Quote[]>;
  /** How the most recent poll went, when the feed tracks it. */
  lastDiagnostics?(): FeedDiagnostics;
  /**
   * Resolve a not-yet-known ticker to a real instrument (name + quote), so the
   * user can add any symbol the feed covers. Returns null if it isn't found.
   */
  lookup?(symbol: string): Promise<LookupResult | null>;
  /**
   * Find a ticker by company name (e.g. "Amazon" → AMZN). Returns the best
   * match's symbol and name, or null.
   */
  search?(query: string): Promise<{ symbol: string; name: string } | null>;
  /**
   * Typeahead: the closest matching tickers for a partial query, best first.
   */
  suggest?(query: string): Promise<{ symbol: string; name: string }[]>;
  /**
   * Upcoming dated events (earnings) for the given symbols, when the feed can
   * supply them. Empty array when it can't.
   */
  events?(symbols: string[]): Promise<MarketEvent[]>;
  /**
   * Recent news headlines for a single company, newest first. Empty when the
   * feed has none (or can't fetch news).
   */
  news?(symbol: string): Promise<NewsHeadline[]>;
}
