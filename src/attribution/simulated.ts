import type { Cause } from "../agent/types";
import type { Attributor, AttributionInput, NewsItem } from "./types";
import { attributeFromNews } from "./attribute";
import { SIM_NEWS } from "./news";

/*
 * The simulated attributor. It runs the exact same pure rule the real one does
 * (attributeFromNews), just against a seeded newsroom instead of a live wire —
 * so the demo exercises attribution end to end, including the null case.
 */
export class SimulatedAttributor implements Attributor {
  readonly name = "simulated";

  async attribute(input: AttributionInput): Promise<Cause | null> {
    const now = Date.now();
    const stories = SIM_NEWS[input.symbol] ?? [];
    const items: NewsItem[] = stories.map((s) => ({
      headline: s.headline,
      source: s.source,
      url: s.url,
      publishedAt: now - s.minutesAgo * 60_000,
    }));
    return attributeFromNews(input, items, now);
  }
}
