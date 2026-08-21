import type { Instrument, Reply, Session, Subject } from "./types";
import { Market, type Resolution } from "./market";
import { looseIntent, parse, watchTarget, type Day, type Intent, type Metric } from "./nlu";
import {
  direction,
  magnitudeInWords,
  numberToWords,
  percentInWords,
  spokenChange,
} from "./format";

/*
 * Bramwell — the agent brain.
 *
 * Behaviors implemented from the conversation spec:
 *   §3  Answer → cause → stop. No preamble; the first word is the answer.
 *       Summaries, never recited tables (spoken caps at three items).
 *   §5  Ticker recognition: resolve out loud, propose on genuine ambiguity,
 *       never silently guess between two live instruments.
 *   §6  Hold the subject for the session; follow-ups resolve against it.
 *   §7  Uncertainty stated plainly; a cause is never invented.
 *   §8  Requests for advice are declined in character, then facts handed back.
 *  §10  Failure/So-scope states are brief and specific.
 *  §11  Neutral on gains and losses.
 */
export class Bramwell {
  readonly market: Market;
  private session: Session = { subject: null };
  /** Options awaiting an either/or choice (§5.3) — not a silent guess. */
  private pending: Instrument[] | null = null;

  constructor(market = new Market()) {
    this.market = market;
  }

  get subject(): Subject | null {
    return this.session.subject;
  }

  respond(utterance: string): Reply {
    // A word of thanks or a greeting is met in kind — a butler acknowledges it.
    const courtesy = courtesyReply(utterance);
    if (courtesy) return { spoken: courtesy, screen: { kind: "none" } };

    // A pending disambiguation takes precedence: the user is answering it.
    if (this.pending) {
      const options = this.pending;
      this.pending = null;
      const pick = matchPending(utterance, options);
      if (pick) return this.quoteReply(pick.symbol, "today");
      // Not a choice after all — fall through and treat as a fresh utterance.
    }

    const intent = parse(utterance);
    switch (intent.kind) {
      case "wake":
        // A butler does not announce he has heard you. No bubble; the UI
        // shows a quiet state change instead.
        return { spoken: "", screen: { kind: "none" } };
      case "help":
        return this.helpReply();
      case "advice":
        return this.adviceReply(intent.text);
      case "watch":
        return this.watchReply(intent.text, true);
      case "unwatch":
        return this.watchReply(intent.text, false);
      case "brief":
        return this.briefingReply();
      case "compare":
        return this.compareReply(intent.text);
      case "why":
        return this.whyReply(intent.text);
      case "query":
        return this.handleQuery(intent);
      case "unknown":
      default:
        // Not structurally market-shaped, but it may still name an instrument
        // ("How's Apple?"). Try to resolve before declaring it out of scope.
        return this.tryInstrument(intent.text);
    }
  }

  // --- Query routing ------------------------------------------------------

  private handleQuery(intent: Intent): Reply {
    const subject = this.session.subject;

    // Does the utterance itself name a specific instrument ("How's Tesla…")? If
    // so it's a fresh single-name quote and must win over any held list subject
    // — a stray "today" mustn't turn it into a movers follow-up.
    const namesInstrument = this.market.resolve(intent.text).status === "ok";

    // A pure day-shift on a prior single-name answer: "and yesterday".
    if (
      subject?.symbol &&
      intent.day &&
      !intent.metric &&
      !intent.universe &&
      !namesInstrument
    ) {
      return this.quoteReply(subject.symbol, intent.day);
    }

    // Is this a list query? Either it carries a metric/universe of its own, or
    // it's a bare follow-up ("and yesterday") against a list subject — but not
    // when the utterance plainly names an instrument.
    const hasListSignal =
      intent.metric !== undefined ||
      intent.universe !== undefined ||
      (intent.explicit && subject?.metric !== undefined && !namesInstrument);

    if (hasListSignal) {
      const universe = intent.universe ?? subject?.universe ?? "nasdaq";
      const metric: Metric =
        intent.metric ??
        subject?.metric ??
        (universe === "watchlist" ? "status" : "gainers");
      const day: Day = intent.day ?? subject?.day ?? "today";
      return metric === "status"
        ? this.statusReply(day)
        : this.moversReply(universe, metric, day);
    }

    // Otherwise, read it as a single instrument (a quote).
    return this.tryInstrument(intent.text);
  }

