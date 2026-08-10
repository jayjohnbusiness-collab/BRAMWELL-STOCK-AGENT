import type { Alert, Instrument, ScreenPayload } from "../agent/types";
import { InstrumentRow } from "./InstrumentRow";

/*
 * "The screen." The same answer is delivered twice, differently: spoken it is
 * rounded and capped at three; here it is exact, tabular, and complete.
 * The unprompted alert, when there is one, sits at the top behind a single
 * brass rule — the one brass accent on this side. The watchlist itself lives
 * in the manager below; here, at rest, the screen is simply quiet.
 */
export function ScreenPanel({
  payload,
  alert,
  onAck,
}: {
  payload: ScreenPayload;
  alert: Alert | null;
  onAck?: () => void;
}) {
  const showResting = payload.kind === "none" && !alert;
  return (
    <section
      aria-label="Ledger"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {alert ? <AlertBlock alert={alert} onAck={onAck} /> : null}

      {payload.kind === "table" ? (
        <Ledger title={payload.title} rows={payload.rows} />
      ) : payload.kind === "quote" ? (
        <Quote instrument={payload.instrument} />
      ) : showResting ? (
        <div>
          <span className="label">Now</span>
          <p className="body" style={{ margin: "var(--space-2) 0 0", color: "var(--ink-soft)" }}>
            Nothing worth reporting.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function AlertBlock({ alert, onAck }: { alert: Alert; onAck?: () => void }) {
  return (
    <div
      style={{
        // Alerts are ink; brass marks it as the one thing worth surfacing.
        // A single brass rule, no red, no box.
        borderTop: "2px solid var(--brass)",
        paddingTop: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="label">Worth an interruption</span>
        {onAck ? (
          <button
            type="button"
            className="chip"
            onClick={onAck}
            style={{ padding: "2px 8px" }}
          >
            Acknowledge
          </button>
        ) : null}
      </div>
      <p className="body" style={{ margin: 0 }}>
        {alert.spoken}
      </p>
      <div style={{ marginTop: "var(--space-2)" }}>
        <InstrumentRow instrument={alert.instrument} />
      </div>
    </div>
  );
}

function Ledger({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Instrument[];
  empty?: string;
}) {
  return (
    <div>
      <h2 className="h2" style={{ marginBottom: "var(--space-3)" }}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          {empty ?? "Nothing to show."}
        </p>
      ) : (
        <div style={{ borderBottom: "var(--hairline) solid var(--rule)" }}>
          {rows.map((r) => (
            <InstrumentRow key={r.symbol} instrument={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function Quote({ instrument }: { instrument: Instrument }) {
  return (
    <div>
      <h2 className="h2" style={{ marginBottom: "var(--space-1)" }}>
        {cap(instrument.name)}
      </h2>
      <span className="label">{instrument.symbol}</span>
      <div style={{ marginTop: "var(--space-4)", borderBottom: "var(--hairline) solid var(--rule)" }}>
        <InstrumentRow instrument={instrument} />
      </div>
      {instrument.cause ? (
        <p className="small" style={{ color: "var(--ink-soft)", marginTop: "var(--space-4)" }}>
          {cap(instrument.cause.text)}.
          {instrument.cause.source ? (
            <span style={{ display: "block", marginTop: "var(--space-1)" }}>
              Source: {instrument.cause.source}.
            </span>
          ) : null}
        </p>
      ) : (
        <p className="small" style={{ color: "var(--ink-soft)", marginTop: "var(--space-4)" }}>
          No established cause on the wire.
        </p>
      )}
    </div>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
