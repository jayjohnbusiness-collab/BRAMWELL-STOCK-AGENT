import { describe, it, expect, beforeEach } from "vitest";
import {
  triggerFires,
  portfolioTriggerFires,
  describeTrigger,
  firedLine,
  type Trigger,
} from "./types";
import { TriggerStore } from "./store";

// In-memory localStorage for the node test environment.
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

function trig(over: Partial<Trigger>): Trigger {
  return {
    id: "t1",
    symbol: "NVDA",
    name: "NVIDIA",
    kind: "below",
    value: 200,
    createdAt: 0,
    firedAt: null,
    ...over,
  };
}

describe("triggerFires", () => {
  it("below fires at or under the level", () => {
    expect(triggerFires(trig({ kind: "below", value: 200 }), { price: 199.9, changePct: -2 })).toBe(true);
    expect(triggerFires(trig({ kind: "below", value: 200 }), { price: 200.1, changePct: -2 })).toBe(false);
  });
  it("above fires at or over the level", () => {
    expect(triggerFires(trig({ kind: "above", value: 300 }), { price: 300, changePct: 1 })).toBe(true);
    expect(triggerFires(trig({ kind: "above", value: 300 }), { price: 299, changePct: 1 })).toBe(false);
  });
  it("move fires on an absolute percent swing either way", () => {
    expect(triggerFires(trig({ kind: "move", value: 5 }), { price: 10, changePct: -5.1 })).toBe(true);
    expect(triggerFires(trig({ kind: "move", value: 5 }), { price: 10, changePct: 4.9 })).toBe(false);
  });
  it("pctFromSet fires on a move from the reference (basis) price", () => {
    const t = trig({ kind: "pctFromSet", value: 10, basis: 100 });
    expect(triggerFires(t, { price: 110, changePct: 0 })).toBe(true); // +10% from set
    expect(triggerFires(t, { price: 90, changePct: 0 })).toBe(true); // −10% from set
    expect(triggerFires(t, { price: 105, changePct: 0 })).toBe(false);
  });
  it("pctFromSet without a basis never fires", () => {
    expect(triggerFires(trig({ kind: "pctFromSet", value: 5 }), { price: 999, changePct: 0 })).toBe(false);
  });
  it("portfolio-level kinds never fire on a per-name quote", () => {
    expect(triggerFires(trig({ kind: "bookDay", value: 500 }), { price: 1, changePct: 50 })).toBe(false);
    expect(triggerFires(trig({ kind: "anyMove", value: 3 }), { price: 1, changePct: 50 })).toBe(false);
  });
});

describe("portfolioTriggerFires", () => {
  it("bookDay fires once the book's day P/L clears ±the threshold", () => {
    const t = trig({ kind: "bookDay", value: 500 });
    expect(portfolioTriggerFires(t, { bookDayAbs: 620 })).toEqual({ value: 620 });
    expect(portfolioTriggerFires(t, { bookDayAbs: -700 })).toEqual({ value: -700 });
    expect(portfolioTriggerFires(t, { bookDayAbs: 100 })).toBeNull();
    expect(portfolioTriggerFires(t, {})).toBeNull();
  });
  it("anyMove fires when a holding clears the percent and names it", () => {
    const t = trig({ kind: "anyMove", value: 4 });
    const holdings = [
      { symbol: "AAPL", name: "Apple", changePct: 1 },
      { symbol: "TSLA", name: "Tesla", changePct: -5.2 },
    ];
    expect(portfolioTriggerFires(t, { holdings })).toEqual({ note: "TSLA", value: -5.2 });
    expect(portfolioTriggerFires(t, { holdings: [{ symbol: "AAPL", name: "Apple", changePct: 1 }] })).toBeNull();
  });
});

describe("describeTrigger", () => {
  it("reads plainly", () => {
    expect(describeTrigger(trig({ kind: "below", value: 200 }))).toBe("below 200");
    expect(describeTrigger(trig({ kind: "move", value: 5 }))).toBe("moves ±5%");
    expect(describeTrigger(trig({ kind: "pctFromSet", value: 8 }))).toBe("±8% from set");
    expect(describeTrigger(trig({ kind: "bookDay", value: 500 }))).toBe("book P/L hits ±$500");
    expect(describeTrigger(trig({ kind: "anyMove", value: 3 }))).toBe("any holding moves ±3%");
  });
});

describe("firedLine", () => {
  it("names the company and the current price", () => {
    const line = firedLine(trig({ kind: "below", value: 200 }), { price: 199.8, changePct: -3 });
    expect(line).toContain("NVIDIA");
    expect(line).toContain("below 200");
    expect(line).toContain("199.80");
  });
});

describe("TriggerStore.evaluate", () => {
  beforeEach(() => localStorage.clear());

  it("fires an armed trigger once, then stays quiet", () => {
    const store = new TriggerStore([]);
    store.add({ symbol: "NVDA", name: "NVIDIA", kind: "below", value: 200 });
    const lookup = () => ({ price: 150, changePct: -5 });

    const first = store.evaluate(lookup, 1000);
    expect(first).toHaveLength(1);
    expect(first[0].firedAt).toBe(1000);

    const second = store.evaluate(lookup, 2000); // already fired → silent
    expect(second).toHaveLength(0);
  });

  it("re-arm lets it fire again", () => {
    const store = new TriggerStore([]);
    const t = store.add({ symbol: "NVDA", name: "NVIDIA", kind: "below", value: 200 });
    store.evaluate(() => ({ price: 150, changePct: -5 }), 1000);
    store.rearm(t.id);
    expect(store.evaluate(() => ({ price: 150, changePct: -5 }), 3000)).toHaveLength(1);
  });

  it("ignores symbols with no quote", () => {
    const store = new TriggerStore([]);
    store.add({ symbol: "ZZZZ", name: "Nowhere", kind: "below", value: 200 });
    expect(store.evaluate(() => undefined, 1000)).toHaveLength(0);
  });

  it("fires a bookDay trigger from the portfolio context and records the value", () => {
    const store = new TriggerStore([]);
    store.add({ symbol: "BOOK", name: "your book", kind: "bookDay", value: 500 });
    const fired = store.evaluate(() => undefined, 1000, { bookDayAbs: -640 });
    expect(fired).toHaveLength(1);
    expect(fired[0].firedValue).toBe(-640);
  });

  it("fires an anyMove trigger and records which holding tripped it", () => {
    const store = new TriggerStore([]);
    store.add({ symbol: "ANY", name: "any holding", kind: "anyMove", value: 4 });
    const fired = store.evaluate(() => undefined, 1000, {
      holdings: [
        { symbol: "AAPL", name: "Apple", changePct: 1 },
        { symbol: "NVDA", name: "NVIDIA", changePct: 6.5 },
      ],
    });
    expect(fired).toHaveLength(1);
    expect(fired[0].firedNote).toBe("NVDA");
    expect(fired[0].firedValue).toBe(6.5);
  });

  it("a portfolio trigger stays quiet when no context is supplied", () => {
    const store = new TriggerStore([]);
    store.add({ symbol: "BOOK", name: "your book", kind: "bookDay", value: 500 });
    expect(store.evaluate(() => undefined, 1000)).toHaveLength(0);
  });
});