  /** Resolve one instrument: quote it, propose on ambiguity, or bow out. */
  private tryInstrument(text: string): Reply {
    const res = this.market.resolve(text);
    if (res.status === "ok") return this.quoteReply(res.instrument.symbol, "today");
    if (res.status === "ambiguous") return this.ask(res.options);
    // Before giving up: read the phrasing loosely against what he can already
    // answer, so unfamiliar wording ("any names worth watching?") still lands on
    // a real answer instead of a shrug — no teaching required. But if the user
    // clearly named a specific thing (a proper noun, or a near-miss ticker like
    // "Meridian"), that's a name miss to echo back, not a fuzzy list request.
    const named = properNoun(text) !== null || (res.status === "none" && res.nearMiss === true);
    if (!named) {
      const loose = looseIntent(text);
      if (loose && (loose.metric || loose.universe)) {
        const universe = loose.universe ?? "nasdaq";
        const metric: Metric = loose.metric ?? (universe === "watchlist" ? "status" : "gainers");
        return metric === "status" ? this.statusReply("today") : this.moversReply(universe, metric, "today");
      }
    }
    return this.notUnderstood(text, res);
  }

  // --- Reply builders -----------------------------------------------------

  private moversReply(
    universe: "nasdaq" | "watchlist",
    metric: "gainers" | "losers",
    day: Day,
  ): Reply {
    const shown = this.market.movers(universe, metric, day, 3);
    const uni = universe === "watchlist" ? "your holdings" : "the Nasdaq";
    const when = day === "yesterday" ? " yesterday" : "";

    this.session.subject = { universe, metric, day };

    if (shown.length === 0) {
      const dir = metric === "gainers" ? "up" : "down";
      return {
        spoken: `Nothing much ${dir}${when || " today"} across ${uni}, I'm afraid — it's quiet ${
          metric === "gainers" ? "on the upside" : "on the downside"
        }.`,
        screen: { kind: "none" },
      };
    }

    const totalDir = this.market.movers(universe, metric, day, 99).length;
    const dirWord = metric === "gainers" ? "up" : "down";

    // Lead-in: name the shape, don't recite a leaderboard.
    let lead: string;
    if (totalDir > shown.length) {
      lead = `${cap(numberToWords(totalDir))} names are ${dirWord}${when} across ${uni}, and these ${
        numberToWords(shown.length)
      } are carrying it.`;
    } else {
      const carry = metric === "gainers" ? "carrying it" : "weighing on it";
      lead =
        shown.length > 1
          ? `A handful of names are ${carry}${when}.`
          : `Just the one name is ${carry}${when}.`;
    }

    const list = listSentence(shown, day);

    // Connective tissue — the point of the summary.
    const tail = sectorTail(shown);

    return {
      spoken: `${lead} ${list}${tail}`,
      screen: {
        kind: "table",
        title: `${uni === "the Nasdaq" ? "Nasdaq" : "Your holdings"} — ${
          metric === "gainers" ? "gainers" : "losers"
        }${day === "yesterday" ? ", prior session" : ""}`,
        rows: shown,
      },
    };
  }

  private statusReply(day: Day): Reply {
    const held = this.market.held();
    this.session.subject = { universe: "watchlist", metric: "status", day };

    if (held.length === 0) {
      return {
        spoken:
          "Nothing to report just yet — add a name and I'll keep an eye on it for you.",
        screen: { kind: "none" },
      };
    }

    const changes = held.map((h) => (day === "yesterday" ? h.prevChangePct : h.changePct));
    const ups = changes.filter((c) => c > 0.05).length;
    const downs = changes.filter((c) => c < -0.05).length;
    const n = held.length;
    const when = day === "yesterday" ? " yesterday" : "";

    let spoken: string;
    if (downs === n) {
      spoken = `All ${numberToWords(n)} of the names you follow are lower${when}, ${rangePhrase(changes)} — it looks sector-wide rather than about any one of them.`;
    } else if (ups === n) {
      spoken = `All ${numberToWords(n)} of the names you follow are higher${when}, ${rangePhrase(changes)} — broad, rather than any one in particular.`;
    } else {
      const dv = downs === 1 ? "is" : "are";
      spoken = `Of the ${numberToWords(n)} names you follow, ${numberToWords(downs)} ${dv} down and ${numberToWords(ups)} up${when}. ${mixedTail(held, day)}`;
    }

    return {
      spoken,
      screen: {
        kind: "table",
        title: `Your holdings${day === "yesterday" ? ", prior session" : ""}`,
        rows: held,
      },
    };
  }

