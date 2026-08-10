/*
 * Price triggers — the heart of "speak up when it matters".
 *
 * A trigger is a standing condition on a name: cross above a price, fall below
 * one, or move by a percent today. The live loop checks armed triggers each
 * poll; when one fires it's stamped (firedAt) so it speaks up once, not every
 * cycle, until the user re-arms or removes it.
 */

export type TriggerKind = "above" | "below" | "move";

export interface Trigger {
  id: string;
  symbol: string;
  name: string;
  kind: TriggerKind;
  /** Price for above/below; percent (absolute) for move. */
  value: number;
  createdAt: number;
  /** null = armed and watching; a timestamp = already fired. */
  firedAt: number | null;
}

export interface TriggerQuote {
  price: number;
  changePct: number;
}

/** Does this trigger's condition hold for the current quote? */
export function triggerFires(t: Trigger, q: TriggerQuote): boolean {
  if (t.kind === "above") return q.price >= t.value;
  if (t.kind === "below") return q.price <= t.value;
  return Math.abs(q.changePct) >= t.value;
}

/** Short human label, e.g. "below 200" or "moves ±5%". */
export function describeTrigger(t: Trigger): string {
  if (t.kind === "above") return `above ${fmt(t.value)}`;
  if (t.kind === "below") return `below ${fmt(t.value)}`;
  return `moves ±${fmt(t.value)}%`;
}

/** The butler's line when a trigger fires. */
export function firedLine(t: Trigger, q: TriggerQuote): string {
  const name = cap(t.name);
  if (t.kind === "above") return `${name} is above ${fmt(t.value)} — now ${q.price.toFixed(2)}.`;
  if (t.kind === "below") return `${name} is below ${fmt(t.value)} — now ${q.price.toFixed(2)}.`;
  const dir = q.changePct >= 0 ? "up" : "down";
  return `${name} is ${Math.abs(q.changePct).toFixed(2)}% ${dir} today — past your ${fmt(
    t.value,
  )}% mark.`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
