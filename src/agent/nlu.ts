/*
 * A small, rules-based intent parser.
 *
 * This is deliberately not a language model. It is the seam where one would
 * go: it returns a structured intent, and the agent (bramwell.ts) turns that
 * into a reply. Follow-ups are represented as *partial* intents — a metric
 * with no universe, or a day with nothing else — and are merged against the
 * held subject upstream, which is exactly how "and yesterday" resolves.
 */

export type Metric = "gainers" | "losers" | "status";
export type Universe = "nasdaq" | "watchlist";
export type Day = "today" | "yesterday";

export interface Intent {
  kind: "wake" | "advice" | "help" | "query" | "watch" | "unwatch" | "unknown";
  metric?: Metric;
  universe?: Universe;
  day?: Day;
  /** True when the text carried any market direction of its own. */
  explicit: boolean;
  text: string;
}

const WAKE = /^\s*(hey\s+)?bramwell\b[\s,.:!?-]*/i;

// Remove is checked before add so "stop watching X" doesn't match "watch".
const UNWATCH =
  /\b(stop watching|stop following|unwatch|unfollow|remove|drop|take off|get rid of|no longer (watch|follow))\b/i;
const WATCH =
  /\b(watch|follow|add|keep an eye on|track|start watching)\b/i;

const ADVICE =
  /\b(should i|shall i|do i|is it a (good |bad )?(buy|sell|time)|worth (buying|selling|it)|good (entry|buy|price|time)|cheap|expensive|overvalued|undervalued|overdue|will it (go|rise|fall|drop|climb)|price target|target price|recommend|advice|hold or sell|buy or sell)\b/i;

const HELP =
  /\b(what can you do|who are you|what are you|how do you work|help me understand|what do you (do|watch|follow))\b/i;

const GAINERS =
  /\b(gainers?|top performers?|best performers?|winners?|leading|leaders|carrying|who'?s up|up the most|biggest gains?|advancers?)\b/i;

const LOSERS =
  /\b(losers?|worst performers?|laggards?|falling|dragging|who'?s down|what'?s down|down the most|biggest (losses|drops)|decliners?)\b/i;

// Direction-agnostic "what's happening" — treated as the day's leaders.
const MOVERS =
  /\b(moving|movers?|what'?s happening|going on|what'?s new|anything moving|whats up|what'?s up)\b/i;

// A filter follow-up: keep the current metric, narrow to the watchlist.
const FILTER =
  /\b(just (the )?ones i (hold|own)|the ones i (hold|own)|just mine|only mine|ones i (hold|own))\b/i;

// A whole-portfolio question — a status read when no metric is present.
const PORTFOLIO =
  /\b(my (portfolio|holdings?|positions?|watchlist)|how('s| is| are) (my|things|we|the portfolio)|my (names?|stuff))\b/i;

const NASDAQ = /\b(nasdaq|the market|overall|broadly|today'?s market)\b/i;

const YESTERDAY = /\b(yesterday|prior session|last session|day before)\b/i;
const TODAY = /\b(today|so far|this session|right now)\b/i;

const MARKETY =
  /\b(up|down|percent|%|move|moving|movers?|price|trading|stock|shares?|index|indices|ticker|market|holdings?|portfolio|performers?)\b/i;

// Filler that is never itself the name being added/removed.
const TARGET_STOP = new Set([
  "it", "them", "that", "this", "these", "those", "one", "ones", "some",
  "the", "a", "an", "my", "our", "list", "stock", "stocks", "share", "shares",
]);

/**
 * Strip command scaffolding from a watch/unwatch utterance down to the bare
 * name. "can you add Shell to my stocks" → "Shell"; "add it" → "" (nothing
 * nameable). This is what the agent resolves against, so filler words like
 * "can" or "stock" can never be mistaken for the ticker.
 */
export function watchTarget(input: string): string {
  let s = input.trim().replace(WAKE, "");
  // Leading politeness: "can you", "could you please", "would you", "please".
  s = s.replace(/^\s*(can|could|would|will)\s+you\s+/i, " ");
  s = s.replace(/^\s*please\s+/i, " ");
  // Destination phrase and everything after it: "to my list", "from my stocks".
  s = s.replace(
    /\b(to|from|on|onto|into|in)\s+(the\s+|my\s+)?(watch\s?list|stock\s?list|stocks?|shares?|list|portfolio|holdings?|names?|positions?)\b.*$/i,
    " ",
  );
  // Command verbs, anywhere.
  s = s.replace(
    /\b(start watching|stop watching|stop following|keep an eye on|no longer (watch|follow)|watch|follow|track|add|remove|drop|unwatch|unfollow|take off|get rid of)\b/gi,
    " ",
  );
  // Any trailing "stock"/"shares"/"please" left dangling ("shell stock").
  s = s.replace(/\b(stock|stocks|shares?|please)\b/gi, " ");
  s = s.replace(/[?.!,]+/g, " ");
  const cleaned = s.replace(/\s+/g, " ").trim();

  // If nothing but filler survived, there's no name to act on.
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "";
  if (words.every((w) => TARGET_STOP.has(w.toLowerCase()))) return "";
  return cleaned;
}

export function parse(input: string): Intent {
  const text = input.trim();
  const stripped = text.replace(WAKE, "").trim();

  // A bare wake word with nothing after it. A butler does not say "Yes?".
  if (WAKE.test(text) && stripped.length === 0) {
    return { kind: "wake", explicit: false, text };
  }

  const body = stripped.length ? stripped : text;

  if (ADVICE.test(body)) return { kind: "advice", explicit: false, text: body };
  if (HELP.test(body)) return { kind: "help", explicit: false, text: body };
  if (UNWATCH.test(body)) return { kind: "unwatch", explicit: false, text: body };
  if (WATCH.test(body)) return { kind: "watch", explicit: false, text: body };

  let metric: Metric | undefined = GAINERS.test(body)
    ? "gainers"
    : LOSERS.test(body)
      ? "losers"
      : undefined;

  const filter = FILTER.test(body);
  const portfolio = PORTFOLIO.test(body);
  const universe: Universe | undefined =
    filter || portfolio ? "watchlist" : NASDAQ.test(body) ? "nasdaq" : undefined;

  // "What's moving?" with no explicit direction → the day's leaders.
  if (!metric && MOVERS.test(body)) metric = "gainers";

  // A whole-portfolio question with no metric and no filter → a status read.
  if (!metric && portfolio && !filter) metric = "status";

  const day: Day | undefined = YESTERDAY.test(body)
    ? "yesterday"
    : TODAY.test(body)
      ? "today"
      : undefined;

  const explicit = Boolean(metric || universe || day);
  if (explicit) return { kind: "query", metric, universe, day, explicit, text: body };

  // Nothing structural. Still let the agent try to resolve an instrument.
  if (MARKETY.test(body)) return { kind: "query", explicit: false, text: body };

  return { kind: "unknown", explicit: false, text: body };
}
