import type { Feed } from "./types";
import { SimulatedFeed } from "./simulated";
import { FinnhubFeed } from "./finnhub";
import { getToken } from "./token";

/*
 * Pick a feed. With a token (pasted in the app, a `?finnhub=` link, or a
 * build-time env var), Bramwell runs against live Finnhub prices; without one,
 * he runs against the simulated feed — offline, no keys.
 */
export function createFeed(): Feed {
  const token = getToken();
  if (token) return new FinnhubFeed(token);
  return new SimulatedFeed();
}

export type { Feed, Quote } from "./types";
export { SimulatedFeed } from "./simulated";
export { FinnhubFeed } from "./finnhub";
