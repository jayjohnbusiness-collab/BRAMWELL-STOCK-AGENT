import type { Attributor } from "./types";
import { SimulatedAttributor } from "./simulated";
import { FinnhubNewsAttributor } from "./finnhub";
import { getToken } from "../feed/token";

/*
 * Pick an attributor. With a token, causes come from live company news;
 * without one, from the seeded newsroom. Same rule, same guarantees.
 */
export function createAttributor(): Attributor {
  const token = getToken();
  if (token) return new FinnhubNewsAttributor(token);
  return new SimulatedAttributor();
}

export type { Attributor, AttributionInput, NewsItem } from "./types";
export { attributeFromNews } from "./attribute";
export { SimulatedAttributor } from "./simulated";
export { FinnhubNewsAttributor } from "./finnhub";
