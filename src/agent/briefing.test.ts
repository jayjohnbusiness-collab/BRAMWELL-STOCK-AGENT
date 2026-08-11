import { describe, it, expect } from "vitest";
import { composeMorningBriefing, type BriefingInput } from "./briefing";

const base: BriefingInput = {
  hour: 9,
  firstOfDay: true,
  held: [],
  book: null,
  earningsToday: [],
  alertsMet: [],
};

describe("morning briefing", () => {
  it("returns null when there's nothing to say", () => {
    expect(composeMorningBriefing(base)).toBeNull();
  });

  it("greets by time of day on the first open", () => {
    const held = [{ symbol: "NVDA", name: "NVIDIA", changePct: 2 }];
    expect(composeMorningBriefing({ ...base, hour: 9, held })).toMatch(/^Good morning\./);
    expect(composeMorningBriefing({ ...base, hour: 14, held })).toMatch(/^Good afternoon\./);
    expect(composeMorningBriefing({ ...base, hour: 20, held })).toMatch(/^Good evening\./);
  });

  it("omits the greeting when it's not the first open of the day", () => {
    const held = [{ symbol: "NVDA", name: "NVIDIA", changePct: 2 }];
    const out = composeMorningBriefing({ ...base, firstOfDay: false, held })!;
    expect(out).not.toMatch(/Good (morning|afternoon|evening)/);
  });

  it("summarises breadth and names the standout mover with its cause", () => {
    const held = [
      { symbol: "NVDA", name: "NVIDIA", changePct: 7, cause: { text: "a supply deal lifted it" } },
      { symbol: "AAPL", name: "Apple", changePct: 1 },
      { symbol: "TSLA", name: "Tesla", changePct: -3 },
    ];
    const out = composeMorningBriefing({ ...base, held })!;
    expect(out).toContain("three names");
    expect(out).toContain("two are up and one down");
    expect(out).toContain("NVIDIA's leading");
    expect(out).toContain("A supply deal lifted it");
    expect(out).toContain("Tesla's the softest");
  });

  it("reports the book's day move and overall P/L", () => {
    const out = composeMorningBriefing({
      ...base,
      held: [{ symbol: "NVDA", name: "NVIDIA", changePct: 2 }],
      book: { dayAbs: 1240, hasBasis: true, plAbs: 8300, plPct: 12, marketValue: 60000 },
    })!;
    expect(out).toContain("Your book's up $1,240 on the day");
    expect(out).toContain("ahead $8,300 overall");
  });

  it("mentions earnings due today among the user's names", () => {
    const out = composeMorningBriefing({
      ...base,
      held: [{ symbol: "NVDA", name: "NVIDIA", changePct: 0 }],
      earningsToday: ["NVIDIA"],
    })!;
    expect(out).toContain("NVIDIA reports today.");
  });

  it("flags standing alerts already met", () => {
    const out = composeMorningBriefing({
      ...base,
      held: [{ symbol: "NVDA", name: "NVIDIA", changePct: 8 }],
      alertsMet: ["NVIDIA"],
    })!;
    expect(out).toMatch(/NVIDIA has already hit a mark you set/);
  });

  it("still speaks when only a book exists (empty watchlist)", () => {
    const out = composeMorningBriefing({
      ...base,
      book: { dayAbs: -300, hasBasis: false, plAbs: 0, plPct: 0, marketValue: 12000 },
    })!;
    expect(out).toContain("Your book's down $300 on the day");
  });
});
