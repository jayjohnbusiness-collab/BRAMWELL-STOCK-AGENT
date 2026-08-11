import type { Alert, Instrument, ScreenPayload } from "../../agent/types";
import type { Market } from "../../agent/market";
import type { CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import { InstrumentRow } from "../InstrumentRow";
import { cap, Empty } from "./parts";

/* ---------------------------------------------------------------- Spotlight */
/** The last thing the user asked about, shown in full. */
export function SpotlightCard({
  screen,
  size,
  onOpen,
}: {
  screen: ScreenPayload;
  size: CardSize;
  onOpen?: (symbol: string) => void;
}) {
  if (screen.kind === "quote") {
    const i = screen.instrument;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span className="h2">{cap(i.name)}</span>
          <span className="label">{i.symbol}</span>
        </div>
        <div style={{ marginTop: "var(--space-3)" }}>
          <InstrumentRow instrument={i} onOpen={onOpen} />
        </div>
        {size !== "sm" ? <Cause instrument={i} /> : null}
      </div>
    );
  }
  if (screen.kind === "table") {
    const limit = rowLimit(size, { sm: 3, md: 5, lg: 12 });
    return (
      <div>
        <span className="label">{screen.title}</span>
        <div style={{ marginTop: "var(--space-2)" }}>
          {screen.rows.slice(0, limit).map((r) => (
            <InstrumentRow key={r.symbol} instrument={r} onOpen={onOpen} />
          ))}
        </div>
      </div>
    );
  }
  return <Empty>Ask Bramwell about a name and it lands here in full.</Empty>;
}

function Cause({ instrument }: { instrument: Instrument }) {
  if (!instrument.cause) {
    return (
      <p className="small" style={{ color: "var(--ink-soft)", marginTop: "var(--space-4)" }}>
        No established cause on the wire yet.
      </p>
    );
  }
  const c = instrument.cause;
  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      {c.confidence === "unconfirmed" ? (
        <span className="label" style={{ display: "block", marginBottom: "var(--space-1)" }}>
          Unconfirmed
        </span>
      ) : null}
      <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
        {cap(c.text)}.
      </p>
      {c.source ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-1) 0 0" }}>
          Source:{" "}
          {c.url ? (
            <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>
              {c.source}
            </a>
          ) : (
            c.source
          )}
          .
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Alerts */
/** The single unprompted nudge, or calm. */
export function AlertsCard({
  alert,
  onAck,
  onOpen,
}: {
  alert: Alert | null;
  onAck: (id: string) => void;
  onOpen?: (symbol: string) => void;
}) {
  if (!alert) return <Empty>Nothing worth reporting.</Empty>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="label" style={{ color: "var(--brass)" }}>
          Worth an interruption
        </span>
        <button
          type="button"
          className="chip"
          onClick={() => onAck(alert.id)}
          style={{ padding: "2px 12px" }}
        >
          Acknowledge
        </button>
      </div>
      <p className="body" style={{ margin: 0 }}>
        {alert.spoken}
      </p>
      <div style={{ marginTop: "var(--space-2)" }}>
        <InstrumentRow instrument={alert.instrument} onOpen={onOpen} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Movers */
/** Today's leaders and laggards among the names the user follows. */
export function MoversCard({
  market,
  size,
  onOpen,
}: {
  market: Market;
  size: CardSize;
  onOpen?: (symbol: string) => void;
}) {
  const per = rowLimit(size, { sm: 2, md: 3, lg: 5 });
  const held = market.held();
  const up = held.filter((i) => i.changePct > 0.05).sort((a, b) => b.changePct - a.changePct).slice(0, per);
  const down = held.filter((i) => i.changePct < -0.05).sort((a, b) => a.changePct - b.changePct).slice(0, per);

  if (up.length === 0 && down.length === 0) {
    return <Empty>Your names are flat today — nothing pulling either way.</Empty>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {up.length ? (
        <div>
          <span className="label" style={{ color: "var(--ink-soft)" }}>Leaders</span>
          {up.map((i) => (
            <InstrumentRow key={i.symbol} instrument={i} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
      {down.length ? (
        <div>
          <span className="label" style={{ color: "var(--ink-soft)" }}>Laggards</span>
          {down.map((i) => (
            <InstrumentRow key={i.symbol} instrument={i} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Breadth */
/** How many of the user's names are up vs down today. */
export function BreadthCard({ market, size }: { market: Market; size: CardSize }) {
  const held = market.held();
  const n = held.length;
  if (n === 0) return <Empty>Add some names and I'll show the day's balance.</Empty>;

  const up = held.filter((i) => i.changePct > 0.05).length;
  const down = held.filter((i) => i.changePct < -0.05).length;
  const flat = n - up - down;
  const top = [...held].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "baseline" }}>
        <Stat n={up} label="up" tone="up" />
        <Stat n={down} label="down" tone="down" />
        {flat > 0 ? <Stat n={flat} label="flat" tone="flat" /> : null}
      </div>
      {size !== "sm" ? (
        <div className="breadth-bar" aria-hidden="true">
          <span className="seg up" style={{ flexGrow: up || 0.001 }} />
          <span className="seg flat" style={{ flexGrow: flat || 0.001 }} />
          <span className="seg down" style={{ flexGrow: down || 0.001 }} />
        </div>
      ) : null}
      <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
        {cap(top.name)} is the mover, {top.changePct >= 0 ? "up" : "down"}{" "}
        {Math.abs(top.changePct).toFixed(2)}%.
      </p>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: "up" | "down" | "flat" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
      <span className={`breadth-num ${tone}`}>{n}</span>
      <span className="small" style={{ color: "var(--ink-soft)" }}>
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------- Causes */
/** Recent attributed causes across the user's names. */
export function CausesCard({ market, size }: { market: Market; size: CardSize }) {
  const limit = rowLimit(size, { sm: 2, md: 4, lg: 99 });
  const withCause = market.held().filter((i) => i.cause);
  if (withCause.length === 0) {
    return <Empty>No causes on the wire yet. I'll fill this in as stories land.</Empty>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {withCause.slice(0, limit).map((i) => (
        <div
          key={i.symbol}
          style={{
            padding: "var(--space-3) 0",
            borderTop: "var(--hairline) solid var(--rule)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
            <span className="label" style={{ color: "var(--ink)" }}>
              {i.symbol}
            </span>
            {i.cause?.confidence === "unconfirmed" ? (
              <span className="small" style={{ color: "var(--ink-soft)" }}>
                unconfirmed
              </span>
            ) : null}
          </div>
          <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-1) 0 0" }}>
            {cap(i.cause!.text)}.
          </p>
        </div>
      ))}
    </div>
  );
}
