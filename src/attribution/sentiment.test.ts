import { describe, it, expect } from "vitest";
import { headlineSentiment } from "./sentiment";

describe("headline sentiment", () => {
  it("scores clearly positive headlines +1", () => {
    expect(headlineSentiment("Shares surge as company beats estimates")).toBe(1);
    expect(headlineSentiment("Supply deal lifts sector")).toBe(1);
  });

  it("scores clearly negative headlines -1", () => {
    expect(headlineSentiment("Stock plunges after profit warning")).toBe(-1);
    expect(headlineSentiment("Deliveries come in below estimates")).toBe(-1);
  });

  it("treats factual/mixed headlines as neutral", () => {
    expect(headlineSentiment("Company to hold investor day next week")).toBe(0);
    expect(headlineSentiment("Rally fades on renewed concerns")).toBe(0); // one each
  });
});
