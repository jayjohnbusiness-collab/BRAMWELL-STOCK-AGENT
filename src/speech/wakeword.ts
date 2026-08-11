/*
 * Wake-word detection (conversation spec §2).
 *
 * "Hey Bramwell" — also a bare "Bramwell". Because speech recognition often
 * mangles the name, we also accept its common mishearings: "bram well",
 * "bramwells", "bramwell's", and the frequent "well's"/"wells". A bare "well"
 * (a very common English word) is deliberately NOT accepted, and "bram" alone
 * stays rejected — too little separation.
 *
 * Pure and synchronous, so the rule that decides whether Bramwell was even
 * addressed is testable without a microphone.
 */

export interface WakeResult {
  /** Whether the wake word was spoken. */
  woke: boolean;
  /** The remainder after the wake word — the command, if any. */
  command: string;
}

// Optional leading "hey"/"hi"/"ok"/"okay", then the name or a near-hearing of
// it ("bramwell", "bram well", "bramwell's", "well's", "wells"), then any
// trailing punctuation (including en/em dashes) and space.
const WAKE =
  /^\s*(?:hey\s+|hi\s+|ok\s+|okay\s+)?(?:bram\s?well(?:['’]s|s)?|well['’]s|wells)\b[\s,.:;!?–—-]*/i;

export function detectWake(transcript: string): WakeResult {
  const t = transcript.trim();
  if (!WAKE.test(t)) return { woke: false, command: t };
  return { woke: true, command: t.replace(WAKE, "").trim() };
}
