import { describe, it, expect, beforeEach } from "vitest";
import { valuePosition, portfolioTotals } from "./types";
import { PortfolioStore } from "./store";

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
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStore() as unknown as Storage;

describe("valuePosition", () => {
  it("computes market value, P/L, and today's dollar move", () => {
    // 10 shares bought at 100, now 120, up 20% today (prev close 100).
    const v = valuePosition(
      { symbol: "X", shares: 10, cost: 100 },
      { price: 120, changePct: 20, name: "X Corp" },
    );
    expect(v.marketValue).toBe(1200);
    expect(v.plAbs).toBe(200);
    expect(v.plPct).toBeCloseTo(20, 5);
    expect(v.dayAbs).toBeCloseTo(200, 5); // (120 - 100) * 10
    expect(v.hasBasis).toBe(true);
  });

  it("marks basis unknown when cost is zero", () => {
    const v = valuePosition(
      { symbol: "X", shares: 5, cost: 0 },
      { price: 50, changePct: 0, name: "X Corp" },
    );
    expect(v.hasBasis).toBe(false);
    expect(v.plAbs).toBe(0);
    expect(v.marketValue).toBe(250);
  });
});

describe("portfolioTotals", () => {
  it("sums value, P/L, and today across positions", () => {
    const a = valuePosition({ symbol: "A", shares: 10, cost: 100 }, { price: 110, changePct: 10, name: "A" });
    const b = valuePosition({ symbol: "B", shares: 2, cost: 50 }, { price: 40, changePct: -20, name: "B" });
    const t = portfolioTotals([a, b]);
    expect(t.marketValue).toBe(10 * 110 + 2 * 40); // 1180
    expect(t.plAbs).toBe(100 + -20); // A +100, B -20 → 80
    expect(t.hasBasis).toBe(true);
  });
});

describe("PortfolioStore", () => {
  beforeEach(() => localStorage.clear());

  it("sets, replaces, and removes by symbol", () => {
    const s = new PortfolioStore([]);
    s.set("nvda", 10, 100);
    s.set("NVDA", 20, 150); // replaces, uppercased
    expect(s.all()).toHaveLength(1);
    expect(s.get("NVDA")).toEqual({ symbol: "NVDA", shares: 20, cost: 150 });
    s.set("NVDA", 0, 0); // zero shares removes
    expect(s.all()).toHaveLength(0);
  });
});
