/*
 * Per-ticker notes and target prices — the user's own thesis on a name, kept
 * only in this browser. A note is free text; a target is a price the user is
 * watching for (and can turn into a standing alert in a click). Stored as a
 * simple map keyed by symbol.
 */

export interface TickerNote {
  note?: string;
  /** A price the user is watching this name for. */
  target?: number;
}

const KEY = "bramwell.notes.v1";

type NoteMap = Record<string, TickerNote>;

function load(): NoteMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as NoteMap;
  } catch {
    return {};
  }
}

function save(map: NoteMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — the note just won't persist */
  }
}

/** The note + target for a symbol (an empty object if none). */
export function getNote(symbol: string): TickerNote {
  return load()[symbol.toUpperCase()] ?? {};
}

/**
 * Merge a partial update into a symbol's note. An empty note string and an
 * undefined target are dropped; when nothing meaningful remains, the entry is
 * removed entirely so it doesn't linger.
 */
export function setNote(symbol: string, patch: TickerNote): TickerNote {
  const sym = symbol.toUpperCase();
  const map = load();
  const next: TickerNote = { ...map[sym], ...patch };
  if (patch.note !== undefined) {
    const t = patch.note.trim();
    if (t) next.note = t;
    else delete next.note;
  }
  if (patch.target !== undefined) {
    if (patch.target && Number.isFinite(patch.target) && patch.target > 0) next.target = patch.target;
    else delete next.target;
  }
  if (next.note === undefined && next.target === undefined) {
    delete map[sym];
  } else {
    map[sym] = next;
  }
  save(map);
  return map[sym] ?? {};
}

/** Whether a symbol has any note or target recorded (for a list indicator). */
export function hasNote(symbol: string): boolean {
  const n = load()[symbol.toUpperCase()];
  return Boolean(n && (n.note || n.target));
}
