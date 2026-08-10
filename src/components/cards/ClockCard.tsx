import { useEffect, useState } from "react";
import type { CardSize } from "../../cards/types";

/*
 * A market clock for US regular hours (9:30–16:00 ET, Mon–Fri). Pure client
 * side — no data — computed in America/New_York so it's right wherever the user
 * is. Ticks once a second.
 */
export function ClockCard({ size }: { size: CardSize }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const et = etParts(now);
  const mins = et.hour * 60 + et.minute;
  const weekday = et.weekday; // 0=Sun … 6=Sat
  const isWeekday = weekday >= 1 && weekday <= 5;
  const open = isWeekday && mins >= 570 && mins < 960;

  const detail = open
    ? `Closes in ${hm(960 - mins)}`
    : `Opens in ${hm(minutesToNextOpen(weekday, mins))}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span className={`clock-pill ${open ? "open" : "closed"}`}>
          {open ? "Open" : "Closed"}
        </span>
        <span className="small" style={{ color: "var(--ink-soft)" }}>
          {detail}
        </span>
      </div>
      {size !== "sm" ? (
        <p className="small tabular" style={{ color: "var(--ink-soft)", margin: 0 }}>
          {et.label} ET · New York
        </p>
      ) : null}
    </div>
  );
}

interface ET {
  weekday: number;
  hour: number;
  minute: number;
  label: string;
}

function etParts(now: Date): ET {
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
function minutesToNextOpen(weekday: number, mins: number): number {
  const OPEN = 570;
  // Later today, if it's a weekday and before the bell.
  if (weekday >= 1 && weekday <= 5 && mins < OPEN) return OPEN - mins;
  let days = 1;
  let wd = (weekday + 1) % 7;
  while (!(wd >= 1 && wd <= 5)) {
    wd = (wd + 1) % 7;
    days += 1;
  }
  return days * 1440 - mins + OPEN;
}

function hm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
