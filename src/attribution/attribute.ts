import type { Cause } from "../agent/types";
import type { AttributionInput, NewsItem } from "./types";

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
 */

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
  // Reserved for future relevance scoring (move size / direction vs. headline);
  // today the items are already company-scoped, so selection is by source+time.
  _input: AttributionInput,
  items: NewsItem[],
  now: number,
): Cause | null {
  const recent = items.filter(
    (i) => i.headline?.trim() && i.publishedAt >= now - LOOKBACK_MS,
  );
  if (recent.length === 0) return null; // nothing recent → say nothing

  // Rank major sources first, then most recent.
  const ranked = [...recent].sort((a, b) => {
    const major = Number(isMajor(b.source)) - Number(isMajor(a.source));
    if (major !== 0) return major;
    return b.publishedAt - a.publishedAt;
  });

  const best = ranked[0];
  const source = cleanSource(best.source);
  const headline = trimHeadline(best.headline);

  if (isMajor(best.source)) {
    return {
      text: `the move followed a ${source} report: ${headline}`,
      source,
      url: best.url,
      confidence: "reported",
    };
  }
  // Thin reporting: attribute, but flag it plainly as unconfirmed.
  return {
    text: `there's unconfirmed reporting from ${source}: ${headline}`,
    source,
    url: best.url,
    confidence: "unconfirmed",
  };
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