  private quoteReply(symbol: string, day: Day): Reply {
    const i = this.market.bySymbol(symbol);
    if (!i) return this.notUnderstood(symbol);

    const change = day === "yesterday" ? i.prevChangePct : i.changePct;
    const when = day === "yesterday" ? " yesterday" : " today";
    // Resolve out loud: name the company even if the user used the symbol.
    let spoken = `${cap(i.name)}'s ${spokenChange(change)}${when}.`;

    if (day === "today") {
      if (i.cause) {
        spoken += ` ${cap(i.cause.text)}.`;
      } else if (Math.abs(change) >= 3) {
        // A notable move with nothing behind it — say so, never invent one.
        spoken += ` I don't have a reason for it yet, I'm afraid — nothing on the wire. I'll let you know the moment there is.`;
      }
    }

    this.session.subject = {
      universe: "nasdaq",
      metric: this.session.subject?.metric ?? "gainers",
      day,
      symbol: i.symbol,
    };

    return { spoken, screen: { kind: "quote", instrument: i } };
  }

  private adviceReply(text: string): Reply {
    const res = this.market.resolve(text);
    if (res.status === "ok") {
      const i = res.instrument;
      const cause = i.cause ? ` ${cap(i.cause.text)}.` : "";
      this.session.subject = {
        universe: "nasdaq",
        metric: this.session.subject?.metric ?? "gainers",
        day: "today",
        symbol: i.symbol,
      };
      return {
        spoken: `That's not mine to say, I'm afraid — but I can tell you ${cap(i.name)}'s ${spokenChange(
          i.changePct,
        )} today.${cause}`,
        screen: { kind: "quote", instrument: i },
      };
    }
    return {
      spoken:
        "That's not mine to say, I'm afraid. Name the company and I'll give you the facts I have.",
      screen: { kind: "none" },
    };
  }

  /** Add or remove a name from the watchlist, confirmed in character. */
  private watchReply(text: string, add: boolean): Reply {
    // Resolve against the name alone, not the whole command — "add Shell to my
    // stocks" must resolve "Shell", never the scaffolding around it.
    const target = watchTarget(text) || text;
    const res = this.market.resolve(target);
    if (res.status === "ambiguous") {
      // Don't guess which to watch; ask, but plainly (no pending quote here).
      const [a, b] = distinct(res.options);
      return {
        spoken: `Which would that be — ${a.name}, or ${b.name}? Say the word and I'll ${
          add ? "add it" : "take it off"
        }.`,
        screen: { kind: "none" },
      };
    }
    if (res.status !== "ok") return this.notUnderstood(target, res);

    const i = res.instrument;
    if (add) {
      if (this.market.isWatched(i.symbol)) {
        return {
          spoken: `${cap(i.name)}'s already on your list.`,
          screen: { kind: "quote", instrument: i },
        };
      }
      this.market.watch(i.symbol);
      return {
        spoken: `Of course. I'll keep an eye on ${cap(i.name)} for you.`,
        screen: { kind: "quote", instrument: i },
      };
    }

    if (!this.market.unwatch(i.symbol)) {
      return {
        spoken: `${cap(i.name)} wasn't on your list to begin with.`,
        screen: { kind: "none" },
      };
    }
    return {
      spoken: `Consider it done — ${cap(i.name)}'s off your list.`,
      screen: { kind: "none" },
    };
  }

