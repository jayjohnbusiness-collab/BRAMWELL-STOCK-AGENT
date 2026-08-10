import type { Feed } from "./types";
import { SimulatedFeed } from "./simulated";
import { FinnhubFeed } from "./finnhub";

/*
 * Pick a feed. With a token in the environment, Bramwell runs against live
 * prices; without one, he runs against the simulated feed — offline, no keys.
 * Set VITE_FINNHUB_TOKEN (e.g. in a .env.local) to go live.
 */
export function createFeed(): Feed {
  const token = import.meta.env.VITE_FINNHUB_TOKEN;
  if (token) return new FinnhubFeed(token);
  return new SimulatedFeed();
}

export type { Feed, Quote } from "./types";
export { SimulatedFeed } from "./simulated";
export { FinnhubFeed } from "./finnhub";
