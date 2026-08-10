import { describe, it, expect } from "vitest";
import {
  exactPercent,
  magnitudeInWords,
  numberToWords,
  percentInWords,
  sign,
  spokenChange,
} from "./format";

describe("spoken formatting — rounded, read naturally (§4)", () => {
  it("rounds a percent to the nearest half, in words", () => {
    expect(percentInWords(7.21)).toBe("seven percent");
    expect(percentInWords(4.53)).toBe("four and a half percent");
    expect(percentInWords(0.44)).toBe("half a percent");
  });

  it("gives the bare magnitude for list continuations", () => {
    expect(magnitudeInWords(7.21)).toBe("seven");
    expect(magnitudeInWords(4.53)).toBe("four and a half");
  });

  it("states direction, neutral on gains and losses (§11)", () => {
    expect(spokenChange(7.21)).toBe("up seven percent");
    expect(spokenChange(-2)).toBe("down two percent");
    expect(spokenChange(0)).toBe("unchanged");
  });

  it("spells whole numbers", () => {
    expect(numberToWords(7)).toBe("seven");
    expect(numberToWords(23)).toBe("twenty-three");
  });
});

describe("on-screen formatting — exact, with a written sign (§8 quality floor)", () => {
  it("carries a written sign as well as the value", () => {
    expect(exactPercent(7.21)).toBe("+7.21%");
    // On screen the negative uses a true minus (U+2212), not a hyphen.
    expect(exactPercent(-1.06)).toBe("−1.06%");
    expect(exactPercent(0)).toBe("0.00%");
  });

  it("reports a plain sign for the ear/logic", () => {
    expect(sign(7.21)).toBe("+");
    expect(sign(-1)).toBe("-");
    expect(sign(0)).toBe("");
  });
});
