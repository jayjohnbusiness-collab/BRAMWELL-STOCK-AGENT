/*
 * A tiny financial-sentiment lexicon.
 *
 * This is deliberately a lexicon, not a model: it scores a headline as broadly
 * positive, negative, or neutral, and that is all attribution asks of it. It is
 * used only to check whether a headline's direction agrees with the move — a
 * conservative relevance filter — never to generate a directional claim of its
 * own. Neutral is a first-class answer: many real causes are factually worded
 * ("announces supply agreement") and must not be penalized.
 */

export type Sentiment = -1 | 0 | 1;

const POSITIVE = new Set([
  "surge", "surges", "surged", "jump", "jumps", "jumped", "rally", "rallies",
  "rallied", "gain", "gains", "gained", "soar", "soars", "soared", "beat",
  "beats", "tops", "topped", "upgrade", "upgrades", "upgraded", "raise",
  "raises", "raised", "win", "wins", "won", "awarded", "approval", "approved",
  "approves", "record", "strong", "stronger", "growth", "grow", "grows",
  "expand", "expands", "expanded", "expansion", "boost", "boosts", "boosted",
  "outperform", "deal", "deals", "agreement", "partnership", "breakthrough",
  "higher", "rise", "rises", "rose", "climb", "climbs", "climbed", "ease",
  "eases", "eased", "optimism", "upbeat", "demand", "rebound", "rebounds",
]);

const NEGATIVE = new Set([
  "plunge", "plunges", "plunged", "drop", "drops", "dropped", "fall", "falls",
  "fell", "sink", "sinks", "sank", "slump", "slumps", "slumped", "miss",
  "misses", "missed", "cut", "cuts", "downgrade", "downgrades", "downgraded",
  "lower", "lowers", "lowered", "warn", "warns", "warned", "warning", "recall",
  "recalls", "probe", "lawsuit", "investigation", "halt", "halts", "halted",
  "weak", "weaker", "decline", "declines", "declined", "delay", "delays",
  "delayed", "loss", "losses", "layoff", "layoffs", "slash", "slashes",
  "slashed", "below", "disappoint", "disappoints", "disappointing", "fear",
  "fears", "concern", "concerns", "worry", "worries", "worried", "selloff",
  "tumble", "tumbles", "tumbled", "slip", "slips", "slipped", "sued",
]);

/** Broad directional sentiment of a headline: +1, -1, or 0 (neutral/mixed). */
export function headlineSentiment(headline: string): Sentiment {
  const words = headline.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) pos++;
    else if (NEGATIVE.has(w)) neg++;
  }
  if (pos > neg) return 1;
  if (neg > pos) return -1;
  return 0;
}
