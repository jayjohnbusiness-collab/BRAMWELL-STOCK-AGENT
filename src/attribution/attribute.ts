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
// Below this, whatever survived cleaning is too thin to be a real cause.
const MIN_HEADLINE = 10;

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
      clean: cleanHeadline(i.headline),
      major: isMajor(i.source),
      agreement: agreementOf(headlineSentiment(i.headline), moveSign),
    }))
    // A headline that cleans down to nothing usable (pure clickbait, a fragment)
    // is dropped — better silence than a broken half-sentence.
    .filter((s): s is Scored => s.clean !== null);

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
  const headline = best.clean;

  if (best.major) {
    return {
      text: `a ${source} report has it — ${headline}`,
      source,
      url: best.item.url,
      confidence: "reported",
    };
  }
  // Thin reporting: attribute, but flag it plainly as unconfirmed.
  return {
    text: `there's unconfirmed reporting from ${source} — ${headline}`,
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

type Scored = {
  item: NewsItem;
  clean: string;
  major: boolean;
  agreement: Agreement;
};

// Clickbait tails a real cause never needs — everything from the match on is
// dropped, so "…lifts guidance — here's why it matters" becomes the fact alone.
const CLICKBAIT =
  /\b(here'?s why|here is why|what to know|what it means|what to watch|should you (buy|sell|hold)|is it (a )?(buy|sell|time|still|heading|worth)|is this (a )?|why it matters|why this|and (more|why)|explained|time to buy|buy or sell|is now the time)\b/i;

/**
 * Reduce a raw headline to a single clean clause fit to speak: keep only the
 * first sentence, strip a trailing clickbait tail, cut on a word boundary if
 * it's long, and return null when nothing substantive is left (prefer silence).
 */
function cleanHeadline(headline: string): string | null {
  let h = headline.replace(/\s+/g, " ").trim();
  if (!h) return null;

  // Keep only the first sentence — clickbait titles pile a question on the fact.
  h = h.split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/)[0] ?? h;

  // Drop a trailing clickbait clause (only when there's real text before it).
  const at = h.search(CLICKBAIT);
  if (at > 0) h = h.slice(0, at);

  h = h.replace(/[\s.,:;—–-]+$/, "").trim();
  if (h.length < MIN_HEADLINE) return null;

  if (h.length > MAX_HEADLINE) {
    const cut = h.slice(0, MAX_HEADLINE);
    const sp = cut.lastIndexOf(" ");
    h = `${(sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s.,:;—–-]+$/, "")}…`;
  }
  return h;
}

// Generic corporate words that don't identify a specific company.
const NAME_STOP = new Set([
  "the", "inc", "incorporated", "corp", "corporation", "co", "company",
  "companies", "ltd", "limited", "plc", "llc", "lp", "group", "holdings",
  "holding", "international", "global", "technologies", "technology", "systems",
  "industries", "enterprises", "solutions", "motors", "pharmaceuticals",
  "pharmaceutical", "pharma", "biotherapeutics", "therapeutics", "biosciences",
  "biotech", "laboratories", "labs", "air", "lines", "airlines", "class",
  "and", "of", "ag", "sa", "se", "nv", "oyj", "spa",
]);

function companyTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !NAME_STOP.has(t));
}

/**
 * Does a headline actually reference this instrument (by ticker or a
 * distinctive company-name token)? Used by the live attributor to refuse
 * aggregator round-ups that headline a *different* company while merely
 * tagging this symbol — the "Iovance news on NVDA" failure.
 */
export function mentionsInstrument(
  headline: string,
  ref: { symbol: string; name: string },
): boolean {
  const hay = ` ${headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const sym = ref.symbol.toLowerCase();
  if (sym.length >= 2 && hay.includes(` ${sym} `)) return true;
  return companyTokens(ref.name).some((tok) => hay.includes(` ${tok} `));
}
