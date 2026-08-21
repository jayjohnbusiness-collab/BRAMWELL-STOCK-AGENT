import { describe, it, expect } from "vitest";
import {
  isPortfolioValueQuery,
  looseIntent,
  parse,
  parseNews,
  parsePosition,
  parseTrigger,
  watchTarget,
} from "./nlu";

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

  it("classifies briefing, compare, and why", () => {
    expect(parse("catch me up").kind).toBe("brief");
    expect(parse("NVDA vs AMD").kind).toBe("compare");
    expect(parse("why?").kind).toBe("why");
  });

  it("reads 'now' as today, so 'how about now?' is a follow-up", () => {
    expect(parse("how about now?").day).toBe("today");
  });
});

describe("parse — my top/highest performers reads the watchlist", () => {
  it("classifies 'my highest performing stocks' as watchlist gainers", () => {
    const i = parse("tell me my highest performing stocks of the day");
    expect(i.kind).toBe("query");
    expect(i.metric).toBe("gainers");
    expect(i.universe).toBe("watchlist");
  });

  it("handles 'my best performers today' and 'my top movers'", () => {
    expect(parse("what are my best performers today")).toMatchObject({ metric: "gainers", universe: "watchlist" });
    expect(parse("show my strongest names")).toMatchObject({ metric: "gainers", universe: "watchlist" });
  });

  it("still reads whole-market gainers when not possessive", () => {
    const i = parse("who are today's top performers");
    expect(i.metric).toBe("gainers");
    expect(i.universe).toBeUndefined();
  });
});

describe("looseIntent — forgiving fallback for unfamiliar phrasing", () => {
  it("routes 'any stocks I should be keeping my eyes out on?' to the day's leaders", () => {
    expect(looseIntent("any stocks I should be keeping my eyes out on?")).toMatchObject({ metric: "gainers" });
  });

  it("reads colloquial up/down phrasings", () => {
    expect(looseIntent("what's ripping today")).toMatchObject({ metric: "gainers" });
    expect(looseIntent("anything getting crushed")).toMatchObject({ metric: "losers" });
    expect(looseIntent("what's tanking")).toMatchObject({ metric: "losers" });
  });

  it("reads a health check on my book", () => {
    expect(looseIntent("how's my book holding up")).toMatchObject({ metric: "status", universe: "watchlist" });
  });

  it("returns null for a genuinely unknown, non-market question", () => {
    expect(looseIntent("what is the wash sale rule")).toBeNull();
    expect(looseIntent("what's the capital of France")).toBeNull();
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

describe("parseTrigger — setting an alert", () => {
  it("parses a below-price alert", () => {
    const t = parseTrigger("alert me if NVDA drops below 200");
    expect(t).toEqual({ namePhrase: "NVDA", kind: "below", value: 200 });
  });

  it("parses an above-price alert", () => {
    const t = parseTrigger("tell me when Tesla is above 300");
    expect(t).toEqual({ namePhrase: "Tesla", kind: "above", value: 300 });
  });

  it("parses a percent-move alert", () => {
    const t = parseTrigger("notify me if Apple moves 5%");
    expect(t).toEqual({ namePhrase: "Apple", kind: "move", value: 5 });
  });

  it("treats hits/reaches as a direction-agnostic cross", () => {
    const t = parseTrigger("let me know when NVDA hits 250");
    expect(t?.kind).toBe("cross");
    expect(t?.value).toBe(250);
    expect(t?.namePhrase).toBe("NVDA");
  });

  it("does not fire on ordinary questions", () => {
    expect(parseTrigger("how's NVDA?")).toBeNull();
    expect(parseTrigger("what about the losers?")).toBeNull();
    expect(parseTrigger("is NVDA up 5%?")).toBeNull(); // a move needs an alert verb
  });
});

describe("parsePosition — recording a holding", () => {
  it("parses shares and cost", () => {
    expect(parsePosition("I own 100 shares of NVDA at 150")).toEqual({
      namePhrase: "NVDA",
      shares: 100,
      cost: 150,
    });
    expect(parsePosition("bought 10 AAPL @ 180")).toEqual({
      namePhrase: "AAPL",
      shares: 10,
      cost: 180,
    });
  });

  it("allows an omitted cost (basis filled later)", () => {
    expect(parsePosition("I hold 50 Tesla")).toEqual({
      namePhrase: "Tesla",
      shares: 50,
      cost: 0,
    });
  });

  it("ignores non-position sentences", () => {
    expect(parsePosition("how's NVDA?")).toBeNull();
    expect(parsePosition("I have a question about Tesla")).toBeNull(); // no share count
  });
});

describe("parseNews — asking for company news", () => {
  it("pulls the company from common phrasings", () => {
    expect(parseNews("what is the recent news on Palantir")?.namePhrase).toBe("Palantir");
    expect(parseNews("Hey Bramwell, any headlines for Tesla")?.namePhrase).toBe("Tesla");
    expect(parseNews("what's the latest on NVDA")?.namePhrase).toBe("NVDA");
    expect(parseNews("what's new with Apple")?.namePhrase).toBe("Apple");
  });

  it("ignores non-news questions and news with no company", () => {
    expect(parseNews("how's NVDA?")).toBeNull();
    expect(parseNews("what's the news today")).toBeNull();
  });
});

describe("isPortfolioValueQuery", () => {
  it("matches value/P&L questions, not the status read", () => {
    expect(isPortfolioValueQuery("what's my portfolio worth?")).toBe(true);
    expect(isPortfolioValueQuery("how much is my book up?")).toBe(true);
    expect(isPortfolioValueQuery("how are my holdings?")).toBe(false);
  });
});
