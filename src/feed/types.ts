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

export interface Feed {
  /** For diagnostics and the "which feed am I on" surface. */
  readonly name: string;
  /** Suggested polling cadence, in milliseconds. */
  readonly pollMs: number;
  /** Quotes for the requested symbols. Unknown/failed symbols are omitted. */
  quotes(symbols: string[]): Promise<Quote[]>;
  /** How the most recent poll went, when the feed tracks it. */
  lastDiagnostics?(): FeedDiagnostics;
}
