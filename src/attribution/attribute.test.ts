import { describe, it, expect } from "vitest";
import { attributeFromNews, mentionsInstrument } from "./attribute";
import { SimulatedAttributor } from "./simulated";
import type { NewsItem } from "./types";

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const input = { symbol: "NVDA", name: "NVIDIA", changePct: 7.2 };

function item(over: Partial<NewsItem>): NewsItem {
  return { headline: "H", source: "Reuters", publishedAt: NOW - HOUR, ...over };
}

describe("attributeFromNews — grounded, or nothing (§7)", () => {
  it("says nothing when there is no news", () => {
    expect(attributeFromNews(input, [], NOW)).toBeNull();
  });

  it("says nothing when the only news is stale", () => {
    const stale = [item({ publishedAt: NOW - 5 * 24 * HOUR })];
    expect(attributeFromNews(input, stale, NOW)).toBeNull();
  });

  it("reports a major-wire story, naming the source", () => {
    const c = attributeFromNews(
      input,
      [item({ headline: "Taiwan supply deal reached", source: "Reuters", url: "u" })],
      NOW,
    );
    expect(c).not.toBeNull();
    expect(c!.confidence).toBe("reported");
    expect(c!.source).toBe("Reuters");
    expect(c!.url).toBe("u");
    // Grounded: the text is built from the real headline, never invented.
    expect(c!.text).toContain("Taiwan supply deal reached");
  });

  it("flags thin (non-major) reporting as unconfirmed", () => {
    const c = attributeFromNews(
      input,
      [item({ headline: "Traders chatter about chips", source: "Yahoo Finance" })],
      NOW,
    );
    expect(c!.confidence).toBe("unconfirmed");
    expect(c!.text).toMatch(/unconfirmed/i);
    expect(c!.text).toContain("Traders chatter about chips");
  });

  it("prefers a major source over a newer thin one", () => {
    const c = attributeFromNews(
      input,
      [
        item({ headline: "blog take", source: "SomeBlog", publishedAt: NOW - 1 * MIN }),
        item({ headline: "Reuters scoop", source: "Reuters", publishedAt: NOW - 3 * HOUR }),
      ],
      NOW,
    );
    expect(c!.source).toBe("Reuters");
    expect(c!.text).toContain("Reuters scoop");
  });

  it("refuses a headline that contradicts the move (bullish news, down move)", () => {
    const down = { symbol: "X", name: "X Corp", changePct: -6.0 };
    const c = attributeFromNews(
      down,
      [item({ headline: "Company wins record contract, shares set to soar", source: "Reuters" })],
      NOW,
    );
    // Attaching a bullish story to a fall would mislead — say nothing instead.
    expect(c).toBeNull();
  });

  it("attributes a negative headline to a down move", () => {
    const down = { symbol: "X", name: "X Corp", changePct: -6.0 };
    const c = attributeFromNews(
      down,
      [item({ headline: "Profit warning sends shares lower", source: "Bloomberg" })],
      NOW,
    );
    expect(c!.confidence).toBe("reported");
    expect(c!.text).toContain("Profit warning sends shares lower");
  });

  it("skips a contradicting major source for an aligned lesser one", () => {
    const up = { symbol: "X", name: "X Corp", changePct: 6.0 };
    const c = attributeFromNews(
      up,
      [
        item({ headline: "Shares to plunge on downgrade", source: "Reuters" }), // conflict, excluded
        item({ headline: "Traders cite upbeat demand", source: "Yahoo Finance" }), // aligned
      ],
      NOW,
    );
    expect(c!.source).toBe("Yahoo Finance");
    expect(c!.confidence).toBe("unconfirmed");
  });

  it("keeps a neutral headline (factual causes aren't penalized)", () => {
    const c = attributeFromNews(
      input,
      [item({ headline: "Company to hold investor day", source: "Reuters" })],
      NOW,
    );
    expect(c!.confidence).toBe("reported");
    expect(c!.text).toContain("investor day");
  });

  it("trims an overlong headline", () => {
    const long = "x".repeat(200);
    const c = attributeFromNews(input, [item({ headline: long, source: "Reuters" })], NOW);
    expect(c!.text.length).toBeLessThan(160);
    expect(c!.text).toMatch(/…$/);
  });

  it("keeps only the first sentence, dropping a clickbait question", () => {
    const c = attributeFromNews(
      input,
      [item({ headline: "Supply deal signed for advanced chips. Is it heading higher?" })],
      NOW,
    );
    expect(c!.text).toContain("Supply deal signed for advanced chips");
    expect(c!.text).not.toMatch(/heading higher/i);
  });

  it("strips a trailing clickbait clause after a dash", () => {
    const c = attributeFromNews(
      input,
      [item({ headline: "Guidance lifted on strong demand — here's why it matters" })],
      NOW,
    );
    expect(c!.text).toContain("Guidance lifted on strong demand");
    expect(c!.text).not.toMatch(/here'?s why/i);
  });

  it("stays silent when a headline cleans down to nothing usable", () => {
    // The only item is punctuation/fragment — better nothing than a broken clause.
    expect(attributeFromNews(input, [item({ headline: " — " })], NOW)).toBeNull();
  });
});

describe("mentionsInstrument — company relevance (live filter)", () => {
  const nvda = { symbol: "NVDA", name: "NVIDIA" };
  const dal = { symbol: "DAL", name: "Delta Air Lines" };

  it("matches on the company name", () => {
    expect(mentionsInstrument("Nvidia unveils a new GPU line", nvda)).toBe(true);
  });

  it("matches on the ticker", () => {
    expect(mentionsInstrument("Analysts lift NVDA price target", nvda)).toBe(true);
  });

  it("rejects a round-up that headlines a different company", () => {
    expect(
      mentionsInstrument("Iovance Biotherapeutics Stock Soars After Strong Q2", nvda),
    ).toBe(false);
  });

  it("matches a distinctive token of a multi-word name", () => {
    expect(mentionsInstrument("Delta cancels hundreds of flights", dal)).toBe(true);
    expect(mentionsInstrument("United raises checked-bag fees", dal)).toBe(false);
  });
});

describe("SimulatedAttributor over the seeded newsroom", () => {
  it("reports NVDA from a major wire", async () => {
    const c = await new SimulatedAttributor().attribute({
      symbol: "NVDA",
      name: "NVIDIA",
      changePct: 7.2,
    });
    expect(c?.confidence).toBe("reported");
    expect(c?.source).toBe("Reuters");
  });

  it("marks AMD unconfirmed (only an aggregator has it)", async () => {
    const c = await new SimulatedAttributor().attribute({
      symbol: "AMD",
      name: "AMD",
      changePct: 3.9,
    });
    expect(c?.confidence).toBe("unconfirmed");
  });

  it("returns null for a move with nothing on the wire (MRNA)", async () => {
    const c = await new SimulatedAttributor().attribute({
      symbol: "MRNA",
      name: "Moderna",
      changePct: 6.4,
    });
    expect(c).toBeNull();
  });
});
