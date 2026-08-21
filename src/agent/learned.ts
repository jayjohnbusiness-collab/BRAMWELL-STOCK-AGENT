/*
 * Taught answers — Bramwell's small, local memory.
 *
 * When he can't answer something, the app offers to learn it: the user gives
 * the answer, it's stored here (this browser only, like the keys), and the next
 * time the same question is asked he recalls it. Deliberately simple: an exact
 * match on the normalized question, newest wins. Pure/synchronous so it's
 * testable without a browser; all storage access is guarded for private mode.
 */

const STORE = "bramwell.learned";
const MAX = 200; // keep the memory bounded

export interface Learned {
  q: string; // normalized question key
  a: string; // the taught answer, verbatim
  ts: number; // when it was taught
}

/** Reduce a question to a stable key: no wake word, punctuation, or case. */
export function normalizeQ(text: string): string {
  return text
    .replace(/^\s*(hey\s+|hi\s+|ok\s+|okay\s+)?bramwell\b/i, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(please|could you|can you|would you|tell me|do you know|what is|whats|what s)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readAll(): Learned[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Learned[]).filter((e) => e && e.q && e.a) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Learned[]): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* private mode — memory is best-effort */
  }
}

/** The taught answer for a question, or null if it hasn't been learned. */
export function learnedAnswer(text: string): string | null {
  const key = normalizeQ(text);
  if (!key) return null;
  const hit = [...readAll()].reverse().find((e) => e.q === key);
  return hit ? hit.a : null;
}

/** Remember an answer for a question (replacing any earlier answer for it). */
export function teach(question: string, answer: string): void {
  const key = normalizeQ(question);
  const a = answer.trim();
  if (!key || !a) return;
  const list = readAll().filter((e) => e.q !== key);
  list.push({ q: key, a, ts: Date.now() });
  writeAll(list);
}

/** How many answers Bramwell has been taught. */
export function learnedCount(): number {
  return readAll().length;
}

/** Forget everything taught (for a settings "reset" control). */
export function clearLearned(): void {
  writeAll([]);
}
