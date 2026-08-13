/*
 * US market hours, in America/New_York so it's right wherever the user sits.
 * Regular session 9:30–16:00 ET, with the pre-market (4:00–9:30) and
 * after-hours (16:00–20:00) windows recognised too. Pure and time-injected
 * (marketStatus takes the moment), so the phrasing is testable without a clock.
 */

export type MarketPhase = "premarket" | "open" | "afterhours" | "closed";

export interface MarketStatus {
  phase: MarketPhase;
  /** Short label: "Open", "Pre-market", "After hours", "Closed". */
  label: string;
  /** A detail line, e.g. "Closes in 2h 10m" or "Opens in 45m". */
  detail: string;
}

const PRE = 240; // 4:00
const OPEN = 570; // 9:30
const CLOSE = 960; // 16:00
const AFTER_END = 1200; // 20:00

export function marketStatus(now: Date): MarketStatus {
  const et = etParts(now);
  const mins = et.hour * 60 + et.minute;
  const weekday = et.weekday; // 0=Sun … 6=Sat
  const isWeekday = weekday >= 1 && weekday <= 5;

  if (isWeekday && mins >= OPEN && mins < CLOSE) {
    return { phase: "open", label: "Open", detail: `Closes in ${hm(CLOSE - mins)}` };
  }
  if (isWeekday && mins >= PRE && mins < OPEN) {
    return { phase: "premarket", label: "Pre-market", detail: `Opens in ${hm(OPEN - mins)}` };
  }
  if (isWeekday && mins >= CLOSE && mins < AFTER_END) {
    return {
      phase: "afterhours",
      label: "After hours",
      detail: `Opens in ${hm(minutesToNextOpen(weekday, mins))}`,
    };
  }
  return { phase: "closed", label: "Closed", detail: `Opens in ${hm(minutesToNextOpen(weekday, mins))}` };
}

interface ET {
  weekday: number;
  hour: number;
  minute: number;
  label: string;
}

export function etParts(now: Date): ET {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wdMap[get("weekday")] ?? 1;
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some environments render midnight as 24
  const minute = parseInt(get("minute"), 10) || 0;
  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { weekday, hour, minute, label };
}

/** Minutes from the current ET moment to the next 9:30 open. */
export function minutesToNextOpen(weekday: number, mins: number): number {
  if (weekday >= 1 && weekday <= 5 && mins < OPEN) return OPEN - mins;
  let days = 1;
  let wd = (weekday + 1) % 7;
  while (!(wd >= 1 && wd <= 5)) {
    wd = (wd + 1) % 7;
    days += 1;
  }
  return days * 1440 - mins + OPEN;
}

export function hm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
