import { describe, expect, it } from "vitest";
import { forSpeech } from "./normalize";

describe("forSpeech", () => {
  it("expands the reported case: 8h → 8 hours", () => {
    expect(forSpeech("Opens in 8h")).toBe("Opens in 8 hours");
  });

  it("expands an h/m countdown with correct plurals", () => {
    expect(forSpeech("Opens in 8h 30m")).toBe("Opens in 8 hours 30 minutes");
    expect(forSpeech("in 1h 1m")).toBe("in 1 hour 1 minute");
  });

  it("expands relative times", () => {
    expect(forSpeech("Broke 3h ago")).toBe("Broke 3 hours ago");
    expect(forSpeech("12m ago")).toBe("12 minutes ago");
    expect(forSpeech("5d ago")).toBe("5 days ago");
  });

  it("expands standalone day/week windows", () => {
    expect(forSpeech("your book over 20d")).toBe("your book over 20 days");
    expect(forSpeech("a 3w high")).toBe("a 3 weeks high");
  });

  it("expands per-period and symbols", () => {
    expect(forSpeech("$100/mo")).toBe("$100 a month");
    expect(forSpeech("+4.2σ calls")).toBe("+4.2 sigma calls");
    expect(forSpeech("book ρ 0.74")).toBe("book rho 0.74");
    expect(forSpeech("up 7%")).toBe("up 7 percent");
  });

  it("leaves ordinary words and am/pm intact", () => {
    expect(forSpeech("The Taiwan foundry deal")).toBe("The Taiwan foundry deal");
    expect(forSpeech("at 9am")).toBe("at 9am");
    expect(forSpeech("the 4th quarter")).toBe("the 4th quarter");
  });
});
