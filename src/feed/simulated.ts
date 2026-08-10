import type { Feed, LookupResult, Quote } from "./types";
import type { Instrument } from "../agent/types";
import { SEED } from "../agent/seed";

/*
 * The simulated feed. The "story of the day" (changePct + cause) holds steady;
 * only the price digits drift on each poll, so the screen has something to
 * cross-fade without the narrative changing underfoot. No network, no keys.
 */
export class SimulatedFeed implements Feed {
  readonly name = "simulated";
  readonly pollMs = 1600;
  private step = 0;
  private book: Instrument[];

  constructor(seed: Instrument[] = SEED) {
    this.book = seed.map((i) => ({ ...i }));
  }

  async lookup(symbol: string): Promise<LookupResult | null> {
    const i = this.book.find((x) => x.symbol === symbol.trim().toUpperCase());
    return i
      ? { symbol: i.symbol, name: i.name, price: i.basePrice, changePct: i.changePct }
      : null;
  }

  async search(query: string): Promise<{ symbol: string; name: string } | null> {
    const q = query.trim().toLowerCase();
    const i = this.book.find(
      (x) =>
        x.symbol.toLowerCase() === q ||
        x.name.toLowerCase().replace(/^the\s+/, "").includes(q),
    );
    return i ? { symbol: i.symbol, name: i.name } : null;
  }

  async quotes(symbols: string[]): Promise<Quote[]> {
    this.step += 1;
    const want = new Set(symbols);
    return this.book
      .filter((i) => want.has(i.symbol))
      .map((i) => {
        // A small, calm walk proportional to price — never a jump.
        const wobble = (pseudo(i.symbol, this.step) - 0.5) * i.basePrice * 0.0006;
        i.basePrice = Math.max(0.01, i.basePrice + wobble);
        // No cause here: a price feed reports the move, not the reason.
        // The attributor owns cause, and omitting it leaves attribution intact
        // across polls (rather than overwriting it every cycle).
        return {
          symbol: i.symbol,
          price: i.basePrice,
          changePct: i.changePct,
          prevChangePct: i.prevChangePct,
        };
      });
  }
}

/**
 * Deterministic pseudo-noise from a symbol + step. Avoids Math.random so a
 * given sequence is reproducible and testable; still lively enough to animate.
 */
function pseudo(symbol: string, step: number): number {
  let h = 2166136261 ^ step;
  for (let k = 0; k < symbol.length; k++) {
    h = Math.imul(h ^ symbol.charCodeAt(k), 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}
