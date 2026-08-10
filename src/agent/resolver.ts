import type { Instrument } from "./types";

/*
 * Reference resolution — the hardest problem in the product (spec §5).
 *
 * Speech recognition mangles tickers: letter strings are acoustically thin, and
 * mishears split or distort names ("Broadcom" → "broad com"). This resolver is
 * built to survive that, in a fixed order of decreasing certainty, and to hold
 * the spec's rules:
 *   1. Prefer company names; a symbol still resolves out loud to the company.
 *   2. Recover spelled-out tickers ("N V D A", "en vee dee ay" → NVDA).
 *   3. Recover word-split / lightly-distorted names via squashing + fuzzy match.
 *   4. Propose on genuine ambiguity; never return a confident wrong guess —
 *      below the confidence floor it resolves to "none" (Bramwell says he has
 *      nothing by that name) rather than guessing.
 *
 * Pure and synchronous, so the whole recovery ladder is testable without audio.
 */

export type Resolution =
  | { status: "ok"; instrument: Instrument }
  | { status: "ambiguous"; heard: string; options: Instrument[] }
  // `heard` is the extracted subject; `nearMiss` means it looked like a name
  // attempt (so Bramwell echoes "I heard X") rather than genuine out-of-scope.
  | { status: "none"; heard: string; nearMiss: boolean };

// Fuzzy acceptance: a lone candidate must clear ACCEPT; a runner-up within
// MARGIN of the leader is genuine ambiguity and gets proposed instead. Below
// NEAR, the utterance didn't even look like a name — it's out of scope.
const ACCEPT = 0.75;
const MARGIN = 0.12;
const NEAR = 0.5;

