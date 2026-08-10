import { describe, it, expect } from "vitest";
import { parse, watchTarget } from "./nlu";

/*
 * The command layer: conversational "add / watch" phrasings must classify as a
 * watch intent, and the name has to survive the scaffolding around it. This is
 * the bug behind "I heard CAN." — the whole sentence reached the resolver.
 */
describe("parse — watch intent", () => {
  const adds = [
    "add Shell to my stock",
    "can you add Shell to my stock",
    "ADD SHELL STOCK TO MY LIST",
    "watch Tesla",
    "please follow Palantir",
    "keep an eye on Nvidia",
  ];
  for (const u of adds) {
    it(`classifies "${u}" as watch`, () => {
      expect(parse(u).kind).toBe("watch");
    });
  }

  it("classifies removal as unwatch, not watch", () => {
    expect(parse("stop watching Apple").kind).toBe("unwatch");
    expect(parse("remove Tesla from my list").kind).toBe("unwatch");
  });
});

describe("watchTarget — name extraction", () => {
  const cases: Array<[string, string]> = [
    ["can you add Shell to my stock", "Shell"],
    ["ADD SHELL STOCK TO MY LIST", "SHELL"],
    ["add Shell stock", "Shell"],
    ["watch Tesla", "Tesla"],
    ["please follow Palantir", "Palantir"],
    ["remove Apple from my watchlist", "Apple"],
    ["keep an eye on Nvidia", "Nvidia"],
  ];
  for (const [input, want] of cases) {
    it(`"${input}" → "${want}"`, () => {
      expect(watchTarget(input)).toBe(want);
    });
  }

  it("returns empty when only filler survives", () => {
    expect(watchTarget("add it to my list")).toBe("");
    expect(watchTarget("add that")).toBe("");
  });
});
