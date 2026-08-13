import { useEffect, useState } from "react";
import type { Market } from "../../agent/market";
import type { MarketEvent } from "../../feed/types";
import type { CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import { loadEvents, saveEvents, type CustomEvent } from "../../events/storage";
import { cap, Empty } from "./parts";

/*
 * Events: upcoming earnings for the names the user follows (from the feed) plus
 * the user's own reminders (stored locally). Merged, sorted, and shown from
 * today forward. The user can add/remove their own; earnings are read-only.
 */
type Agenda =
  | { key: string; date: string; title: string; tag: string; removable: false; symbol?: string }
  | { key: string; date: string; title: string; tag: string; removable: true; id: string };

export function EventsCard({
  market,
  earnings,
  size,
  onOpen,
}: {
  market: Market;
  earnings: (symbols: string[]) => Promise<MarketEvent[]>;
  size: CardSize;
  onOpen?: (symbol: string) => void;
}) {
  const [feedEvents, setFeedEvents] = useState<MarketEvent[]>([]);
  const [custom, setCustom] = useState<CustomEvent[]>(() => loadEvents());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [adding, setAdding] = useState(false);

  const symbols = market.held().map((i) => i.symbol).join(",");

  useEffect(() => {
    let live = true;
    const list = symbols ? symbols.split(",") : [];
    if (list.length === 0) {
      setFeedEvents([]);
      return;
    }
    earnings(list)
      .then((e) => {
        if (live) setFeedEvents(e);
      })
      .catch(() => {
        /* the card still shows the user's own reminders */
      });
    return () => {
      live = false;
    };
  }, [symbols, earnings]);

  const today = isoToday();
  const nameOf = (sym: string) => market.bySymbol(sym)?.name ?? sym;

  const agenda: Agenda[] = [
    ...feedEvents.map((e) => ({
      key: `e-${e.symbol}-${e.date}`,
      date: e.date,
      title: `${cap(nameOf(e.symbol))} earnings`,
      tag: whenLabel(e.when),
      removable: false as const,
      symbol: e.symbol,
    })),
    ...custom.map((c) => ({
      key: `c-${c.id}`,
      date: c.date,
      title: c.title,
      tag: "you",
      removable: true as const,
      id: c.id,
    })),
  ]
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const limit = rowLimit(size, { sm: 3, md: 5, lg: 20 });
  const shown = agenda.slice(0, limit);
  const hidden = agenda.length - shown.length;

  function addEvent(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !date) return;
    const next = [...custom, { id: `${date}-${t}-${custom.length}`, title: t, date }];
    setCustom(next);
    saveEvents(next);
    setTitle("");
    setDate("");
    setAdding(false);
  }

  function remove(id: string) {
    const next = custom.filter((c) => c.id !== id);
    setCustom(next);
    saveEvents(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {shown.length === 0 ? (
        <Empty>Nothing scheduled. Add a reminder and it'll show here.</Empty>
      ) : (
        <div>
          {shown.map((a) => (
            <div key={a.key} className="agenda-row">
              <span className="agenda-main">
                {!a.removable && a.symbol && onOpen ? (
                  <button
                    type="button"
                    className="ticker-open agenda-title"
                    onClick={() => onOpen(a.symbol!)}
                    title={`Open ${a.symbol} details`}
                    style={{ background: "none", border: "none", padding: 0, font: "inherit", textAlign: "left", cursor: "pointer" }}
                  >
                    {a.title}
                  </button>
                ) : (
                  <span className="agenda-title">{a.title}</span>
                )}
                <span className="agenda-meta small">
                  {fmtDate(a.date)} · {a.tag}
                </span>
              </span>
              {a.removable ? (
                <button
                  type="button"
                  className="chip agenda-x"
                  aria-label={`Remove ${a.title}`}
                  title="Remove"
                  onClick={() => remove(a.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {hidden > 0 ? (
            <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
              +{hidden} more — enlarge the card to see {hidden === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      )}

      {adding ? (
        <form onSubmit={addEvent} className="agenda-add">
          <input
            aria-label="Event title"
            placeholder="Reminder…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <input
            aria-label="Event date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="chip add-event"
          onClick={() => setAdding(true)}
        >
          + Add a reminder
        </button>
      )}
    </div>
  );
}

function whenLabel(when: MarketEvent["when"]): string {
  if (when === "bmo") return "pre-market";
  if (when === "amc") return "after close";
  return "earnings";
}

function isoToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  // Parse as local date (no timezone shift) and show "Wed, Aug 13".
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    date,
  );
}
