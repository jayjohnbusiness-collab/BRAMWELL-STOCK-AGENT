/*
 * The voice surface's state, derived in one place so it's testable.
 * Priority: speaking over working over listening over idle.
 */
export type Phase = "speaking" | "working" | "listening" | "idle";

export function voicePhase(s: {
  speaking: boolean;
  working: boolean;
  listening: boolean;
}): Phase {
  if (s.speaking) return "speaking";
  if (s.working) return "working";
  if (s.listening) return "listening";
  return "idle";
}