  /** The session briefing — breadth, the standout mover each way, with cause. */
  private briefingReply(): Reply {
    const held = this.market.held();
    if (held.length === 0) {
      return {
        spoken: "Nothing on your watch just yet — add a few names and I'll keep the book for you.",
        screen: { kind: "none" },
      };
    }
    const ups = held.filter((i) => i.changePct > 0.05);
    const downs = held.filter((i) => i.changePct < -0.05);
    const topUp = [...ups].sort((a, b) => b.changePct - a.changePct)[0];
    const topDown = [...downs].sort((a, b) => a.changePct - b.changePct)[0];

    const parts: string[] = [];
    parts.push(
      `Here's where things stand: of the ${numberToWords(held.length)} names you follow, ${numberToWords(
        ups.length,
      )} ${ups.length === 1 ? "is" : "are"} up and ${numberToWords(downs.length)} down.`,
    );
    if (topUp) {
      parts.push(
        `${shortName(topUp)}'s leading, ${spokenChange(topUp.changePct)}.${
          topUp.cause ? ` ${cap(topUp.cause.text)}.` : ""
        }`,
      );
    }
    if (topDown && topDown.symbol !== topUp?.symbol) {
      parts.push(
        `${shortName(topDown)}'s the softest, ${spokenChange(topDown.changePct)}.${
          topDown.cause ? ` ${cap(topDown.cause.text)}.` : ""
        }`,
      );
    }
    if (!topUp && !topDown) {
      parts.push("It's flat across your names — nothing pulling either way.");
    }

    this.session.subject = { universe: "watchlist", metric: "status", day: "today" };
    return { spoken: parts.join(" "), screen: { kind: "table", title: "Your holdings", rows: held } };
  }

  /** Two names, side by side, with who has the better of the day. */
  private compareReply(text: string): Reply {
    const resolved: Instrument[] = [];
    for (const n of splitCompare(text)) {
      const r = this.market.resolve(n);
      if (r.status === "ok" && !resolved.find((x) => x.symbol === r.instrument.symbol)) {
        resolved.push(r.instrument);
      }
      if (resolved.length === 2) break;
    }
    if (resolved.length < 2) {
      return {
        spoken: "Give me two names I follow and I'll set them side by side.",
        screen: { kind: "none" },
      };
    }
    const [a, b] = resolved;
    const stronger = a.changePct >= b.changePct ? a : b;
    const gap = Math.abs(a.changePct - b.changePct);
    const tail = gap >= 0.1 ? `, by ${percentInWords(gap)}` : "";
    return {
      spoken: `${shortName(a)}'s ${spokenChange(a.changePct)}, ${shortName(b)}'s ${spokenChange(
        b.changePct,
      )} — ${shortName(stronger)} has the better of it today${tail}.`,
      screen: { kind: "table", title: `${a.symbol} vs ${b.symbol}`, rows: [a, b] },
    };
  }

  /** "Why?" — resolved against a named instrument, else the held subject. */
  private whyReply(text: string): Reply {
    const res = this.market.resolve(text);
    if (res.status === "ok" && res.instrument.kind === "equity") {
      return this.quoteReply(res.instrument.symbol, "today");
    }
    if (res.status === "ambiguous") return this.ask(res.options);

    // Did the user name a specific thing ("PLNTR why?") that didn't resolve?
    // Answer honestly rather than falling back to a movers list.
    const named = whySubject(text);
    if (named) {
      const r2 = this.market.resolve(named);
      if (r2.status === "ok" && r2.instrument.kind === "equity") {
        return this.quoteReply(r2.instrument.symbol, "today");
      }
      if (r2.status === "ambiguous") return this.ask(r2.options);
      return this.notUnderstood(named, r2);
    }

    // A bare "why" — resolved against whatever we were just discussing.
    const s = this.session.subject;
    if (s?.symbol) return this.quoteReply(s.symbol, "today");
    if (s) {
      const metric = s.metric === "losers" ? "losers" : "gainers";
      return this.moversReply(s.universe, metric, s.day);
    }
    return {
      spoken: "About which name? Tell me and I'll give you the reason I have.",
      screen: { kind: "none" },
    };
  }

  private helpReply(): Reply {
    return {
      spoken:
        "I keep an eye on the names and indices you set, and I speak up when something's worth it. Ask me how a name's doing, what's moving today, or to watch a level — I'll handle the rest.",
      screen: { kind: "none" },
    };
  }

  private ask(options: Instrument[]): Reply {
    // Distinct instruments, at most two, proposed as an either/or.
    const [a, b] = distinct(options);
    this.pending = [a, b];
    return {
      spoken: `Do you mean ${a.name}, or ${b.name}?`,
      screen: { kind: "none" },
      awaitingChoice: true,
    };
  }

