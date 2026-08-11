import { describe, it, expect } from "vitest";
import { Bramwell } from "./bramwell";
import { Market } from "./market";
import { FIXTURE } from "../test/fixture";
import {
  loadWatchlist,
  saveWatchlist,
  type KeyValueStore,
} from "../watchlist/storage";

/** An in-memory stand-in for localStorage. */
function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("Market watchlist membership", () => {
  it("seeds from the registry defaults", () => {
    const m = new Market(FIXTURE);
    expect(m.watchlistSymbols().sort()).toEqual(["AUTO", "SUN", "WHEEL"]);
  });

  it("adds, removes, and reports membership", () => {
    const m = new Market(FIXTURE);
    expect(m.isWatched("STAR")).toBe(false);
    expect(m.watch("STAR")).toBe(true);
    expect(m.isWatched("STAR")).toBe(true);
    expect(m.held().some((i) => i.symbol === "STAR")).toBe(true);

    expect(m.unwatch("STAR")).toBe(true);
    expect(m.isWatched("STAR")).toBe(false);
    expect(m.unwatch("STAR")).toBe(false); // already off
    expect(m.watch("NOPE")).toBe(false); // not in the registry
  });

  it("setWatchlist replaces the set and drops unknown symbols", () => {
    const m = new Market(FIXTURE);
    m.setWatchlist(["moon", "star", "ghost"]);
    expect(m.watchlistSymbols().sort()).toEqual(["MOON", "STAR"]);
  });
});

describe("editing the watchlist by asking Bramwell", () => {
  it("adds a name and confirms in character", () => {
    const b = new Bramwell(new Market(FIXTURE));
    const r = b.respond("Watch Star Logic.");
    expect(r.spoken).toMatch(/keep an eye on Star Logic/i);
    expect(b.market.isWatched("STAR")).toBe(true);
  });

  it("notices a name already on the list", () => {
    const b = new Bramwell(new Market(FIXTURE));
    const r = b.respond("Add Sunrise Micro."); // SUN is a default holding
    expect(r.spoken).toMatch(/already on your list/i);
  });

  it("removes a name", () => {
    const b = new Bramwell(new Market(FIXTURE));
    const r = b.respond("Stop watching Autohaus.");
    expect(r.spoken).toMatch(/off your list/i);
    expect(b.market.isWatched("AUTO")).toBe(false);
  });

  it("declines to add a name it doesn't know", () => {
    const b = new Bramwell(new Market(FIXTURE));
    const r = b.respond("Watch Meridian.");
    expect(r.spoken).toContain('I heard "Meridian"');
    expect(b.market.watchlistSymbols()).not.toContain("MERIDIAN");
  });
});

describe("watchlist persistence", () => {
  it("round-trips through the store", () => {
    const store = fakeStore();
    expect(loadWatchlist(store)).toBeNull();
    saveWatchlist(["NVDA", "AAPL"], store);
    expect(loadWatchlist(store)).toEqual(["NVDA", "AAPL"]);
  });

  it("survives corrupt data without throwing", () => {
    const store = fakeStore();
    store.setItem("bramwell.watchlist.v1", "{not json");
    expect(loadWatchlist(store)).toBeNull();
  });
});
