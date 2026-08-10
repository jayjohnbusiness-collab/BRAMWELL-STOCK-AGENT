/*
 * User-created events/reminders for the Events card. These are the user's own
 * ("Fed minutes Wed", "call broker") — stored locally, no network, alongside
 * the earnings dates the feed supplies.
 */

export interface CustomEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  note?: string;
}

const KEY = "bramwell.events.v1";

export function loadEvents(): CustomEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is CustomEvent =>
          typeof (e as CustomEvent)?.title === "string" &&
          typeof (e as CustomEvent)?.date === "string",
      )
      .map((e) => ({ id: e.id || `${e.date}-${e.title}`, title: e.title, date: e.date, note: e.note }));
  } catch {
    return [];
  }
}

export function saveEvents(events: CustomEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}
