import { describe, it, expect, beforeEach, vi } from "vitest";

/*
 * The intraday tape persists for the trading day, so the 1D chart survives a
 * hard refresh. These tests drive the module through a fresh in-memory
 * localStorage, re-importing it to exercise the load-time restore.
 */

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStore() as unknown as Storage;
  vi.resetModules();
});

describe("price history tape", () => {
  it("accumulates ticks per symbol and returns them oldest-first", async () => {
    const { recordQuotes, priceSeries } = await import("./history");
    recordQuotes([{ symbol: "NVDA", price: 100, changePct: 0 }], 1_000);
    recordQuotes([{ symbol: "NVDA", price: 101, changePct: 0 }], 3_000);
    const s = priceSeries("NVDA");
    expect(s.map((t) => t.price)).toEqual([100, 101]);
  });

  it("persists across a reload within the same trading day", async () => {
    const first = await import("./history");
    first.recordQuotes([{ symbol: "NVDA", price: 100, changePct: 0 }], 1_000);
    // The second call is >SAVE_EVERY_MS later, so it flushes to storage.
    first.recordQuotes([{ symbol: "NVDA", price: 105, changePct: 0 }], 10_000);

    // A hard refresh: modules reset, storage kept — restore() runs on import.
    vi.resetModules();
    const reloaded = await import("./history");
    const s = reloaded.priceSeries("NVDA");
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s[s.length - 1].price).toBe(105);
  });

  it("drops a tape saved under a different trading day", async () => {
    // Seed storage as if from a previous day.
    localStorage.setItem(
      "bramwell.tape.v1",
      JSON.stringify({ day: "1990-01-01", tape: { NVDA: [{ t: 1, price: 9 }, { t: 2, price: 9 }] } }),
    );
    const { priceSeries } = await import("./history");
    expect(priceSeries("NVDA")).toEqual([]);
  });
});
