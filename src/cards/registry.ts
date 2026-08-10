import type { CardType, CardSize } from "./types";

/*
 * Card catalog: the human-facing name and one-line blurb for each type, plus
 * the size a freshly-added card starts at. The board renders the picker from
 * here, so adding a new card type is: add a meta entry and a case in CardBoard.
 */

export interface CardMeta {
  type: CardType;
  title: string;
  blurb: string;
  defaultSize: CardSize;
}

export const CARD_META: Record<CardType, CardMeta> = {
  watchlist: {
    type: "watchlist",
    title: "The names you follow",
    blurb: "Your watchlist with live price and change.",
    defaultSize: "lg",
  },
  spotlight: {
    type: "spotlight",
    title: "Spotlight",
    blurb: "The last name you asked about, in full.",
    defaultSize: "md",
  },
  alerts: {
    type: "alerts",
    title: "Now",
    blurb: "The one thing worth an interruption.",
    defaultSize: "md",
  },
  movers: {
    type: "movers",
    title: "Movers",
    blurb: "Today's leaders and laggards among your names.",
    defaultSize: "md",
  },
  breadth: {
    type: "breadth",
    title: "Today's breadth",
    blurb: "How many of your names are up vs down.",
    defaultSize: "sm",
  },
  causes: {
    type: "causes",
    title: "Why it moved",
    blurb: "Recent attributed causes across your names.",
    defaultSize: "md",
  },
  clock: {
    type: "clock",
    title: "Market clock",
    blurb: "Open or closed, and the time to the bell.",
    defaultSize: "sm",
  },
  events: {
    type: "events",
    title: "Events",
    blurb: "Upcoming earnings and your own reminders.",
    defaultSize: "md",
  },
};

export const ALL_CARD_TYPES: CardType[] = [
  "watchlist",
  "spotlight",
  "alerts",
  "movers",
  "breadth",
  "causes",
  "clock",
  "events",
];
