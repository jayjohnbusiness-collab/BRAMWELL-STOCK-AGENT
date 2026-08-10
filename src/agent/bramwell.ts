import type { Instrument, Reply, Session, Subject } from "./types";
import { Market } from "./market";
import { parse, type Day, type Intent, type Metric } from "./nlu";
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

    // A pure day-shift on a prior single-name answer: "and yesterday".
    if (
      subject?.symbol &&
      intent.day &&
      !intent.metric &&
      !intent.universe &&
      this.market.resolve(intent.text).status !== "ok"
    ) {
      return this.quoteReply(subject.symbol, intent.day);
    }

    // Is this a list query? Either it carries a metric/universe of its own, or
    // it's a bare follow-up ("and yesterday") against a list subject.
    const hasListSignal =
      intent.metric !== undefined ||
      intent.universe !== undefined ||
      (intent.explicit && subject?.metric !== undefined);

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
    return this.notUnderstood(text);
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
        spoken: `Nothing in ${uni} is ${dir}${when || " today"}. Quiet ${
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
      lead = `${cap(numberToWords(totalDir))} names are ${dirWord}${when} in ${uni}; these ${
        numberToWords(shown.length)
      } are carrying it.`;
    } else {
      const carry = metric === "gainers" ? "carrying it" : "weighing on it";
      lead =
        shown.length > 1
          ? `${cap(numberToWords(shown.length))} names are ${carry}${when}.`
          : `One name is ${carry}${when}.`;
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
          "Nothing worth reporting. Add a name and I'll keep an eye on it.",
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
      spoken = `The ${numberToWords(n)} holdings you follow are all lower${when}, ${rangePhrase(changes)}. It looks sector-wide rather than specific to any of them.`;
    } else if (ups === n) {
      spoken = `The ${numberToWords(n)} holdings you follow are all higher${when}, ${rangePhrase(changes)}. Broad rather than any one of them in particular.`;
    } else {
      const dv = downs === 1 ? "is" : "are";
      spoken = `Of the ${numberToWords(n)} holdings you follow, ${numberToWords(downs)} ${dv} down and ${numberToWords(ups)} up${when}. ${mixedTail(held, day)}`;
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
    const when = day === "yesterday" ? " yesterday" : "";
    // Resolve out loud: name the company even if the user used the symbol.
    let spoken = `${cap(i.name)} is ${spokenChange(change)}${when}.`;

    if (day === "today") {
      if (i.cause) {
        spoken += ` ${cap(i.cause.text)}.`;
      } else if (Math.abs(change) >= 3) {
        // A notable move with nothing behind it — say so, never invent one.
        spoken += ` I don't have a reason for it yet — no filing, no wire story. I'll tell you when there is one.`;
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
      const cause = i.cause ? ` — ${i.cause.text}` : "";
      this.session.subject = {
        universe: "nasdaq",
        metric: this.session.subject?.metric ?? "gainers",
        day: "today",
        symbol: i.symbol,
      };
      return {
        spoken: `That's not mine to say. I can tell you ${cap(i.name)} is ${spokenChange(
          i.changePct,
        )} today${cause}.`,
        screen: { kind: "quote", instrument: i },
      };
    }
    return {
      spoken:
        "That's not mine to say. Name the instrument and I'll give you the facts I have.",
      screen: { kind: "none" },
    };
  }

  /** Add or remove a name from the watchlist, confirmed in character. */
  private watchReply(text: string, add: boolean): Reply {
    const res = this.market.resolve(text);
    if (res.status === "ambiguous") {
      // Don't guess which to watch; ask, but plainly (no pending quote here).
      const [a, b] = distinct(res.options);
      return {
        spoken: `${a.name}, or ${b.name}? Tell me which and I'll ${
          add ? "add it" : "take it off"
        }.`,
        screen: { kind: "none" },
      };
    }
    if (res.status !== "ok") return this.notUnderstood(text);

    const i = res.instrument;
    if (add) {
      if (this.market.isWatched(i.symbol)) {
        return {
          spoken: `${cap(i.name)} is already on the list.`,
          screen: { kind: "quote", instrument: i },
        };
      }
      this.market.watch(i.symbol);
      return {
        spoken: `Done. I'll keep an eye on ${cap(i.name)}.`,
        screen: { kind: "quote", instrument: i },
      };
    }

    if (!this.market.unwatch(i.symbol)) {
      return {
        spoken: `${cap(i.name)} wasn't on the list.`,
        screen: { kind: "none" },
      };
    }
    return {
      spoken: `Off the list — ${cap(i.name)}.`,
      screen: { kind: "none" },
    };
  }

  private helpReply(): Reply {
    return {
      spoken:
        "I watch the tickers and indices you set, and I speak up when something is worth it. Ask me how a name is doing, or what's moving today.",
      screen: { kind: "none" },
    };
  }

  private ask(options: Instrument[]): Reply {
    // Distinct instruments, at most two, proposed as an either/or.
    const [a, b] = distinct(options);
    this.pending = [a, b];
    return {
      spoken: `${a.name}, or ${b.name}?`,
      screen: { kind: "none" },
      awaitingChoice: true,
    };
  }

  private notUnderstood(text: string): Reply {
    const heard = properNoun(text);
    if (heard) {
      // Repeat what was heard; don't ask them to repeat themselves (§10).
      return {
        spoken: `I heard "${heard}." I don't have anything by that name.`,
        screen: { kind: "none" },
      };
    }
    return this.outOfScope(text);
  }

  private outOfScope(_text: string): Reply {
    return {
      spoken: "That's outside what I follow.",
      screen: { kind: "none" },
    };
  }
}

// --- Pure helpers ---------------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    if (idx === 0) return `${shortName(i)} is ${spokenChange(c)}`;
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

/** Pull a plausible proper-noun candidate to echo back in "I heard …". */
const STOP = new Set([
  "The", "This", "That", "What", "When", "Where", "Why", "How", "Who", "Whats",
  "Is", "Are", "Was", "Should", "Could", "Would", "Do", "Does", "Did", "My",
  "And", "Or", "Nasdaq", "Bramwell", "Hey", "Show", "Tell", "Give",
  // Command verbs, so "Watch Meridian" echoes "Meridian", not "Watch".
  "Watch", "Follow", "Add", "Track", "Remove", "Drop", "Stop", "Unwatch",
  "Unfollow", "Keep", "Start", "Take", "Get",
]);
function properNoun(text: string): string | null {
  const matches = text.match(/\b([A-Z][a-zA-Z]{2,})\b/g);
  if (!matches) return null;
  for (const m of matches) {
    if (!STOP.has(m)) return m;
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
