import type { Alert, Instrument } from "./types";
import type { Market } from "./market";
import { spokenChange } from "./format";

/*
 * The unprompted alert bar (conversation spec §1).
 *
 * Unprompted, Bramwell speaks first — and the bar is high. Every unprompted
 * message must carry a probable cause; a move without an explanation is noise
 * with a number attached. And he never sends two notifications where one
 * would do, so peers moving on the same story collapse into a single line.
 */

const MOVE_THRESHOLD = 5; // percent

/** Instruments that individually clear the bar: big move AND an established cause. */
function eligible(market: Market): Instrument[] {
  return market
    .equities()
    .filter((i) => Math.abs(i.changePct) >= MOVE_THRESHOLD && i.cause !== null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/**
 * The single lead alert for the session, or null when nothing is worth an
 * interruption. Silence here is Bramwell working correctly.
 */
export function leadAlert(market: Market): Alert | null {
  const hits = eligible(market);
  if (hits.length === 0) return null;

  const lead = hits[0];
  const peers = market
    .equities()
    .filter(
      (i) =>
        i.symbol !== lead.symbol &&
        i.sector === lead.sector &&
        Math.abs(i.changePct) >= MOVE_THRESHOLD - 1 &&
        Math.sign(i.changePct) === Math.sign(lead.changePct),
    );

  const name = lead.name.replace(/^the\s+/i, "");
  let spoken = `${name} is ${spokenChange(lead.changePct)} since the open. ${cap(
    lead.cause!.text,
  )}.`;

  // One notification, not two: fold peers into the same line.
  if (peers.length === 1) {
    spoken += ` ${peers[0].name} is moving with it.`;
  } else if (peers.length > 1) {
    spoken += ` The rest of the ${lead.sector ?? "group"} is moving with it.`;
  }

  return { id: `${lead.symbol}-open`, symbol: lead.symbol, spoken, instrument: lead };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
