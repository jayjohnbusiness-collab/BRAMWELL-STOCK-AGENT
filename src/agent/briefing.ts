import { numberToWords, spokenChange } from "./format";
import type { MarketPhase } from "../market/hours";

/*
 * The morning briefing — Bramwell's unprompted greeting on the first open of
 * the day, and the fuller answer to "brief me" on demand.
 *
 * Pure and synchronous: App gathers the inputs (the watchlist snapshot, the
 * book's totals, today's earnings among the user's names, any standing alert
 * whose condition is already met) and this composes the butler's line. Keeping
 * it here, away from React and the network, means the wording is testable.
 */

export interface BriefingHolding {
  symbol: string;
  name: string;
  changePct: number;
  cause?: { text: string } | null;
}

export interface BriefingBook {
  /** Today's change across the book, in dollars. */
  dayAbs: number;
  /** Whether any position carries a cost basis (so overall P/L means something). */
  hasBasis: boolean;
  plAbs: number;
  plPct: number;
  marketValue: number;
}

export interface BriefingInput {
  /** Local hour, 0–23, for the salutation. */
  hour: number;
  /** First open of the day → a full "Good morning" greeting; else a lighter opener. */
  firstOfDay: boolean;
  held: BriefingHolding[];
  /** The book's totals, or null when nothing is recorded. */
  book: BriefingBook | null;
  /** Names among the user's holdings reporting earnings today. */
  earningsToday: string[];
  /** Names whose standing alert condition is already met. */
  alertsMet: string[];
  /** The market phase, so the greeting can note pre-market / after-hours / closed. */
  marketPhase?: MarketPhase;
}

/**
 * Compose the briefing, or null when there's genuinely nothing to say (an empty
 * watchlist with no book, no earnings, no alerts) — better silence than a
 * hollow greeting.
 */
export function composeMorningBriefing(input: BriefingInput): string | null {
  const { held, book, earningsToday, alertsMet } = input;
  const hasBook = book != null && book.marketValue > 0;
  if (held.length === 0 && !hasBook && earningsToday.length === 0 && alertsMet.length === 0) {
    return null;
  }

  const parts: string[] = [];

  // 1. Salutation, then a note on the market's state when it isn't open.
  if (input.firstOfDay) {
    parts.push(`${salutation(input.hour)}.`);
  }
  if (input.marketPhase && input.marketPhase !== "open") {
    parts.push(marketClause(input.marketPhase));
  }

  // 2. The day's posture across the names followed, with the standout mover.
  if (held.length > 0) {
    const ups = held.filter((i) => i.changePct > 0.05);
    const downs = held.filter((i) => i.changePct < -0.05);
    const topUp = [...ups].sort((a, b) => b.changePct - a.changePct)[0];
    const topDown = [...downs].sort((a, b) => a.changePct - b.changePct)[0];

    if (ups.length === 0 && downs.length === 0) {
      parts.push(
        `Your ${numberToWords(held.length)} names are quiet so far — nothing pulling either way.`,
      );
    } else {
      parts.push(
        `Of the ${numberToWords(held.length)} names you follow, ${numberToWords(ups.length)} ${
          ups.length === 1 ? "is" : "are"
        } up and ${numberToWords(downs.length)} down.`,
      );
      if (topUp) {
        parts.push(
          `${shortName(topUp.name)}'s leading, ${spokenChange(topUp.changePct)}.${
            topUp.cause ? ` ${cap(topUp.cause.text)}.` : ""
          }`,
        );
      }
      if (topDown && topDown.symbol !== topUp?.symbol) {
        parts.push(`${shortName(topDown.name)}'s the softest, ${spokenChange(topDown.changePct)}.`);
      }
    }
  }

  // 3. The book, if there's one.
  if (hasBook && book) {
    const dir = book.dayAbs >= 0 ? "up" : "down";
    let line = `Your book's ${dir} ${money(Math.abs(book.dayAbs))} on the day`;
    if (book.hasBasis) {
      line += `, ${book.plAbs >= 0 ? "ahead" : "behind"} ${money(Math.abs(book.plAbs))} overall.`;
    } else {
      line += ".";
    }
    parts.push(line);
  }

  // 4. Earnings among the user's names, today.
  if (earningsToday.length > 0) {
    const names = earningsToday.map(shortName);
    parts.push(
      earningsToday.length === 1
        ? `${names[0]} reports today.`
        : `${listSentence(names)} report today.`,
    );
  }

  // 5. Standing alerts already met.
  if (alertsMet.length > 0) {
    const names = alertsMet.map(shortName);
    parts.push(
      alertsMet.length === 1
        ? `And ${names[0]} has already hit a mark you set — worth a look.`
        : `And ${listSentence(names)} have already hit marks you set — worth a look.`,
    );
  }

  return parts.join(" ");
}

/** A short note on the market's state when it isn't in the regular session. */
function marketClause(phase: MarketPhase): string {
  if (phase === "premarket") return "We're pre-market — here's the overnight lay of the land.";
  if (phase === "afterhours") return "We're after-hours now — here's where your names settled.";
  return "The market's closed just now — here's where things stand."; // closed / weekend
}

/** "Good morning" / "Good afternoon" / "Good evening" by the hour. */
function salutation(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "$1,234" — whole dollars for a briefing read aloud. */
function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** "A", "A and B", "A, B and C". */
function listSentence(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The company's short name — drop a leading "the", the first word is enough. */
function shortName(name: string): string {
  const t = name.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
