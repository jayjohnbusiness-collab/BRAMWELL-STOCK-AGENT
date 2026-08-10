import { describe, it, expect, beforeEach } from "vitest";
import { loadCards, saveCards, DEFAULT_CARDS } from "./storage";
import { nextSize } from "./types";

// A minimal in-memory localStorage so the pure storage logic is testable in the
// node test environment (no jsdom).
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

describe("card storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns the default board when nothing is saved", () => {
    expect(loadCards().map((c) => c.type)).toEqual(DEFAULT_CARDS.map((c) => c.type));
  });

  it("round-trips a saved board", () => {
    saveCards([{ id: "clock", type: "clock", size: "sm" }]);
    const loaded = loadCards();
    expect(loaded).toEqual([{ id: "clock", type: "clock", size: "sm" }]);
  });

  it("drops unknown types, bad sizes, and duplicates", () => {
    saveCards([
      { id: "x", type: "bogus", size: "sm" },
      { id: "movers", type: "movers", size: "huge" },
      { id: "movers2", type: "movers", size: "lg" },
    ] as never);
    const loaded = loadCards();
    expect(loaded).toEqual([{ id: "movers", type: "movers", size: "md" }]);
  });
});

describe("nextSize cycles S → M → L → S", () => {
  it("wraps around", () => {
    expect(nextSize("sm")).toBe("md");
    expect(nextSize("md")).toBe("lg");
    expect(nextSize("lg")).toBe("sm");
  });
});
