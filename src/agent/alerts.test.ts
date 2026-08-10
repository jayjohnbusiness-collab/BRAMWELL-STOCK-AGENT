import { describe, it, expect } from "vitest";
import { leadAlert } from "./alerts";
import { Market } from "./market";
import type { Instrument } from "./types";
import { FIXTURE } from "../test/fixture";

/*
 * The unprompted alert bar (§1): a move AND a probable cause, one line only.
 * Silence when nothing clears it is Bramwell working correctly.
 */
describe("the unprompted alert bar", () => {
  it("surfaces the single lead, folding same-sector peers into one line", () => {
    const a = leadAlert(new Market(FIXTURE));
    expect(a).not.toBeNull();
    expect(a!.symbol).toBe("SUN"); // biggest move that also has a cause
    expect(a!.spoken).toContain("Sunrise Micro");
    expect(a!.spoken).toMatch(/moving with it/i); // MOON + STAR folded in
  });

  it("stays silent when a big move has no established cause", () => {
    const causeless: Instrument[] = [
      {
        symbol: "ZZZ",
        name: "Zephyr",
        kind: "equity",
        sector: "misc",
        basePrice: 10,
        changePct: 9.0, // well over the threshold…
        prevChangePct: 0,
        cause: null, // …but nothing behind it
      },
    ];
    expect(leadAlert(new Market(causeless))).toBeNull();
  });

  it("stays silent when nothing clears the move threshold", () => {
    const quiet: Instrument[] = [
      {
        symbol: "AAA",
        name: "Ayefirm",
        kind: "equity",
        basePrice: 10,
        changePct: 1.2,
        prevChangePct: 0,
        cause: { text: "a small drift", source: null },
      },
    ];
    expect(leadAlert(new Market(quiet))).toBeNull();
  });
});