  private notUnderstood(text: string, res?: Resolution): Reply {
    // Prefer a capitalized proper noun; for a lowercase voice transcript, fall
    // back to the resolver's near-miss subject ("how's tesler" → "Tesler").
    let heard = properNoun(text);
    if (!heard && res?.status === "none" && res.nearMiss && res.heard) {
      heard = cap(res.heard);
    }
    if (heard) {
      // Repeat what was heard; don't ask them to repeat themselves (§10).
      return {
        spoken: `I heard "${heard}" — I don't have anything by that name, I'm afraid.`,
        screen: { kind: "none" },
      };
    }
    return this.outOfScope(text);
  }

  private outOfScope(_text: string): Reply {
    return {
      spoken: "That's a little outside what I follow, I'm afraid.",
      screen: { kind: "none" },
      // Nothing in Bramwell's knowledge answered this — the app may offer to
      // learn the answer so he can give it next time.
      learnable: true,
    };
  }
}

/*
 * A courtesy reply to thanks or a greeting — returned before anything else so a
 * bare "thank you, Bramwell" is met in kind rather than parsed as a query.
 * Returns null when the utterance is doing real work (e.g. "thanks, how's NVDA?"),
 * so only a standalone pleasantry is answered this way.
 */
const THANKS_RE =
  /\b(thank you|thanks|thank u|thankyou|much appreciated|appreciate (it|that|you)|cheers|nice one|good stuff|well done|you'?re a (star|gem|legend)|ta)\b/i;
const GREET_RE = /\b(good morning|good afternoon|good evening|good day|hello|hi there|hey there|greetings|howdy)\b/i;
const THANKS_REPLIES = [
  "My pleasure.",
  "At your service.",
  "Happy to help — any time.",
  "Of course. That's what I'm here for.",
  "Delighted to be of use.",
];

function courtesyReply(utterance: string): string | null {
  // Strip the wake word and any address to Bramwell, then anything that isn't a
  // letter — what's left is the bare pleasantry, if that's all it was.
  const bare = utterance
    .replace(/^\s*(hey\s+|hi\s+|ok\s+|okay\s+)?bramwell\b/i, " ")
    .replace(/\bbramwell\b/gi, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare) return null;
  const words = bare.split(" ");
  // Only treat it as a pleasantry when that's essentially the whole message —
  // a longer sentence is a real request that happens to open with "thanks".
  if (words.length > 5) return null;

  if (THANKS_RE.test(bare)) {
    // Rotate deterministically by length so it varies without Math.random.
    return THANKS_REPLIES[bare.length % THANKS_REPLIES.length];
  }
  if (GREET_RE.test(bare) || /^(morning|afternoon|evening|hello|hi|hey|yo)$/.test(bare)) {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return `${part}. How can I help?`;
  }
  return null;
}

// --- Pure helpers ---------------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Strip the "why" scaffolding to whatever name (if any) was asked about. */
function whySubject(text: string): string {
  return text
    .replace(
      /\b(why'?s?|what'?s|what|is|are|was|were|driving|behind|going on with|causing|caused|how come|happened|to|with|the|a|an|it|that|this|now|today|up|down|so|then|about|doing|move|moving|moved)\b/gi,
      " ",
    )
    .replace(/[^\w.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a compare utterance into candidate names ("NVDA vs AMD" → [NVDA, AMD]). */
function splitCompare(text: string): string[] {
  return text
    .replace(/\b(compared? (to|with|against)|versus|vs\.?|against)\b/gi, " | ")
    .replace(/\b(compare|how'?s|how are|what about|the|between)\b/gi, " ")
    .split(/\||\band\b|\bor\b|&|,|\//i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The first two distinct instruments (by symbol) from a hit list. */
function distinct(options: Instrument[]): [Instrument, Instrument] {
  const out: Instrument[] = [];
  for (const o of options) {
    if (!out.find((d) => d.symbol === o.symbol)) out.push(o);
    if (out.length === 2) break;
  }
  return [out[0], out[1]];
}

/** "Palantir is up nine percent, NVDA seven, and Broadcom four and a half." */
function listSentence(items: Instrument[], day: Day): string {
  const parts = items.map((i, idx) => {
    const c = day === "yesterday" ? i.prevChangePct : i.changePct;
    if (idx === 0) return `${shortName(i)}'s ${spokenChange(c)}`;
    return `${shortName(i)} ${magnitudeInWords(c)}`;
  });
  if (parts.length === 1) return `${parts[0]}.`;
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}.`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}.`;
}

/** In speech Bramwell uses the plain name; strips a leading article. */
function shortName(i: Instrument): string {
  return cap(i.name.replace(/^the\s+/i, ""));
}

/** The connective tissue: one sector story, or the top name's cause. */
function sectorTail(items: Instrument[]): string {
  if (items.length > 1) {
    const sectors = new Set(items.map((i) => i.sector).filter(Boolean));
    if (sectors.size === 1) {
      const sector = [...sectors][0];
      const n = numberToWords(items.length);
      return ` All ${n} are ${sector} — it looks like one sector story rather than ${n} separate ones.`;
    }
  }
  const lead = items[0];
  if (lead?.cause) return ` ${cap(lead.cause.text)}.`;
  if (lead && Math.abs(lead.changePct) >= 3) {
    return ` I don't have a single reason for it yet.`;
  }
  return "";
}

/** "between two and four percent", or "about seven percent" when they cluster. */
function rangePhrase(changes: number[]): string {
  const mags = changes.map((c) => Math.abs(c));
  const lo = Math.min(...mags);
  const hi = Math.max(...mags);
  if (hi - lo < 0.75) return `about ${percentInWords((lo + hi) / 2)}`;
  return `between ${percentInWords(lo)} and ${percentInWords(hi)}`;
}

function mixedTail(held: Instrument[], day: Day): string {
  // Name the largest mover in either direction, without editorializing.
  const sorted = [...held].sort((a, b) => {
    const ca = day === "yesterday" ? a.prevChangePct : a.changePct;
    const cb = day === "yesterday" ? b.prevChangePct : b.changePct;
    return Math.abs(cb) - Math.abs(ca);
  });
  const top = sorted[0];
  const c = day === "yesterday" ? top.prevChangePct : top.changePct;
  return `${shortName(top)} is the mover, ${direction(c)} ${percentInWords(c)}.`;
}

/*
 * Pull a plausible proper-noun candidate to echo back in "I heard …".
 * Stored lower-cased and compared case-insensitively, so all-caps typing
 * ("CAN YOU ADD SHELL…") skips the filler too and echoes "Shell", not "Can".
 */
const STOP = new Set(
  [
    "the", "this", "that", "what", "when", "where", "why", "how", "who", "whats",
    "is", "are", "was", "should", "could", "would", "will", "can", "do", "does",
    "did", "my", "our", "you", "your", "and", "or", "to", "from", "on", "in",
    "into", "onto", "it", "them", "me", "please", "nasdaq", "bramwell", "hey",
    "show", "tell", "give", "list", "stock", "stocks", "share", "shares",
    "portfolio", "holdings", "holding", "positions", "position", "names", "name",
    // Leading quantifiers/fillers that begin a fuzzy request — never a ticker,
    // so they don't get echoed as "I heard 'Any'".
    "any", "anything", "some", "something", "which", "there", "worth", "out",
    "eyes", "eye", "looking", "look", "watching", "keeping", "about", "for",

    // Command verbs, so "Watch Meridian" echoes "Meridian", not "Watch".
    "watch", "follow", "add", "track", "remove", "drop", "stop", "unwatch",
    "unfollow", "keep", "start", "take", "get",
  ].map((w) => w.toLowerCase()),
);
function properNoun(text: string): string | null {
  const matches = text.match(/\b([A-Z][a-zA-Z]{2,})\b/g);
  if (!matches) return null;
  for (const m of matches) {
    if (!STOP.has(m.toLowerCase())) return m;
  }
  return null;
}

/** Resolve a user's answer to a proposed either/or choice. */
function matchPending(
  utterance: string,
  options: Instrument[],
): Instrument | undefined {
  const t = utterance.toLowerCase();
  if (/\b(first|former|one|1)\b/.test(t)) return options[0];
  if (/\b(second|latter|two|2|other)\b/.test(t)) return options[1];
  return options.find((o) => {
    const name = o.name.toLowerCase();
    if (t.includes(name)) return true;
    if (o.sector && t.includes(o.sector)) return true;
    // A distinguishing word from the name, e.g. "airline" → "Delta Air Lines".
    return name
      .split(/\s+/)
      .some((w) => w.length > 3 && t.includes(w.replace(/s$/, "")));
  });
}
