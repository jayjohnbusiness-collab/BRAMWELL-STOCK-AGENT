import type { Cause } from "../agent/types";
import type { AttributionInput, NewsItem } from "./types";
import { headlineSentiment } from "./sentiment";

/*
 * The pure attribution rule — shared by every attributor and fully testable.
 *
 * Given a move and a set of news items, return a probable cause or null. The
 * guarantee that makes this safe: the cause text is *built from a real
 * headline and a named source*, never composed from nothing. No qualifying
 * item → null. This is the anti-fabrication seam; keep the logic here.
 *
 * Attribution rules (spec §7):
 *   - Name the source when there is one.
 *   - Say "unconfirmed" when the reporting is thin (non-major sources).
 *   - Say nothing (null) when there is nothing recent and material.
 *
 * Relevance by direction: a headline whose sentiment *contradicts* the move
 * (bullish news on a name that fell) is refused outright — attaching it would
 * mislead, and silence is the honest answer. Among the rest, a credible source
 * wins first, then directional alignment, then recency. Neutral headlines are
 * kept: most factual causes are neutrally worded.
 */

type Agreement = "aligned" | "neutral" | "conflict";

// Look back far enough to catch the story behind a same-day move, not stale news.
const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const MAX_HEADLINE = 96;

// Major wires and papers of record. A hit here is reportable; anything else is
// treated as unconfirmed, never as an invented certainty.
const MAJOR = [
  "reuters", "bloomberg", "associated press", "the associated press",
  "wall street journal", "wsj", "cnbc", "financial times", "the financial times",
  "new york times", "dow jones", "barron's", "barrons", "ap news",
];

export function attributeFromNews(
  input: AttributionInput,
  items: NewsItem[],
  now: number,
): Cause | null {
  const moveSign = Math.sign(input.changePct);

  const scored = items
    .filter((i) => i.headline?.trim() && i.publishedAt >= now - LOOKBACK_MS)
    .map((i) => ({
      item: i,
      major: isMajor(i.source),
      agreement: agreementOf(headlineSentiment(i.headline), moveSign),
    }));

  // Refuse to attribute a headline that contradicts the move — silence over a
  // misleading cause.
  const eligible = scored.filter((s) => s.agreement !== "conflict");
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.major !== b.major) return Number(b.major) - Number(a.major); // credible source first
    const rank = (x: Agreement) => (x === "aligned" ? 0 : 1);
    if (rank(a.agreement) !== rank(b.agreement)) {
      return rank(a.agreement) - rank(b.agreement); // then directional alignment
    }
    return b.item.publishedAt - a.item.publishedAt; // then recency
  });

  const best = eligible[0];
  const source = cleanSource(best.item.source);
  const headline = trimHeadline(best.item.headline);

  if (best.major) {
    return {
      text: `the move followed a ${source} report: ${headline}`,
      source,
      url: best.item.url,
      confidence: "reported",
    };
  }
  // Thin reporting: attribute, but flag it plainly as unconfirmed.
  return {
    text: `there's unconfirmed reporting from ${source}: ${headline}`,
    source,
    url: best.item.url,
    confidence: "unconfirmed",
  };
}

/** How a headline's sentiment sits against the move direction. */
function agreementOf(sentiment: number, moveSign: number): Agreement {
  if (sentiment === 0 || moveSign === 0) return "neutral";
  return sentiment === moveSign ? "aligned" : "conflict";
}

function isMajor(source: string): boolean {
  const s = source.toLowerCase();
  return MAJOR.some((m) => s.includes(m));
}

function cleanSource(source: string): string {
  return source.trim().replace(/\s+/g, " ");
}

function trimHeadline(headline: string): string {
  const h = headline.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  if (h.length <= MAX_HEADLINE) return h;
  return `${h.slice(0, MAX_HEADLINE - 1).trimEnd()}…`;
}
