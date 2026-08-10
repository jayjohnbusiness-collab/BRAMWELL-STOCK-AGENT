import type { CardConfig, CardSize, CardType } from "./types";
import { ALL_CARD_TYPES } from "./registry";

/*
 * The board layout persists like the watchlist does — which cards, in what
 * order, at what size — so a composed dashboard survives a reload.
 */

const KEY = "bramwell.cards.v1";
const VALID_SIZES: CardSize[] = ["sm", "md", "lg"];

// A sensible first board: the alert, the watchlist, and today's movers.
export const DEFAULT_CARDS: CardConfig[] = [
  { id: "alerts", type: "alerts", size: "md" },
  { id: "watchlist", type: "watchlist", size: "lg" },
  { id: "movers", type: "movers", size: "md" },
];

export function loadCards(): CardConfig[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CARDS.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_CARDS.map((c) => ({ ...c }));
    const seen = new Set<string>();
    const cards: CardConfig[] = [];
    for (const entry of parsed) {
      const type = (entry as CardConfig)?.type;
      const size = (entry as CardConfig)?.size;
      if (!ALL_CARD_TYPES.includes(type as CardType)) continue;
      if (seen.has(type)) continue; // singletons: one of each
      seen.add(type);
      cards.push({
        id: type,
        type: type as CardType,
        size: VALID_SIZES.includes(size) ? size : "md",
      });
    }
    return cards.length ? cards : DEFAULT_CARDS.map((c) => ({ ...c }));
  } catch {
    return DEFAULT_CARDS.map((c) => ({ ...c }));
  }
}

export function saveCards(cards: CardConfig[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    /* private mode or full disk — the board just won't persist */
  }
}
