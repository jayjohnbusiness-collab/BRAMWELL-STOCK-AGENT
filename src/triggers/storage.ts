import type { Trigger, TriggerKind } from "./types";

/* Triggers persist like the watchlist and board — set once, kept across reloads. */

const KEY = "bramwell.triggers.v1";
const KINDS: TriggerKind[] = ["above", "below", "move"];

export function loadTriggers(): Trigger[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is Trigger =>
          typeof (t as Trigger)?.symbol === "string" &&
          KINDS.includes((t as Trigger)?.kind) &&
          typeof (t as Trigger)?.value === "number",
      )
      .map((t) => ({
        id: t.id || `${t.symbol}-${t.kind}-${t.value}`,
        symbol: t.symbol.toUpperCase(),
        name: t.name || t.symbol,
        kind: t.kind,
        value: t.value,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : 0,
        firedAt: typeof t.firedAt === "number" ? t.firedAt : null,
      }));
  } catch {
    return [];
  }
}

export function saveTriggers(triggers: Trigger[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(triggers));
  } catch {
    /* private mode or full disk — triggers just won't persist */
  }
}
