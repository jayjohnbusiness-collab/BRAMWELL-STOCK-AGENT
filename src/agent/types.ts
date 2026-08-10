/*
 * Core domain types for the Bramwell agent.
 *
 * The agent brain is deliberately free of React and of any network transport.
 * It takes an utterance plus a session, and returns a reply. That keeps the
 * "butler" logic testable and portable — today it runs in the browser against
 * simulated data; tomorrow it can sit behind an API against a real feed.
 */

export type Sign = "+" | "-" | "";

export interface Cause {
  /** One plain sentence, built from a real headline — never invented. */
  text: string;
  /** Named source when there is one. */
  source: string | null;
  /** Link to the underlying item, when the attributor has one. */
  url?: string;
  /**
   * How firmly it's established. A major-wire report is "reported"; thin
   * reporting is "unconfirmed" and does not clear the unprompted alert bar.
   * Absent (seed/registry causes) is treated as reported.
   */
  confidence?: "reported" | "unconfirmed";
}

export interface Instrument {
  symbol: string;
  /** Company or index name. Bramwell prefers this to the symbol in speech. */
  name: string;
  kind: "equity" | "index";
  sector?: string;
  basePrice: number;
  /** Percent change so far today, e.g. 7.21 means +7.21%. */
  changePct: number;
  /** Percent change on the prior session — supports "and yesterday". */
  prevChangePct: number;
  /**
   * The probable cause of today's move, or null when none is established.
   * A move without a cause never clears the unprompted alert bar.
   */
  cause: Cause | null;
  /** Spoken collisions that force a resolve-out-loud or a proposal. */
  aliases?: string[];
  /** Whether the user holds this instrument (the watchlist). */
  held?: boolean;
}

/** What the last exchange was about, so follow-ups resolve without restatement. */
export interface Subject {
  universe: "nasdaq" | "watchlist";
  metric: "gainers" | "losers" | "status";
  day: "today" | "yesterday";
  /** When the subject is a single instrument (price follow-ups). */
  symbol?: string;
}

export interface Session {
  subject: Subject | null;
}

/** A resolved reply. `spoken` is read aloud; `screen` is the exact, tabular view. */
export interface Reply {
  /** The butler's line: answer → cause → stop. Sentence case, no preamble. */
  spoken: string;
  /** Optional structured payload for the screen (delivered twice, differently). */
  screen?: ScreenPayload;
  /** True when Bramwell is asking a genuine either/or, not guessing. */
  awaitingChoice?: boolean;
}

export type ScreenPayload =
  | { kind: "table"; title: string; rows: Instrument[] }
  | { kind: "quote"; instrument: Instrument }
  | { kind: "none" };

/** An unprompted alert — only emitted when the bar is met (move + cause). */
export interface Alert {
  id: string;
  symbol: string;
  spoken: string;
  instrument: Instrument;
}