export function resolveReference(text: string, instruments: Instrument[]): Resolution {
  const raw = text.trim();
  const bySymbol = (s: string) =>
    instruments.find((i) => i.symbol === s.toUpperCase());

  // 1) An explicit uppercase symbol token, e.g. "AAPL", "$NVDA".
  const upper = raw.replace(/\$/g, "").match(/\b[A-Z]{2,5}\b/g);
  if (upper) {
    for (const tok of upper) {
      const hit = bySymbol(tok);
      if (hit) return ok(hit);
    }
  }

  const tokens = raw.toLowerCase().replace(/\$/g, "").match(/[a-z0-9]+/g) ?? [];

  // 2) A single token that *is* a symbol, in any case ("nvda").
  for (const tok of tokens) {
    const hit = bySymbol(tok);
    if (hit) return ok(hit);
  }

  // 3) A spelled-out ticker: a run of letters (typed or phonetic) that
  //    assembles into a real symbol. Only accepted if it matches the registry,
  //    so it can't misfire on ordinary speech.
  const spelled = spelledSymbol(tokens, (s) => Boolean(bySymbol(s)));
  if (spelled) return ok(bySymbol(spelled)!);

  // Squashed n-gram windows of the utterance, so "broad com" → "broadcom".
  const windows = windowsOf(tokens);

  // 4) An exact name/alias match. When several tie, prefer the most specific
  //    (longest) matched form; a true collision on the same short form (both
  //    "delta") is genuine ambiguity.
  const exact = instruments
    .map((i) => ({ i, len: exactFormLength(i, windows) }))
    .filter((e) => e.len > 0);
  if (exact.length > 0) {
    const maxLen = Math.max(...exact.map((e) => e.len));
    const top = dedupe(exact.filter((e) => e.len === maxLen).map((e) => e.i));
    if (top.length === 1) return ok(top[0]);
    return { status: "ambiguous", heard: raw, options: top };
  }

  // 5) Fuzzy recovery for lightly-distorted names ("tessla" → Tesla).
  const scored = instruments
    .map((i) => ({ i, score: bestSimilarity(i, windows) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= ACCEPT) {
    const second = scored.find((s) => s.i.symbol !== best.i.symbol);
    if (second && best.score - second.score < MARGIN) {
      return { status: "ambiguous", heard: raw, options: [best.i, second.i] };
    }
    return ok(best.i);
  }

  // Nothing resolved. If it was close to a name, it was likely a mis-heard name
  // attempt — echo it. If it wasn't close to anything, it's out of scope.
  return {
    status: "none",
    heard: subjectPhrase(raw),
    nearMiss: (best?.score ?? 0) >= NEAR,
  };
}

function ok(instrument: Instrument): Resolution {
  return { status: "ok", instrument };
}

function dedupe(items: Instrument[]): Instrument[] {
  const out: Instrument[] = [];
  for (const i of items) if (!out.find((o) => o.symbol === i.symbol)) out.push(i);
  return out;
}

// --- Name forms & matching ------------------------------------------------

/** The squashed strings that should resolve to an instrument: name + aliases. */
function formsOf(i: Instrument): string[] {
  const base = squash(i.name.replace(/^the\s+/i, ""));
  const forms = base ? [base] : [];
  for (const a of i.aliases ?? []) {
    const s = squash(a);
    if (s) forms.push(s);
  }
  return forms;
}

function exactFormLength(i: Instrument, windows: string[]): number {
  let len = 0;
  for (const form of formsOf(i)) {
    if (windows.includes(form)) len = Math.max(len, form.length);
  }
  return len;
}

function bestSimilarity(i: Instrument, windows: string[]): number {
  let best = 0;
  for (const form of formsOf(i)) {
    for (const w of windows) {
      // Only compare windows of a comparable length, so a 2-char window can't
      // spuriously score against a long name.
      if (Math.abs(w.length - form.length) > 3) continue;
      best = Math.max(best, similarity(w, form));
    }
  }
  return best;
}

/** Consecutive 1–3 token windows, squashed to letters/digits. */
function windowsOf(tokens: string[]): string[] {
  const out = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    let acc = "";
    for (let n = 0; n < 3 && i + n < tokens.length; n++) {
      acc += tokens[i + n];
      out.add(acc);
    }
  }
  return [...out];
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Strip query scaffolding to the thing being named, for "I heard X." */
function subjectPhrase(raw: string): string {
  let s = raw.trim().replace(/[?.!,]+$/, "");
  s = s.replace(/^hey\s+bramwell[\s,]*/i, "");
  s = s.replace(
    /^(how'?s|how is|what'?s|what is|price of|quote for|tell me about|show me|about)\s+/i,
    "",
  );
  s = s.replace(/\s+(doing|today|now|please)\b.*$/i, "");
  s = s.replace(/^(the|a|an)\s+/i, "");
  return s.trim();
}

// --- Spelled-out ticker recovery ------------------------------------------

const LETTER: Record<string, string> = {
  a: "A", ay: "A", b: "B", bee: "B", be: "B", c: "C", cee: "C", see: "C",
  sea: "C", d: "D", dee: "D", e: "E", ee: "E", f: "F", ef: "F", eff: "F",
  g: "G", gee: "G", h: "H", aitch: "H", haitch: "H", i: "I", eye: "I",
  j: "J", jay: "J", k: "K", kay: "K", l: "L", el: "L", ell: "L", m: "M",
  em: "M", n: "N", en: "N", o: "O", oh: "O", p: "P", pee: "P", pea: "P",
  q: "Q", cue: "Q", queue: "Q", r: "R", ar: "R", are: "R", s: "S", es: "S",
  ess: "S", t: "T", tee: "T", tea: "T", u: "U", you: "U", v: "V", vee: "V",
  w: "W", x: "X", ex: "X", ecks: "X", y: "Y", why: "Y", z: "Z", zee: "Z",
  zed: "Z",
};

/**
 * Find a run of letter-tokens that assembles into an accepted symbol. Requires
 * at least two letters, and defers acceptance to the registry, so it never
 * fires on ordinary speech.
 */
function spelledSymbol(
  tokens: string[],
  accept: (s: string) => boolean,
): string | null {
  const runs: string[][] = [];
  let run: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    // "double u" / "double you" → W.
    if (tokens[i] === "double" && /^(u|you|w)$/.test(tokens[i + 1] ?? "")) {
      run.push("W");
      i++;
      continue;
    }
    const letter = LETTER[tokens[i]];
    if (letter) {
      run.push(letter);
    } else {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);

  // Prefer the longest run; try its full length down to pairs.
  runs.sort((a, b) => b.length - a.length);
  for (const r of runs) {
    for (let len = Math.min(5, r.length); len >= 2; len--) {
      for (let start = 0; start + len <= r.length; start++) {
        const candidate = r.slice(start, start + len).join("");
        if (accept(candidate)) return candidate;
      }
    }
  }
  return null;
}

// --- String similarity ----------------------------------------------------

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] = Math.min(
        row[j] + 1, // deletion
        row[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = temp;
    }
  }
  return row[n];
}
