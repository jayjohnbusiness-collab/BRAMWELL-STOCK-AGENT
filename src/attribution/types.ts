import type { Cause } from "../agent/types";

/*
 * Cause attribution.
 *
 * A price feed tells you a name moved; it does not tell you why. Attribution is
 * that second, separate step — and it is the whole product. The governing rule
 * (conversation spec §7): Bramwell never invents a cause. Attribution is
 * grounded in a real retrieved item or it returns null. A plausible fake cause
 * is worse than silence.
 */

export interface NewsItem {
  headline: string;
  source: string;
  url?: string;
  /** Epoch milliseconds. */
  publishedAt: number;
}

export interface AttributionInput {
  symbol: string;
  name: string;
  /** Today's percent change — the move we're trying to explain. */
  changePct: number;
}

export interface Attributor {
  readonly name: string;
  /** A probable cause for the move, or null when none is established. */
  attribute(input: AttributionInput): Promise<Cause | null>;
}

export type { Cause };
