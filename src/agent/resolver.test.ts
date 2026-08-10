import { describe, it, expect } from "vitest";
import { resolveReference } from "./resolver";
import { FIXTURE } from "../test/fixture";

// FIXTURE symbols: IXIC, SUN, MOON, STAR, BIO, AUTO, WHEEL, DAL, DLA.
const r = (text: string) => resolveReference(text, FIXTURE);

describe("symbols (§5.2 — resolve out loud)", () => {
  it("matches an uppercase symbol token", () => {
    const res = r("How's SUN?");
    expect(res.status).toBe("ok");
    expect(res.status === "ok" && res.instrument.symbol).toBe("SUN");
  });

  it("matches a symbol in any case (a lowercased transcript)", () => {
    const res = r("hows bio doing");
    expect(res.status === "ok" && res.instrument.symbol).toBe("BIO");
  });
});

describe("vowel-dropped recovery (§5 — 'plntr' → Palantir)", () => {
  it("recovers a single-word name with its vowels dropped", () => {
    // Biocorp → 'bcrp'; Wheelworks → 'whlwrks'.
    expect(r("bcrp").status === "ok" && (r("bcrp") as { instrument: { symbol: string } }).instrument.symbol).toBe("BIO");
    const w = r("whlwrks");
    expect(w.status === "ok" && w.instrument.symbol).toBe("WHEEL");
  });

  it("still recovers when trailing words are present", () => {
    const res = r("bcrp why?");
    expect(res.status === "ok" && res.instrument.symbol).toBe("BIO");
  });

  it("won't misfire on a short vowel-light word", () => {
    // 'ths' is under the four-consonant floor — not a match.
    expect(r("ths").status).not.toBe("ok");
  });
});

describe("spelled-out tickers (§5 — the hard case)", () => {
  it("assembles typed letters: 's t a r' → STAR", () => {
    const res = r("how's s t a r");
    expect(res.status === "ok" && res.instrument.symbol).toBe("STAR");
  });

  it("assembles phonetic letters: 'em oh oh en' → MOON", () => {
    const res = r("what's em oh oh en at");
    expect(res.status === "ok" && res.instrument.symbol).toBe("MOON");
  });

  it("does not fire on ordinary speech", () => {
    // 'a' is a letter but a lone one; no real symbol assembles here.
    expect(r("is it a good day").status).toBe("none");
  });
});

describe("names, including word-split and fuzzy mishears (§5.1)", () => {
  it("matches a plain company name", () => {
    const res = r("how is Moon Systems doing");
    expect(res.status === "ok" && res.instrument.symbol).toBe("MOON");
  });

  it("recovers a word-split mishear: 'star logic' heard split", () => {
    const res = r("star logic");
    expect(res.status === "ok" && res.instrument.symbol).toBe("STAR");
  });

  it("recovers a lightly-distorted name via fuzzy match", () => {
    // "Autohaus" mis-transcribed.
    const res = r("how's autohouse");
    expect(res.status === "ok" && res.instrument.symbol).toBe("AUTO");
  });

  it("says nothing rather than guess wrong on a far-off word", () => {
    expect(r("how's the weather").status).toBe("none");
  });

  it("flags a close mishear as a near-miss (a name attempt), not out of scope", () => {
    const res = r("how's biocrop"); // ~ Biocorp
    expect(res.status).toBe("none");
    expect(res.status === "none" && res.nearMiss).toBe(true);
    expect(res.status === "none" && res.heard).toBe("biocrop");
  });

  it("marks a genuinely unrelated query as not a near-miss", () => {
    const res = r("how's the weather");
    expect(res.status === "none" && res.nearMiss).toBe(false);
  });
});

describe("ambiguity is proposed, never silently guessed (§5.3, §5.4)", () => {
  it("proposes both on a shared name", () => {
    const res = r("how's Delta");
    expect(res.status).toBe("ambiguous");
    const syms =
      res.status === "ambiguous" ? res.options.map((o) => o.symbol).sort() : [];
    expect(syms).toEqual(["DAL", "DLA"]);
  });

  it("disambiguates when the fuller name is given", () => {
    const res = r("how's Delta Air Lines");
    expect(res.status === "ok" && res.instrument.symbol).toBe("DAL");
  });
});
