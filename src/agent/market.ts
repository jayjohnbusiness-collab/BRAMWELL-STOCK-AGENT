import type { Instrument } from "./types";
import { SEED } from "./seed";

/*
 * Simulated market feed.
 *
 * This stands in for a real price feed. It is intentionally small and
 * deterministic in structure: the "story of the day" (changePct + cause) is
 * fixed, and only the price digits drift on each tick, so the screen has
 * something to cross-fade without the narrative changing underfoot.
 */

export type Resolution =
  | { status: "ok"; instrument: Instrument }
  | { status: "ambiguous"; heard: string; options: Instrument[] }
  | { status: "none"; heard: string };

export class Market {
  private instruments: Instrument[];

  constructor(seed: Instrument[] = SEED) {
    // Clone so the seed stays pristine and ticks don't mutate module state.
    this.instruments = seed.map((i) => ({ ...i, cause: i.cause }));
  }

  all(): Instrument[] {
    return this.instruments;
  }

  equities(): Instrument[] {
    return this.instruments.filter((i) => i.kind === "equity");
  }

  index(symbol: string): Instrument | undefined {
    return this.instruments.find(
      (i) => i.kind === "index" && i.symbol === symbol,
    );
  }

  held(): Instrument[] {
    return this.instruments.filter((i) => i.held);
  }

  bySymbol(symbol: string): Instrument | undefined {
    const s = symbol.toUpperCase();
    return this.instruments.find((i) => i.symbol === s);
  }

  private changeFor(i: Instrument, day: "today" | "yesterday"): number {
    return day === "today" ? i.changePct : i.prevChangePct;
  }

  /** Movers in a universe, sorted for the requested metric and day. */
  movers(
    universe: "nasdaq" | "watchlist",
    metric: "gainers" | "losers",
    day: "today" | "yesterday",
    limit = 3,
  ): Instrument[] {
    const pool =
      universe === "watchlist" ? this.held() : this.equities();
    const sorted = [...pool].sort((a, b) => {
      const ca = this.changeFor(a, day);
      const cb = this.changeFor(b, day);
      return metric === "gainers" ? cb - ca : ca - cb;
    });
    const directional = sorted.filter((i) => {
      const c = this.changeFor(i, day);
      return metric === "gainers" ? c > 0 : c < 0;
    });
    return directional.slice(0, limit);
  }

  /** How many names cleared a magnitude threshold — for "say the shape, defer". */
  countBeyond(
    universe: "nasdaq" | "watchlist",
    metric: "gainers" | "losers",
    day: "today" | "yesterday",
    threshold: number,
  ): number {
    const pool =
      universe === "watchlist" ? this.held() : this.equities();
    return pool.filter((i) => {
      const c = this.changeFor(i, day);
      return metric === "gainers" ? c >= threshold : c <= -threshold;
    }).length;
  }

  /**
   * Resolve a spoken/typed reference to an instrument.
   * Prefers an exact symbol, then a unique name/alias match, and returns
   * `ambiguous` when a word maps to more than one live instrument — Bramwell
   * proposes rather than silently guessing between two names.
   */
  resolve(text: string): Resolution {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1) Exact ticker symbol as an uppercase token, e.g. "AAPL", "$NVDA".
    const symbolMatch = raw
      .replace(/\$/g, "")
      .match(/\b[A-Z]{2,5}\b/g);
    if (symbolMatch) {
      for (const tok of symbolMatch) {
        const hit = this.bySymbol(tok);
        if (hit) return { status: "ok", instrument: hit };
      }
    }

    // 2) Company name or alias.
    const nameHits = this.instruments.filter((i) => {
      const name = i.name.toLowerCase().replace(/^the\s+/, "");
      if (lower.includes(name)) return true;
      return (i.aliases ?? []).some((a) => matchesWord(lower, a));
    });

    // Collapse a redundant multi-hit that is really one instrument.
    const uniqueSymbols = new Set(nameHits.map((i) => i.symbol));
    if (uniqueSymbols.size === 1) {
      return { status: "ok", instrument: nameHits[0] };
    }
    if (uniqueSymbols.size > 1) {
      return { status: "ambiguous", heard: raw, options: nameHits };
    }

    return { status: "none", heard: raw };
  }

  /**
   * Advance the simulated feed by one tick. Only the price digits drift; the
   * daily change and its cause hold steady so the reporting stays coherent.
   */
  tick(step = 1): void {
    for (const i of this.instruments) {
      // A small, calm walk proportional to price — never a jump.
      const wobble = (pseudo(i.symbol, step) - 0.5) * i.basePrice * 0.0006;
      i.basePrice = Math.max(0.01, i.basePrice + wobble);
    }
  }
}

/** A word-boundary match so "delta" doesn't fire inside "deltas" incidentally. */
function matchesWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(haystack);
}

/**
 * Deterministic pseudo-noise from a symbol + step. Avoids Math.random so a
 * given render is reproducible and testable; still lively enough to animate.
 */
function pseudo(symbol: string, step: number): number {
  let h = 2166136261 ^ step;
  for (let k = 0; k < symbol.length; k++) {
    h = Math.imul(h ^ symbol.charCodeAt(k), 16777619);
  }
  // xorshift to a [0,1) float
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}
