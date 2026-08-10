import type { Position } from "./types";
import { loadPositions, savePositions } from "./storage";

/*
 * The book. One position per symbol; setting an existing symbol replaces it.
 * A plain store like the others, read and mutated outside React state.
 */
export class PortfolioStore {
  private list: Position[];

  constructor(initial: Position[] = loadPositions()) {
    this.list = initial;
  }

  all(): Position[] {
    return this.list;
  }

  get(symbol: string): Position | undefined {
    return this.list.find((p) => p.symbol === symbol.toUpperCase());
  }

  /** Add or replace the position for a symbol. Zero shares removes it. */
  set(symbol: string, shares: number, cost: number): void {
    const sym = symbol.toUpperCase();
    const rest = this.list.filter((p) => p.symbol !== sym);
    if (shares > 0) rest.push({ symbol: sym, shares, cost: Math.max(0, cost) });
    this.list = rest;
    this.persist();
  }

  remove(symbol: string): void {
    this.list = this.list.filter((p) => p.symbol !== symbol.toUpperCase());
    this.persist();
  }

  private persist(): void {
    savePositions(this.list);
  }
}
