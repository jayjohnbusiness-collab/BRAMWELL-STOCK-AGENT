import type { Market } from "../agent/market";
import type { Alert, ScreenPayload } from "../agent/types";
import type { Candle, ChartRange, MarketEvent } from "../feed/types";
import type { Trigger, TriggerKind } from "../triggers/types";
import type { Position } from "../portfolio/types";
import type { NotifyState } from "../notify";

/*
 * The dashboard card model.
 *
 * The right pane is a board of cards the user composes: add one, remove one,
 * and cycle each through Small / Medium / Large. Size is not just chrome — each
 * card reads its size and shows correspondingly more or less (see rowLimit).
 * All card types are singletons for now, so a card's id is simply its type.
 */

export type CardType =
  | "watchlist"
  | "spotlight"
  | "alerts"
  | "movers"
  | "breadth"
  | "causes"
  | "clock"
  | "events"
  | "triggers"
  | "portfolio"
  | "allocation"
  | "chart";

export type CardSize = "sm" | "md" | "lg";

export interface CardConfig {
  id: string;
  type: CardType;
  size: CardSize;
}

/** Everything a card body might read or call, passed down from App. */
export interface CardContext {
  market: Market;
  screen: ScreenPayload;
  alert: Alert | null;
  onAck: (id: string) => void;
  watchAdd: (text: string) => Promise<string>;
  watchRemove: (symbol: string) => void;
  watchSuggest: (query: string) => Promise<{ symbol: string; name: string }[]>;
  earnings: (symbols: string[]) => Promise<MarketEvent[]>;
  /** Open the ticker detail drawer for a symbol. */
  openDetail: (symbol: string) => void;
  /** Price history for the chart card; null when the feed can't supply it. */
  candles: (symbol: string, range: ChartRange) => Promise<Candle[] | null>;
  /** Price triggers: set, list, remove, re-arm, and manage notifications. */
  triggers: {
    all: () => Trigger[];
    add: (input: {
      symbol: string;
      name: string;
      kind: TriggerKind;
      value: number;
      basis?: number;
    }) => void;
    remove: (id: string) => void;
    rearm: (id: string) => void;
    notifyState: NotifyState;
    requestNotify: () => void;
  };
  /** Portfolio positions: list, set (add/replace), remove. */
  portfolio: {
    all: () => Position[];
    set: (symbol: string, shares: number, cost: number) => void;
    remove: (symbol: string) => void;
  };
  /** Bumps whenever the live loop mutates the market, to pull fresh reads. */
  version: number;
}

/** Pick a count for the current size — the seam that makes content conform. */
export function rowLimit(size: CardSize, at: { sm: number; md: number; lg: number }): number {
  return at[size];
}

export const SIZES: CardSize[] = ["sm", "md", "lg"];

/** Cycle Small → Medium → Large → Small. */
export function nextSize(size: CardSize): CardSize {
  return SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
}
