import type { Position } from "./types";

/* Positions persist locally — the book survives a reload. */

const KEY = "bramwell.positions.v1";

export function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is Position =>
          typeof (p as Position)?.symbol === "string" &&
          typeof (p as Position)?.shares === "number" &&
          typeof (p as Position)?.cost === "number",
      )
      .map((p) => ({ symbol: p.symbol.toUpperCase(), shares: p.shares, cost: p.cost }));
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    /* private mode or full disk — positions just won't persist */
  }
}
