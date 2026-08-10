/*
 * Watchlist persistence.
 *
 * The watchlist is the one piece of real user state in the scaffold — "the
 * names you set." It survives reloads in localStorage. The store is written
 * against the minimal Storage shape and takes it as a parameter, so it works
 * in the browser and is trivially testable with a fake.
 */

const KEY = "bramwell.watchlist.v1";

/** The subset of the Web Storage API we use. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // e.g. storage disabled by the browser
  }
}

/** Load the saved watchlist symbols, or null if none has been saved yet. */
export function loadWatchlist(store: KeyValueStore | null = defaultStore()): string[] | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return null;
  }
}

/** Save the watchlist symbols. Silently no-ops if storage is unavailable. */
export function saveWatchlist(
  symbols: string[],
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(symbols));
  } catch {
    // Quota or privacy mode — nothing to be done; state stays in memory.
  }
}
