/*
 * Wake-word detection (conversation spec §2).
 *
 * "Hey Bramwell" — also a bare "Bramwell". Three syllables with hard
 * consonants and no common English collision, for a low false-positive rate.
 * "Bram" alone is rejected: two phonemes is not enough separation.
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

// Optional leading "hey"/"ok"/"okay", then the whole word "bramwell",
// then any trailing punctuation (including en/em dashes) and space.
const WAKE = /^\s*(hey\s+|ok\s+|okay\s+)?bramwell\b[\s,.:;!?–—-]*/i;

export function detectWake(transcript: string): WakeResult {
  const t = transcript.trim();
  if (!WAKE.test(t)) return { woke: false, command: t };
  return { woke: true, command: t.replace(WAKE, "").trim() };
}
