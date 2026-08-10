import { useState } from "react";
import type { CardContext, CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import type { TriggerKind } from "../../triggers/types";
import { describeTrigger } from "../../triggers/types";
import { Empty } from "./parts";

/*
 * Alerts & triggers: standing conditions on the names you follow. Set one here
 * (or ask Bramwell — "tell me if NVDA drops below 200"); the live loop watches
 * and speaks up the moment it fires, with a browser notification if allowed.
 */
export function TriggersCard({ ctx, size }: { ctx: CardContext; size: CardSize }) {
  const held = ctx.market.held();
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<TriggerKind>("below");
  const [value, setValue] = useState("");

  const triggers = [...ctx.triggers.all()].sort((a, b) => b.createdAt - a.createdAt);
  const limit = rowLimit(size, { sm: 3, md: 6, lg: 20 });
  const shown = triggers.slice(0, limit);
  const hidden = triggers.length - shown.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol || held[0]?.symbol;
    const v = parseFloat(value);
    if (!sym || !Number.isFinite(v)) return;
    const inst = ctx.market.bySymbol(sym);
    ctx.triggers.add({ symbol: sym, name: inst?.name ?? sym, kind, value: Math.abs(v) });
    ctx.triggers.requestNotify();
    setValue("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {ctx.triggers.notifyState === "default" ? (
        <button type="button" className="chip notify-cta" onClick={ctx.triggers.requestNotify}>
          Enable browser notifications
        </button>
      ) : ctx.triggers.notifyState === "denied" ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          Notifications are blocked in your browser — alerts still show here and in chat.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <Empty>No alerts set. Add one below, or ask me to watch a level.</Empty>
      ) : (
        <div>
          {shown.map((t) => (
            <div key={t.id} className="trigger-row">
              <span className="trigger-main">
                <span className="trigger-line">
                  <span className="label" style={{ color: "var(--ink)" }}>
                    {t.symbol}
                  </span>{" "}
                  <span className="small" style={{ color: "var(--ink-soft)" }}>
                    {describeTrigger(t)}
                  </span>
                </span>
                <span className="small trigger-status">
                  {t.firedAt ? (
                    <span style={{ color: "var(--data-up)" }}>fired {clock(t.firedAt)}</span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>
                      <span className="armed-dot" aria-hidden="true" /> armed
                    </span>
                  )}
                </span>
              </span>
              {t.firedAt ? (
                <button
                  type="button"
                  className="chip trigger-btn"
                  onClick={() => ctx.triggers.rearm(t.id)}
                  title="Re-arm this alert"
                >
                  re-arm
                </button>
              ) : null}
              <button
                type="button"
                className="chip trigger-x"
                aria-label={`Remove ${t.symbol} ${describeTrigger(t)}`}
                title="Remove"
                onClick={() => ctx.triggers.remove(t.id)}
              >
                ×
              </button>
            </div>
          ))}
          {hidden > 0 ? (
            <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
              +{hidden} more — enlarge the card to see {hidden === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      )}

      {held.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          Add a name to your watchlist first, then set an alert on it.
        </p>
      ) : (
        <form onSubmit={submit} className="trigger-add">
          <select
            aria-label="Name"
            value={symbol || held[0]?.symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {held.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
          <select
            aria-label="Condition"
            value={kind}
            onChange={(e) => setKind(e.target.value as TriggerKind)}
          >
            <option value="below">below</option>
            <option value="above">above</option>
            <option value="move">moves ±%</option>
          </select>
          <input
            aria-label="Value"
            inputMode="decimal"
            placeholder={kind === "move" ? "5" : "200"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="btn">
            Set
          </button>
        </form>
      )}
    </div>
  );
}

function clock(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
      new Date(ms),
    );
  } catch {
    return "";
  }
}
