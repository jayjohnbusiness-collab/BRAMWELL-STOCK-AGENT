/*
 * Price triggers — the heart of "speak up when it matters".
 *
 * A trigger is a standing condition. Most are on a single name — cross above a
 * price, fall below one, move by a percent today, or move by a percent from
 * where it stood when you set the alert. Two are on the whole book: the day's
 * P/L crossing a dollar threshold, or any holding moving beyond a percent. The
 * live loop checks armed triggers each poll; when one fires it's stamped
 * (firedAt) so it speaks up once, not every cycle, until re-armed or removed.
 */

export type TriggerKind =
  | "above"
  | "below"
  | "move"
  | "pctFromSet"
  | "bookDay"
  | "anyMove";

/** Whether a kind is about the whole book rather than one named instrument. */
export function isPortfolioKind(kind: TriggerKind): boolean {
  return kind === "bookDay" || kind === "anyMove";
}

export interface Trigger {
  id: string;
  symbol: string;
  name: string;
  kind: TriggerKind;
  /** Price for above/below; percent for move/pctFromSet/anyMove; dollars for bookDay. */
  value: number;
  /** Reference price captured when a pctFromSet alert is created. */
  basis?: number;
  createdAt: number;
  /** null = armed and watching; a timestamp = already fired. */
  firedAt: number | null;
  /** Which name tripped a portfolio-level alert (set at fire time). */
  firedNote?: string;
  /** The value at the moment of firing (a $ P/L or a percent), for the message. */
  firedValue?: number;
}

export interface TriggerQuote {
  price: number;
  changePct: number;
}

/**
 * The whole-book context a portfolio-level trigger needs. Supplied by the app
 * each poll (the trigger store is name-only on its own).
 */
export interface TriggerContext {
  /** The book's change today, in dollars. */
  bookDayAbs?: number;
  /** The names followed, with today's percent change, for "any holding moves". */
  holdings?: { symbol: string; name: string; changePct: number }[];
}

/** Does this per-name trigger's condition hold for the current quote? */
export function triggerFires(t: Trigger, q: TriggerQuote): boolean {
  if (t.kind === "above") return q.price >= t.value;
  if (t.kind === "below") return q.price <= t.value;
  if (t.kind === "move") return Math.abs(q.changePct) >= t.value;
  if (t.kind === "pctFromSet") {
    if (!t.basis || t.basis <= 0) return false;
    return Math.abs(((q.price - t.basis) / t.basis) * 100) >= t.value;
  }
  return false; // portfolio-level kinds are checked separately
}

/**
 * Does this portfolio-level trigger fire? Returns the detail to record on it
 * (the tripping name, the value at the moment) or null. Per-name kinds return
 * null here.
 */
export function portfolioTriggerFires(
  t: Trigger,
  ctx: TriggerContext,
): { note?: string; value: number } | null {
  if (t.kind === "bookDay") {
    if (ctx.bookDayAbs == null) return null;
    return Math.abs(ctx.bookDayAbs) >= t.value ? { value: ctx.bookDayAbs } : null;
  }
  if (t.kind === "anyMove") {
    const hit = (ctx.holdings ?? []).find((h) => Math.abs(h.changePct) >= t.value);
    return hit ? { note: hit.symbol, value: hit.changePct } : null;
  }
  return null;
}

/** Short human label, e.g. "below 200" or "moves ±5%". */
export function describeTrigger(t: Trigger): string {
  switch (t.kind) {
    case "above":
      return `above ${fmt(t.value)}`;
    case "below":
      return `below ${fmt(t.value)}`;
    case "move":
      return `moves ±${fmt(t.value)}%`;
    case "pctFromSet":
      return `±${fmt(t.value)}% from set`;
    case "bookDay":
      return `book P/L hits ±$${fmt(t.value)}`;
    case "anyMove":
      return `any holding moves ±${fmt(t.value)}%`;
  }
}

/** The butler's line when a trigger fires. */
export function firedLine(t: Trigger, q: TriggerQuote): string {
  const name = cap(t.name);
  if (t.kind === "above")
    return `A quick word — ${name}'s crossed above ${fmt(t.value)}; it's at ${q.price.toFixed(2)} now.`;
  if (t.kind === "below")
    return `A quick word — ${name}'s slipped below ${fmt(t.value)}; it's at ${q.price.toFixed(2)} now.`;
  if (t.kind === "move") {
    const dir = q.changePct >= 0 ? "up" : "down";
    return `A quick word — ${name}'s moved ${Math.abs(q.changePct).toFixed(2)}% ${dir} today, past your ${fmt(
      t.value,
    )}% mark.`;
  }
  if (t.kind === "pctFromSet") {
    const moved = t.basis && t.basis > 0 ? ((q.price - t.basis) / t.basis) * 100 : 0;
    const dir = moved >= 0 ? "up" : "down";
    return `A quick word — ${name}'s ${dir} ${Math.abs(moved).toFixed(2)}% from where it stood when you set this; it's at ${q.price.toFixed(2)} now.`;
  }
  if (t.kind === "bookDay") {
    const v = t.firedValue ?? 0;
    const dir = v >= 0 ? "up" : "down";
    return `A quick word — your book's ${dir} ${dollars(Math.abs(v))} on the day, past your ${dollars(
      t.value,
    )} mark.`;
  }
  // anyMove
  const who = cap(t.firedNote ?? "a holding");
  const v = t.firedValue ?? 0;
  const dir = v >= 0 ? "up" : "down";
  return `A quick word — ${who}'s ${dir} ${Math.abs(v).toFixed(2)}% today, past your ±${fmt(
    t.value,
  )}% mark on your holdings.`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** "$1,234" — whole dollars for an alert line. */
function dollars(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
