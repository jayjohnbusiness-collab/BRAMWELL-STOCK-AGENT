import { describe, it, expect } from "vitest";
import { Market } from "../agent/market";
import { SimulatedFeed } from "./simulated";

/*
 * The feed seam: a Feed hydrates the Market, and the brain reads the result.
 * These prove the overlay rules that keep a real (cause-less) feed honest.
 */
describe("Market.applyQuotes", () => {
  it("overlays price and change, and clears cause when told to", () => {
    const m = new Market();
    m.applyQuotes([{ symbol: "AAPL", price: 123.45, changePct: 2.5, cause: null }]);
    const aapl = m.bySymbol("AAPL")!;
    expect(aapl.basePrice).toBe(123.45);
    expect(aapl.changePct).toBe(2.5);
    expect(aapl.cause).toBeNull();
  });

  it("leaves cause untouched when the feed omits it", () => {
    const m = new Market();
    // Causes come from the attributor, not the feed; once set, a quote without
    // a cause field must not wipe it.
    m.setCause("NVDA", { text: "an attributed cause", source: "Reuters" });
    const before = m.bySymbol("NVDA")!.cause;
    m.applyQuotes([{ symbol: "NVDA", price: 1, changePct: 1 }]); // no cause field
    expect(m.bySymbol("NVDA")!.cause).toBe(before);
  });

  it("ignores unknown symbols without throwing", () => {
    const m = new Market();
    expect(() => m.applyQuotes([{ symbol: "NOPE", price: 1, changePct: 1 }])).not.toThrow();
  });
});

describe("SimulatedFeed", () => {
  it("returns quotes only for the requested symbols", async () => {
    const feed = new SimulatedFeed();
    const quotes = await feed.quotes(["NVDA", "AAPL"]);
    expect(quotes.map((q) => q.symbol).sort()).toEqual(["AAPL", "NVDA"]);
    for (const q of quotes) expect(q.price).toBeGreaterThan(0);
  });

  it("holds the day's change steady while the price drifts", async () => {
    const feed = new SimulatedFeed();
    const first = (await feed.quotes(["NVDA"]))[0];
    const second = (await feed.quotes(["NVDA"]))[0];
    expect(first.changePct).toBe(second.changePct); // the story doesn't move
    expect(second.price).not.toBe(first.price); // the digits do
  });
});
